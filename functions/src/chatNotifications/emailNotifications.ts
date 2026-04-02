// functions/src/chatNotifications/emailNotifications.ts
//
// Agent chat alert emails + cooldown logic + scheduled visitor follow-up emails.
// Uses Postmark through sendSystemEmail().
// Assumes flat Firestore locations:
// - conversations/{conversationId}
// - chat_messages/{messageId}
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

// Presence threshold constants (Intercom-like)
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;      // 2 minutes
const INACTIVE_WINDOW_MS = 10 * 60 * 1000;   // 10 minutes (visitor likely left)
const ACK_DELAY_MS = 10 * 60 * 1000;         // wait 10 minutes before acknowledgement email
const ACK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // once per 24h
const REPLY_EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // avoid spamming rapid replies (increased to 5 min)

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
// 1) Agent Chat Alert Email Trigger
// -----------------------------

export const sendAgentChatAlertEmail = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    secrets: [APP_BASE_URL, POSTMARK_SERVER_TOKEN],
    memory: "512MiB",
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

    // Check if new conversation
    const isNewConversation = !conv.startedAt;

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
// 2) Visitor Reply Email Trigger (Intercom-style)
// -----------------------------

export const sendVisitorReplyEmail = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    secrets: [APP_BASE_URL, POSTMARK_SERVER_TOKEN],
    memory: "512MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msg = snap.data() as any;
    if (msg?.senderType !== "agent" && msg?.senderType !== "bot") return;

    const conversationId = msg.conversationId;
    if (!conversationId) return;

    const conversationRef = db.doc(`conversations/${conversationId}`);
    const convSnap = await conversationRef.get();
    if (!convSnap.exists) return;
    const conv = convSnap.data() as any;

    const visitorEmail = conv.visitorEmail;
    if (!visitorEmail) return;

    // RULE: Only email if visitor is INACTIVE
    const now = Date.now();
    const lastActiveAt = conv.lastVisitorActiveAt ? (conv.lastVisitorActiveAt as admin.firestore.Timestamp).toMillis() : 0;
    const isInactive = (now - lastActiveAt) > ACTIVE_WINDOW_MS;

    if (!isInactive) {
      logger.debug("sendVisitorReplyEmail: skipped, visitor active", { conversationId });
      return;
    }

    // Cooldown: avoid rapid spam
    const lastReplyEmailAt = conv.lastAgentReplyEmailAt ? (conv.lastAgentReplyEmailAt as admin.firestore.Timestamp).toMillis() : 0;
    if (now - lastReplyEmailAt < REPLY_EMAIL_COOLDOWN_MS) {
      logger.debug("sendVisitorReplyEmail: skipped, cooldown", { conversationId });
      return;
    }

    const baseUrl = APP_BASE_URL.value();
    const resumeUrl = `${baseUrl}/chatbot/${conv.hubId}/${conv.botId || 'default'}?conversationId=${conversationId}`;
    const snippet = safeSnippet(msg.content || "");

    const authorName = msg.authorId === 'ai_agent' ? 'AI Agent' : (conv.assigneeName || 'A team member');
    const subject = `${authorName} replied to your chat`;

    const htmlBody = `
      <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
        <h2 style="margin: 0 0 12px 0;">New message from ${authorName}</h2>
        <p style="margin: 0 0 14px 0; font-style: italic; color: #444; border-left: 2px solid #ddd; padding-left: 12px;">
          "${snippet}"
        </p>
        <p style="margin: 0 0 14px 0;">
          <a href="${resumeUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;background:#2563eb;color:white;">
            Continue the conversation
          </a>
        </p>
      </div>
    `;

    await sendSystemEmail({
      orgId: conv.spaceId,
      to: visitorEmail,
      subject,
      htmlBody,
      textBody: `${subject}\n\n"${snippet}"\n\nContinue here: ${resumeUrl}`,
      tag: "visitor_reply",
      metadata: { conversationId },
    });

    await conversationRef.update({
      lastAgentReplyEmailAt: admin.firestore.FieldValue.serverTimestamp(),
      agentReplyEmailCount: admin.firestore.FieldValue.increment(1),
    });
  }
);

// -----------------------------
// 3) Scheduled Acknowledgement Email Job
// -----------------------------

export const scheduledAcknowledgementEmail = onSchedule(
  {
    schedule: "every 10 minutes",
    secrets: [APP_BASE_URL, POSTMARK_SERVER_TOKEN],
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
  },
  async () => {
    const baseUrl = APP_BASE_URL.value();
    const now = admin.firestore.Timestamp.now();
    const ackCutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - ACK_DELAY_MS);

    // Find conversations where:
    // 1. Last message is from visitor
    // 2. Visitor hasn't had an ack recently
    // 3. Last message was long enough ago
    const querySnap = await db
      .collection("conversations")
      .where("lastMessageFrom", "in", ["visitor", "contact"])
      .where("lastVisitorMessageAt", "<=", ackCutoff)
      .limit(100)
      .get();

    for (const doc of querySnap.docs) {
      const conv = doc.data() as any;
      const visitorEmail = conv.visitorEmail;
      if (!visitorEmail) continue;

      // RULE: Visitor must be inactive
      const lastActiveAt = conv.lastVisitorActiveAt ? (conv.lastVisitorActiveAt as admin.firestore.Timestamp).toMillis() : 0;
      const isInactive = (now.toMillis() - lastActiveAt) > INACTIVE_WINDOW_MS;
      if (!isInactive) continue;

      // Cooldown: at most once per 24h
      const lastAckAt = conv.lastAckEmailAt ? (conv.lastAckEmailAt as admin.firestore.Timestamp).toMillis() : 0;
      if (now.toMillis() - lastAckAt < ACK_COOLDOWN_MS) continue;

      const resumeUrl = `${baseUrl}/chatbot/${conv.hubId}/${conv.botId || 'default'}?conversationId=${doc.id}`;
      const subject = "We've received your message";

      await sendSystemEmail({
        orgId: conv.spaceId,
        to: visitorEmail,
        subject,
        htmlBody: `
          <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
            <h2>We got your message!</h2>
            <p>Thanks for reaching out. We've received your message and a team member will get back to you as soon as possible.</p>
            <p><a href="${resumeUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;background:#2563eb;color:white;">View your message</a></p>
          </div>
        `,
        tag: "visitor_ack",
        metadata: { conversationId: doc.id },
      });

      await doc.ref.update({
        lastAckEmailAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
