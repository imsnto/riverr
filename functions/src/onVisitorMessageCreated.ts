import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { sendSystemEmail } from "./email/sendSystemEmail";

const POSTMARK_SERVER_TOKEN = defineSecret("POSTMARK_SERVER_TOKEN");
const APP_BASE_URL = defineSecret("APP_BASE_URL");

if (!admin.apps.length) admin.initializeApp();

export const onVisitorMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    secrets: [POSTMARK_SERVER_TOKEN, APP_BASE_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data() as any;
    // Step 1: Ignore non-visitor messages
    if (message.senderType !== "visitor" && message.senderType !== "contact") return;

    const conversationId = message.conversationId;
    if (!conversationId) return;

    // Step 2: Load conversation
    const convoRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return;
    const convo = convoSnap.data() as any;

    const assignedAgentIds = convo.assignedAgentIds || (convo.assigneeId ? [convo.assigneeId] : []);
    if (assignedAgentIds.length === 0) return;

    // Step 3: New Conversation Detection
    let isNewConversation = false;
    const now = admin.firestore.Timestamp.now();
    const updates: any = {
      lastVisitorMessageAt: now,
      updatedAt: now.toDate().toISOString(),
    };

    if (!convo.startedAt) {
      updates.startedAt = now;
      isNewConversation = true;
    }
    await convoRef.update(updates);

    // Step 4: For Each Assigned Agent
    for (const agentId of assignedAgentIds) {
      const agentDoc = await admin.firestore().doc(`users/${agentId}`).get();
      if (!agentDoc.exists) continue;
      const agent = agentDoc.data() as any;
      const prefs = agent.notificationPrefs || { pushEnabled: true, emailEnabled: true };

      // Step 5: Push Notification Logic
      if (prefs.pushEnabled) {
        const cooldownKey = `agent:${agentId}|conv:${conversationId}|channel:push`;
        const cooldownRef = admin.firestore().doc(`notification_cooldowns/${cooldownKey}`);
        const cooldownSnap = await cooldownRef.get();
        const lastSent = cooldownSnap.exists ? cooldownSnap.data()?.lastSentAt?.toDate() : null;
        const cooldownExpired = !lastSent || (now.toDate().getTime() - lastSent.getTime()) > 2 * 60 * 1000;

        if (isNewConversation || cooldownExpired) {
          const tokensSnap = await admin.firestore().collection(`users/${agentId}/pushTokens`).where("enabled", "==", true).get();
          const tokens = tokensSnap.docs.map(d => d.data().token);

          if (tokens.length > 0) {
            const payload = {
              notification: {
                title: "New message from visitor",
                body: message.content?.substring(0, 120) || "Sent an attachment",
              },
              data: {
                conversationId,
                messageId: event.params.messageId,
                url: `${APP_BASE_URL.value()}/space/${convo.spaceId || 'default'}/hub/${convo.hubId}/inbox?conversationId=${conversationId}`
              },
              tokens,
            };

            const response = await admin.messaging().sendEachForMulticast(payload);
            
            // Token cleanup
            if (response.failureCount > 0) {
              const batch = admin.firestore().batch();
              response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  const error = resp.error as any;
                  if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
                    const tokenDoc = tokensSnap.docs[idx].ref;
                    batch.update(tokenDoc, { enabled: false });
                  }
                }
              });
              await batch.commit();
            }

            await cooldownRef.set({ lastSentAt: now });
          }
        }
      }

      // Step 6: Email Notification Logic
      if (prefs.emailEnabled && agent.email) {
        const cooldownKey = `agent:${agentId}|conv:${conversationId}|channel:email`;
        const cooldownRef = admin.firestore().doc(`notification_cooldowns/${cooldownKey}`);
        const cooldownSnap = await cooldownRef.get();
        const lastSent = cooldownSnap.exists ? cooldownSnap.data()?.lastSentAt?.toDate() : null;
        const cooldownExpired = !lastSent || (now.toDate().getTime() - lastSent.getTime()) > 10 * 60 * 1000;

        if (isNewConversation || cooldownExpired) {
          const chatUrl = `${APP_BASE_URL.value()}/space/${convo.spaceId || 'default'}/hub/${convo.hubId}/inbox?conversationId=${conversationId}`;
          
          await sendSystemEmail({
            to: agent.email,
            subject: "New chat message in Manowar",
            orgId: convo.spaceId,
            tag: "agent_alert",
            metadata: { conversationId, agentId },
            htmlBody: `
              <div style="font-family: sans-serif; line-height: 1.5;">
                <h3>New message from a visitor</h3>
                <p><b>${convo.visitorName || 'Visitor'}:</b> ${message.content?.substring(0, 500) || '<i>Sent an attachment</i>'}</p>
                <p><a href="${chatUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">View Conversation</a></p>
                <p style="color: #777; font-size: 12px;">Sent at ${now.toDate().toLocaleString()}</p>
              </div>
            `,
          });

          await cooldownRef.set({ lastSentAt: now });
        }
      }
    }
  }
);
