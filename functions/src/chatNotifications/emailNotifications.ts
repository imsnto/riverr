// functions/src/chatNotifications/emailNotifications.ts
//
// Agent chat alert emails + cooldown logic + scheduled visitor follow-up emails.
// Uses your existing Postmark setup through sendSystemEmail().
// Assumes these Firestore locations:
// - conversations/{conversationId}
// - chat_messages/{messageId} (adjusted to match project schema)
// - users/{agentId}
// - notificationCooldowns/{cooldownKey}

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { sendSystemEmail } from "../email/sendSystemEmail";

const APP_BASE_URL = defineSecret("APP_BASE_URL");
const POSTMARK_SERVER_TOKEN = defineSecret("POSTMARK_SERVER_TOKEN");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

// -----------------------------
// Cooldown helpers
// -----------------------------

async function canSendWithCooldown(opts: {
  cooldownKey: string;
  cooldownMs: number;
  force?: boolean;
}): Promise<boolean> {
  const { cooldownKey, cooldownMs, force } = opts;
  if (force) return true;

  const ref = db.doc(`notificationCooldowns/${cooldownKey}`);
  const snap = await ref.get();

  if (!snap.exists) return true;

  const lastSentAt = snap.get("lastSentAt") as admin.firestore.Timestamp | undefined;
  if (!lastSentAt) return true;

  const nowMs = Date.now();
  const lastMs = lastSentAt.toMillis();
  return nowMs - lastMs >= cooldownMs;
}

