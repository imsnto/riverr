
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { evaluateSupportInsight } from "../../../src/ai/flows/evaluate-support-insight";
import { generateDocumentEmbedding } from "../../../src/lib/brain/embed";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MIN_LENGTH = 120;
const FILLER_KEYWORDS = [
  "checking", "moment", "hold", "hello", "hi ", "thanks", 
  "looking into", "one sec", "forwarding", "escalating"
];

/**
 * Automatically evaluates every human agent message for Support Intelligence.
 * Note: Initial evaluation happens on message creation, but final ingestion
 * should only happen if the conversation reaches a resolution state.
 */
export const onChatMessageCreatedForInsight = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data() as any;
    
    // 1. HARD FILTERS (Fast Reject)
    if (message.senderType !== "agent") return;
    if (message.type !== "message") return;
    if ((message.content || "").length < MIN_LENGTH) return;
    
    const lowerContent = message.content.toLowerCase();
    if (FILLER_KEYWORDS.some(k => lowerContent.includes(k) && lowerContent.length < 200)) {
        logger.debug("onChatMessageCreatedForInsight: skipping filler message", { messageId: event.params.messageId });
        return;
    }

    const conversationId = message.conversationId;
    const convoSnap = await db.doc(`conversations/${conversationId}`).get();
    if (!convoSnap.exists) return;
    const convo = convoSnap.data() as any;

    try {
      // 2. AI EVALUATION
      logger.info("onChatMessageCreatedForInsight: evaluating for intelligence", { messageId: event.params.messageId });
      
      const result = await evaluateSupportInsight({
        messageText: message.content,
        conversationContext: `Last Message from Customer: ${convo.lastMessage || 'N/A'}`
      });

      if (!result.shouldCreateInsight || !result.structuredContent) {
        logger.debug("onChatMessageCreatedForInsight: rejected by AI", { reason: result.reason });
        return;
      }

      // 3. ENQUEUE INSIGHT (Pending Resolution)
      // We create the insight but mark it as 'pending_resolution'
      const now = new Date().toISOString();
      const insightRef = db.collection("insights").doc();
      const spaceId = convo.spaceId || "default";
      
      const structuredText = `
Issue:
${result.structuredContent.issue}

Resolution:
${result.structuredContent.resolution}

Context:
${result.structuredContent.context || 'General'}

Original Response:
${message.content}
      `.trim();

      const insightData: any = {
        spaceId,
        hubId: convo.hubId,
        title: result.title,
        summary: result.structuredContent.resolution.substring(0, 200) + "...",
        content: structuredText,
        kind: 'support_resolution',
        source: {
            type: 'conversation_message',
            conversationId,
            messageId: event.params.messageId,
            channel: convo.channel || 'webchat'
        },
        author: {
            userId: message.authorId,
            name: convo.lastMessageAuthor
        },
        customer: {
            contactId: convo.contactId || null,
            name: convo.visitorName || null,
            email: convo.visitorEmail || null
        },
        signalScore: result.confidence,
        signalLevel: result.confidence > 0.8 ? 'high' : result.confidence > 0.5 ? 'medium' : 'low',
        processingStatus: 'pending_resolution', // Gated until convo resolved
        groupingStatus: 'ungrouped',
        visibility: 'private',
        origin: 'automatic',
        createdAt: now,
        updatedAt: now,
        ingestedAt: now
      };

      await insightRef.set(insightData);
      logger.info("onChatMessageCreatedForInsight: Created pending insight", { insightId: insightRef.id });

    } catch (err: any) {
      logger.error("onChatMessageCreatedForInsight: failed", {
        messageId: event.params.messageId,
        error: err?.message ?? err,
      });
    }
  }
);

/**
 * Triggers full processing of pending insights when a conversation is resolved.
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
      // Find all pending insights for this conversation
      const pendingSnap = await db.collection("insights")
        .where("source.conversationId", "==", convoId)
        .where("processingStatus", "==", "pending_resolution")
        .get();

      if (pendingSnap.empty) return;

      logger.info(`Processing ${pendingSnap.size} pending insights for resolved convo ${convoId}`);

      for (const insightDoc of pendingSnap.docs) {
        const insight = insightDoc.data();
        
        // 4. GENERATE EMBEDDING & TOPIC MATCHING
        const embedding = await generateDocumentEmbedding(insight.content);
        if (embedding) {
          // Find similar topics for grouping
          const similarQuery = (db.collection('topics') as any)
              .where('spaceId', '==', spaceId)
              .findNearest({
                  vectorField: 'embedding',
                  queryVector: admin.firestore.FieldValue.vector(embedding),
                  limit: 1,
                  distanceMeasure: 'COSINE'
              });
          
          const similarSnap = await similarQuery.get();
          let topicId = null;

          if (!similarSnap.empty) {
              const topMatch = similarSnap.docs[0];
              const distance = similarSnap.docs[0].get('distance') || 0;
              if (distance < 0.15) { // Similarity > 0.85
                  topicId = topMatch.id;
              }
          }

          await insightDoc.ref.update({
              embedding: admin.firestore.FieldValue.vector(embedding),
              topicId,
              processingStatus: 'completed',
              groupingStatus: topicId ? 'grouped' : 'ungrouped',
              updatedAt: new Date().toISOString()
          });

          if (topicId) {
              await db.doc(`topics/${topicId}`).update({
                  insightCount: admin.firestore.FieldValue.increment(1),
                  updatedAt: new Date().toISOString()
              });
          }
        } else {
          await insightDoc.ref.update({ processingStatus: 'failed' });
        }
      }
    } catch (err: any) {
      logger.error("onConversationResolvedForInsight: processing failed", { convoId, error: err?.message });
    }
  }
);
