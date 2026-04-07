import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FOLLOW_UP_DELAY_MS   = 5  * 60 * 1000;  // 5 min → send "did that help?"
const AUTO_RESOLVE_DELAY_MS = 15 * 60 * 1000; // 15 min → resolved_ai

/**
 * Runs every 5 minutes.
 * - After 5 min of no visitor reply: sends follow-up "Just checking, did that help?"
 * - After 15 min of no visitor reply: auto-resolves as resolved_ai
 */
export const scheduledAiFollowUp = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    memory: "512MiB",
  },
  async () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Find conversations where the AI follow-up window has elapsed and still unresolved
    const querySnap = await db
      .collection("conversations")
      .where("resolutionStatus", "==", "unresolved")
      .where("aiFollowUpScheduledFor", "<=", nowIso)
      .limit(200)
      .get();

    logger.info(`[AI FollowUp] Processing ${querySnap.size} conversations`);

    for (const docSnap of querySnap.docs) {
      const conv = docSnap.data() as any;
      const conversationId = docSnap.id;

      if (!conv.aiFollowUpScheduledFor) continue;

      const scheduledMs = new Date(conv.aiFollowUpScheduledFor).getTime();
      const elapsedMs = nowMs - scheduledMs;

      try {
        if (elapsedMs >= AUTO_RESOLVE_DELAY_MS) {
          // 15+ min with no reply → auto-resolve
          const now = new Date().toISOString();
          await docSnap.ref.update({
            resolutionStatus: 'resolved_ai',
            resolutionSource: 'system_timeout',
            resolvedAt: now,
            lastResolvedAt: now,
            status: 'closed',
            aiFollowUpScheduledFor: null,
            aiFollowUpSentAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          logger.info(`[AI FollowUp] Auto-resolved ${conversationId} as resolved_ai`);

        } else if (elapsedMs >= FOLLOW_UP_DELAY_MS && !conv.aiFollowUpSentAt) {
          // 5–15 min with no reply → send follow-up message once
          const now = new Date().toISOString();
          await db.collection('chat_messages').add({
            conversationId,
            authorId: 'ai_agent',
            senderType: 'bot',
            type: 'message',
            responderType: 'ai',
            content: "Just checking in — did that help? Let me know if you have any other questions!",
            timestamp: now,
          });
          await docSnap.ref.update({
            aiFollowUpSentAt: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          logger.info(`[AI FollowUp] Sent follow-up message to ${conversationId}`);
        }
      } catch (err: any) {
        logger.error(`[AI FollowUp] Failed for ${conversationId}:`, err?.message);
      }
    }
  }
);
