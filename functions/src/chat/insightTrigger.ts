
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { evaluateSupportInsight } from "../../../src/ai/flows/evaluate-support-insight";
import { generateDocumentEmbedding } from "../../../src/lib/brain/embed";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Triggers full processing of Insights ONLY when a conversation is resolved.
 * Gated by the Resolution System to ensure high-signal learning.
 */
export const onConversationResolvedForInsight = onDocumentUpdated(
  {
    document: "conversations/{convoId}",
  },
  async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    if (!after || !before) return;

    // RULE: Only trigger when resolutionStatus changes to 'resolved'
    const isNowResolved = after.resolutionStatus === 'resolved' && before.resolutionStatus !== 'resolved';
    if (!isNowResolved) return;

    const convoId = event.params.convoId;
    const spaceId = after.spaceId;

    try {
      logger.info(`[Insight] Conversation ${convoId} resolved. Scanning for high-signal answers...`);

      // 1. Fetch conversation messages
      const messagesSnap = await db.collection("chat_messages")
        .where("conversationId", "==", convoId)
        .where("senderType", "==", "agent")
        .get();

      if (messagesSnap.empty) return;

      for (const msgDoc of messagesSnap.docs) {
        const message = msgDoc.data();
        
        // 2. AI EVALUATION (Creation Rules)
        const result = await evaluateSupportInsight({
          messageText: message.content,
          conversationContext: `Last Message from Customer: ${after.lastMessage || 'N/A'}`
        });

        if (!result.shouldCreateInsight || !result.structuredContent) {
          logger.debug(`[Insight] Rejected message ${msgDoc.id} by AI: ${result.reason}`);
          continue;
        }

        // 3. GENERATE V2 EMBEDDING (text-embedding-004)
        const combinedText = `Issue: ${result.structuredContent.issue}\nResolution: ${result.structuredContent.resolution}`;
        const embedding = await generateDocumentEmbedding(combinedText);

        if (!embedding) {
          logger.error(`[Insight] Embedding failed for message ${msgDoc.id}`);
          continue;
        }

        // 4. PERSIST STRUCTURED INSIGHT
        const now = new Date().toISOString();
        const insightRef = db.collection("insights").doc();
        
        const insightData = {
          spaceId,
          hubId: after.hubId,
          title: result.title || "Support Resolution",
          summary: result.structuredContent.resolution.substring(0, 200) + "...",
          content: combinedText,
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
          processingStatus: 'completed',
          groupingStatus: 'ungrouped',
          visibility: 'private',
          origin: 'automatic',
          embeddingStatus: 'ready',
          embeddingModel: 'text-embedding-004',
          embeddingVersion: 'v2',
          embedding: admin.firestore.FieldValue.vector(embedding),
          createdAt: now,
          updatedAt: now,
          ingestedAt: now
        };

        await insightRef.set(insightData);
        logger.info(`[Insight] Created v2 embedded insight: ${insightRef.id}`);

        // 5. TOPIC MATCHING (Vertex-Backed)
        // Note: Topic matching logic is triggered in a separate background loop 
        // to maintain transaction speed and decoupling.
      }
    } catch (err: any) {
      logger.error(`[Insight] Failed processing for convo ${convoId}:`, err);
    }
  }
);
