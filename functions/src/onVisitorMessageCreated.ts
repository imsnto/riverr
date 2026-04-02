import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const APP_BASE_URL = defineSecret("APP_BASE_URL");

if (!admin.apps.length) admin.initializeApp();

/**
 * Trigger for Agent PUSH notifications via FCM.
 * Metadata and Email alerts are handled by other triggers for better modularity.
 */
export const onVisitorMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    memory: "512MiB",
    secrets: [APP_BASE_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data() as any;
    if (message.senderType !== "visitor" && message.senderType !== "contact") return;

    const conversationId = message.conversationId;
    if (!conversationId) return;

    const convoRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return;
    const convo = convoSnap.data() as any;

    const assignedAgentIds = convo.assignedAgentIds || (convo.assigneeId ? [convo.assigneeId] : []);
    if (assignedAgentIds.length === 0) return;

    const now = admin.firestore.Timestamp.now();
    const isNewConversation = !convo.startedAt;

    for (const agentId of assignedAgentIds) {
      const agentDoc = await admin.firestore().doc(`users/${agentId}`).get();
      if (!agentDoc.exists) continue;
      const agent = agentDoc.data() as any;
      const prefs = agent.notificationPrefs || { pushEnabled: true, emailEnabled: true };

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
    }
  }
);
