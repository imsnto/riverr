import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { evaluateInsight } from "../lib/brain/evaluate-insight";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Triggers Insight creation ONLY when a conversation is resolved.
 * Deduplicates and enqueues indexing job for Vertex Vector Search.
 */
export const onConversationResolvedForInsight = onDocumentUpdated(
  {
    document: "conversations/{convoId}",
    memory: "1GiB",
  },
  async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    if (!after || !before) return;

    // RULE: Trigger when resolutionStatus transitions to any resolved state
    const RESOLVED = ['resolved', 'resolved_ai', 'resolved_human', 'resolved_user_confirmed'];
    const isNowResolved =
      RESOLVED.includes(after.resolutionStatus) &&
      !RESOLVED.includes(before.resolutionStatus);
    if (!isNowResolved) return;

    const convoId = event.params.convoId;
    const spaceId = after.spaceId;

    try {
      logger.info(`[Intelligence] Conversation ${convoId} resolved. Evaluating for insights...`);

      const messagesSnap = await db.collection("chat_messages")
        .where("conversationId", "==", convoId)
        .where("senderType", "==", "agent")
        .get();

      if (messagesSnap.empty) return;

      for (const msgDoc of messagesSnap.docs) {
        const message = msgDoc.data();

        // Dedupe check
        const existingSnap = await db.collection('insights')
          .where('source.conversationId', '==', convoId)
          .where('source.messageId', '==', msgDoc.id)
          .limit(1)
          .get();

        if (!existingSnap.empty) continue;

        let result;
        try {
          result = await evaluateInsight({
            messageText: message.content,
            conversationContext: `Last Message from Customer: ${after.lastMessage || 'N/A'}`
          });
          logger.info(`[Intelligence] evaluateInsight result for ${msgDoc.id}: shouldCreate=${result.shouldCreateInsight}, reason=${result.reason}, confidence=${result.confidence}`);
        } catch (evalErr: any) {
          logger.error(`[Intelligence] evaluateInsight threw for ${msgDoc.id}:`, evalErr?.message || evalErr);
          continue;
        }

        if (!result.shouldCreateInsight || !result.structuredContent) {
          logger.debug(`[Intelligence] Message ${msgDoc.id} skipped: ${result.reason}`);
          continue;
        }

        const now = new Date().toISOString();
        const signalLevel = result.confidence >= 0.8 ? 'high' : result.confidence >= 0.5 ? 'medium' : 'low';
        const isLowSignal = signalLevel === 'low';

        const insightRef = db.collection("insights").doc();

        const insightData = {
          spaceId,
          hubId: after.hubId || null,
          topicId: null,
          title: result.title || "Support Resolution",
          summary: result.structuredContent.resolution.substring(0, 200),
          content: `Issue: ${result.structuredContent.issue}\nResolution: ${result.structuredContent.resolution}${result.structuredContent.context ? `\nContext: ${result.structuredContent.context}` : ''}`,
          kind: 'support_resolution',
          source: {
            type: 'conversation_message',
            conversationId: convoId,
            messageId: msgDoc.id,
            channel: after.channel || 'webchat',
            provider: null,
            label: null,
          },
          author: {
            userId: message.authorId || null,
            name: after.lastMessageAuthor || null,
          },
          issueLabel: result.issueLabel || null,
          resolutionLabel: result.resolutionLabel || null,
          signalScore: result.confidence,
          signalLevel,
          processingStatus: 'pending',
          groupingStatus: isLowSignal ? 'ignored' : 'ungrouped',
          visibility: 'private',
          origin: 'automatic',
          embeddingStatus: 'pending',
          embeddingModel: null,
          embeddingVersion: null,
          vectorDocId: null,
          embeddingUpdatedAt: null,
          createdAt: now,
          updatedAt: now,
          ingestedAt: now,
        };

        await insightRef.set(insightData);

        await db.collection('brain_jobs').add({
          type: 'process_vector_indexing',
          status: 'pending',
          params: {
            sourceType: 'insight',
            sourceId: insightRef.id,
            spaceId,
            text: insightData.content,
          },
          createdAt: now,
        });

        logger.info(`[Intelligence] Created insight ${insightRef.id} (signalLevel=${signalLevel}, groupingStatus=${insightData.groupingStatus}). Vector job enqueued.`);
      }
    } catch (err: any) {
      logger.error(`[Intelligence] Failed processing for convo ${convoId}:`, err);
    }
  }
);
