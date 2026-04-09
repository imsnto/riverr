import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { evaluateInsightBatch } from "../lib/brain/evaluate-insight";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Triggers Insight creation ONLY when a conversation is resolved.
 * Sends all human agent messages in a single batch LLM call.
 * Skips conversations that have already been processed.
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

      // Dedupe: skip if this conversation was already processed
      const alreadyProcessed = await db.collection('insights')
        .where('source.conversationId', '==', convoId)
        .limit(1)
        .get();

      if (!alreadyProcessed.empty) {
        logger.info(`[Intelligence] Conversation ${convoId} already has insights. Skipping.`);
        return;
      }

      // Fetch human agent messages only (exclude AI messages)
      const messagesSnap = await db.collection("chat_messages")
        .where("conversationId", "==", convoId)
        .where("senderType", "==", "agent")
        .get();

      if (messagesSnap.empty) return;

      const humanMessages = messagesSnap.docs.filter(
        doc => doc.data().authorId !== 'ai_agent'
      );

      if (humanMessages.length === 0) {
        logger.info(`[Intelligence] No human agent messages found for ${convoId}. Skipping.`);
        return;
      }

      // Build conversation context from visitor questions
      const visitorMessagesSnap = await db.collection("chat_messages")
        .where("conversationId", "==", convoId)
        .where("senderType", "in", ["visitor", "contact"])
        .get();

      const visitorQuestions = visitorMessagesSnap.docs
        .sort((a, b) => {
          const aTime = a.data().timestamp || '';
          const bTime = b.data().timestamp || '';
          return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
        })
        .map(d => d.data().content as string)
        .filter(Boolean)
        .slice(-5)
        .join(' | ');

      const conversationContext = [
        'NOTE: This conversation was escalated to a human agent because the AI could not fully resolve the issue.',
        `Customer questions: ${visitorQuestions || after.lastMessage || 'N/A'}`,
      ].join('\n');

      // Single batch LLM call for all human messages
      const batchMessages = humanMessages.map((doc, i) => ({
        index: i,
        messageId: doc.id,
        text: doc.data().content as string,
      }));

      logger.info(`[Intelligence] Sending ${batchMessages.length} human messages to batch evaluator for ${convoId}`);

      const results = await evaluateInsightBatch({
        messages: batchMessages,
        conversationContext,
      });

      const now = new Date().toISOString();

      for (const result of results) {
        if (!result.shouldCreateInsight || !result.structuredContent) {
          logger.debug(`[Intelligence] Message index ${result.messageIndex} skipped: ${result.reason}`);
          continue;
        }

        const msgDoc = humanMessages[result.messageIndex];
        if (!msgDoc) continue;

        const message = msgDoc.data();
        const signalLevel = result.confidence >= 0.8 ? 'high' : result.confidence >= 0.5 ? 'medium' : 'low';
        const isLowSignal = signalLevel === 'low';

        const insightRef = db.collection("insights").doc();

        const insightData = {
          spaceId,
          hubId: after.hubId || null,
          topicId: null,
          title: result.title || "Support Resolution",
          summary: result.structuredContent.resolution.substring(0, 200),
          content: message.content,
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

        logger.info(`[Intelligence] Created insight ${insightRef.id} (signalLevel=${signalLevel}). Vector job enqueued.`);
      }
    } catch (err: any) {
      logger.error(`[Intelligence] Failed processing for convo ${convoId}:`, err);
    }
  }
);