async function markCooldownSent(cooldownKey: string) {
  const ref = db.doc(`notificationCooldowns/${cooldownKey}`);
  await ref.set(
    { lastSentAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function safeSnippet(text: string, maxLen = 140) {
  const t = (text || "").trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + "…";
}

// -----------------------------
// New conversation detection + book-keeping
// -----------------------------

async function ensureConversationStartedAndUpdateOnVisitorMessage(params: {
  conversationRef: admin.firestore.DocumentReference;
  messageCreatedAt?: admin.firestore.Timestamp;
}): Promise<{ isNewConversation: boolean }> {
  const { conversationRef, messageCreatedAt } = params;

  return await db.runTransaction(async (tx) => {
    const convSnap = await tx.get(conversationRef);
    if (!convSnap.exists) {
      tx.set(
        conversationRef,
        {
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastVisitorMessageAt: messageCreatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
          lastMessageFrom: "visitor",
        },
        { merge: true }
      );
      return { isNewConversation: true };
    }

    const startedAt = convSnap.get("startedAt") as admin.firestore.Timestamp | undefined;
    const isNewConversation = !startedAt;

    tx.set(
      conversationRef,
      {
        ...(isNewConversation ? { startedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
        lastVisitorMessageAt: messageCreatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
        lastMessageFrom: "visitor",
      },
      { merge: true }
    );

    return { isNewConversation };
  });
}

// -----------------------------
// 1) Agent Chat Alert Email Trigger
// -----------------------------

export const sendAgentChatAlertEmail = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    secrets: [APP_BASE_URL, POSTMARK_SERVER_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { messageId } = event.params;
    const msg = snap.data() as any;

    if (msg?.senderType !== "visitor" && msg?.senderType !== "contact") return;

    const conversationId = msg.conversationId;
    if (!conversationId) return;

    const conversationRef = db.doc(`conversations/${conversationId}`);
    const convSnap = await conversationRef.get();
    if (!convSnap.exists) {
      logger.warn("sendAgentChatAlertEmail: conversation missing", { conversationId, messageId });
      return;
    }
    const conv = convSnap.data() as any;

    const assignedAgentIds: string[] = Array.isArray(conv.assignedAgentIds) ? conv.assignedAgentIds : (conv.assigneeId ? [conv.assigneeId] : []);
    if (!assignedAgentIds.length) return;

    const createdAt = msg.timestamp ? admin.firestore.Timestamp.fromDate(new Date(msg.timestamp)) : undefined;
    const { isNewConversation } = await ensureConversationStartedAndUpdateOnVisitorMessage({
      conversationRef,
      messageCreatedAt: createdAt,
    });

    const baseUrl = APP_BASE_URL.value();
    const chatUrl = `${baseUrl}/space/${conv.spaceId || 'default'}/hub/${conv.hubId}/inbox?conversationId=${conversationId}`;

    const snippet = safeSnippet(msg.content || "");

    await Promise.all(
      assignedAgentIds.map(async (agentId) => {
        try {
          const agentSnap = await db.doc(`users/${agentId}`).get();
          if (!agentSnap.exists) return;

          const agent = agentSnap.data() as any;
          if (agent?.notificationPrefs?.emailEnabled === false) return;

          const to = agent.email;
          if (!to) return;

          const cooldownKey = `agent:${agentId}|conv:${conversationId}|type:agent_alert_email`;
          const canSend = await canSendWithCooldown({
            cooldownKey,
            cooldownMs: 10 * 60 * 1000,
            force: isNewConversation,
          });
          if (!canSend) return;

          const subject = isNewConversation
            ? "New chat started in Manowar"
            : "New chat message in Manowar";

          const htmlBody = `
            <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
              <h2 style="margin: 0 0 12px 0;">${subject}</h2>
              <p style="margin: 0 0 10px 0;"><b>${conv.visitorName || 'Visitor'}:</b> ${snippet || "(no text)"}</p>
              <p style="margin: 0 0 14px 0;">
                <a href="${chatUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;background:#2563eb;color:white;">
                  View Conversation
                </a>
              </p>
              <p style="color:#777; font-size: 12px; margin: 0;">
                Sent at ${new Date().toLocaleString()}
              </p>
            </div>
          `;

          const textBody = `${subject}\n\nMessage from ${conv.visitorName || 'Visitor'}: ${snippet || "(no text)"}\n\nView here: ${chatUrl}`;

          await sendSystemEmail({
            orgId: conv.spaceId,
            to,
            subject,
            htmlBody,
            textBody,
            tag: "agent_alert",
            metadata: {
              conversationId,
              messageId,
              agentId,
            },
          });

          await markCooldownSent(cooldownKey);
        } catch (err: any) {
          logger.error("sendAgentChatAlertEmail: failed for agent", {
            conversationId,
            messageId,
            agentId,
            err: err?.message ?? err,
          });
        }
      })
    );
  }
);

// -----------------------------
// 2) Scheduled Visitor Follow-up Email Job
// -----------------------------

export const scheduledVisitorFollowupEmail = onSchedule(
  {
    schedule: "every 10 minutes",
    secrets: [APP_BASE_URL, POSTMARK_SERVER_TOKEN],
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const baseUrl = APP_BASE_URL.value();
    const now = admin.firestore.Timestamp.now();
    const cutoffVisitorReplyMs = 60 * 60 * 1000;
    const followupCooldownMs = 24 * 60 * 60 * 1000;
    const maxFollowups = 2;

    const visitorReplyCutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - cutoffVisitorReplyMs);

    const querySnap = await db
      .collection("conversations")
      .where("lastMessageFrom", "in", ["agent", "bot"])
      .limit(200)
      .get();

    if (querySnap.empty) return;

    let processed = 0;

    for (const doc of querySnap.docs) {
      const conversationId = doc.id;
      const conv = doc.data() as any;

      try {
        const visitorEmail: string | undefined = conv.visitorEmail;
        if (!visitorEmail) continue;

        const visitorId: string | undefined = conv.visitorId;
        const lastAgentMessageAt: admin.firestore.Timestamp | undefined = conv.lastAgentMessageAt;
        const lastVisitorSeenAt: admin.firestore.Timestamp | undefined = conv.lastVisitorSeenAt;
        const lastVisitorMessageAt: admin.firestore.Timestamp | undefined = conv.lastVisitorMessageAt;

        if (!lastAgentMessageAt) continue;

        if (lastVisitorMessageAt && lastVisitorMessageAt.toMillis() > visitorReplyCutoff.toMillis()) {
          continue;
        }

        if (lastVisitorSeenAt && lastVisitorSeenAt.toMillis() >= lastAgentMessageAt.toMillis()) {
          continue;
        }

        const followupCount: number = typeof conv.followupEmailCount === "number" ? conv.followupEmailCount : 0;
        if (followupCount >= maxFollowups) continue;

        const lastFollowupEmailAt: admin.firestore.Timestamp | undefined = conv.lastFollowupEmailAt;
        if (lastFollowupEmailAt && now.toMillis() - lastFollowupEmailAt.toMillis() < followupCooldownMs) {
          continue;
        }

        const cooldownKey = `conv:${conversationId}|type:visitor_followup_email`;
        const canSend = await canSendWithCooldown({
          cooldownKey,
          cooldownMs: followupCooldownMs,
          force: false,
        });
        if (!canSend) continue;

        const resumeUrl = `${baseUrl}/chatbot/${conv.hubId}/${conv.botId || 'default'}?conversationId=${conversationId}`;

        const subject = "Still need help?";
        const htmlBody = `
          <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
            <h2 style="margin: 0 0 12px 0;">Still need help?</h2>
            <p style="margin: 0 0 14px 0;">
              You have an unread message waiting in your Manowar chat.
            </p>
            <p style="margin: 0 0 14px 0;">
              <a href="${resumeUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;background:#2563eb;color:white;">
                Continue the conversation
              </a>
            </p>
            <p style="color:#777; font-size: 12px; margin: 0;">
              If you’re all set, you can ignore this email.
            </p>
          </div>
        `;
        const textBody = `Still need help?\n\nContinue the conversation: ${resumeUrl}\n\nIf you're all set, ignore this email.`;

        await sendSystemEmail({
          orgId: conv.spaceId,
          to: visitorEmail,
          subject,
          htmlBody,
          textBody,
          tag: "visitor_followup",
          metadata: {
            conversationId,
          },
        });

        await doc.ref.set(
          {
            lastFollowupEmailAt: admin.firestore.FieldValue.serverTimestamp(),
            followupEmailCount: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        );

        await markCooldownSent(cooldownKey);
        processed += 1;
        if (processed >= 100) break;
      } catch (err: any) {
        logger.error("scheduledVisitorFollowupEmail: failed", {
          conversationId,
          err: err?.message ?? err,
        });
      }
    }

    logger.info("scheduledVisitorFollowupEmail: done", { scanned: querySnap.size, processed });
  }
);
