
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { evaluateSupportInsight } from "../../../src/ai/flows/evaluate-support-insight";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * PRODUCTION GATED INGESTION:
 * Triggers Insight creation ONLY when a conversation is resolved.
 * This refactor moves heavy vector processing to a separate job queue.
 */
export const onConversationResolvedForInsight = onDocumentUpdated(
  {
    document: "conversations/{convoId}",
  },
  async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    if (!after || !before) return;

    // RULE: Only trigger when resolutionStatus transitions to 'resolved'
    const isNowResolved = after.resolutionStatus === 'resolved' && before.resolutionStatus !== 'resolved';
    if (!isNowResolved) return;

    const convoId = event.params.convoId;
    const spaceId = after.spaceId;

    try {
      logger.info(`[Intelligence] Conversation ${convoId} resolved. Evaluating for insights...`);

      // 1. Fetch agent messages (the source of knowledge)
      const messagesSnap = await db.collection("chat_messages")
        .where("conversationId", "==", convoId)
        .where("senderType", "==", "agent")
        .get();

      if (messagesSnap.empty) return;

      for (const msgDoc of messagesSnap.docs) {
        const message = msgDoc.data();
        
        // 2. AI EVALUATION: Extract structured reusable finding
        const result = await evaluateSupportInsight({
          messageText: message.content,
          conversationContext: `Last Message from Customer: ${after.lastMessage || 'N/A'}`
        });

        if (!result.shouldCreateInsight || !result.structuredContent) {
          logger.debug(`[Intelligence] Message ${msgDoc.id} skipped: ${result.reason}`);
          continue;
        }

        // 3. PERSIST CANONICAL INSIGHT (Private & Pending)
        const now = new Date().toISOString();
        const insightRef = db.collection("insights").doc();
        
        const insightData = {
          spaceId,
          hubId: after.hubId,
          title: result.title || "Support Resolution",
          summary: result.structuredContent.resolution.substring(0, 200) + "...",
          content: `Issue: ${result.structuredContent.issue}\nResolution: ${result.structuredContent.resolution}`,
          kind: 'support_resolution',
          source: {
              type: 'conversation_message',
              conversationId: convoId,
              messageId: msgDoc.id,
              channel: after.channel || 'webchat'
          },
          author: {
              userId: message.authorId,
              name: after.lastMessageAuthor
          },
          signalScore: result.confidence,
          signalLevel: result.confidence > 0.8 ? 'high' : result.confidence > 0.5 ? 'medium' : 'low',
          processingStatus: 'pending',
          groupingStatus: 'ungrouped',
          visibility: 'private',
          origin: 'automatic',
          embeddingStatus: 'pending',
          embeddingModel: 'text-embedding-004',
          embeddingVersion: 'v2',
          createdAt: now,
          updatedAt: now,
          ingestedAt: now
        };

        await insightRef.set(insightData);
        
        // 4. ENQUEUE VECTOR INDEXING JOB
        await db.collection('brain_jobs').add({
          type: 'process_vector_indexing',
          status: 'pending',
          params: {
            sourceType: 'insight',
            sourceId: insightRef.id,
            spaceId: spaceId,
            text: insightData.content
          },
          createdAt: now
        });

        logger.info(`[Intelligence] Created canonical insight ${insightRef.id}. Vector job enqueued.`);
      }
    } catch (err: any) {
      logger.error(`[Intelligence] Failed processing for convo ${convoId}:`, err);
    }
  }
);
