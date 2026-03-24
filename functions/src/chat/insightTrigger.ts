
import { onDocumentCreated } from "firebase-functions/v2/firestore";
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
      logger.info("onChatMessageCreatedForInsight: evaluating for insight", { messageId: event.params.messageId });
      
      const result = await evaluateSupportInsight({
        messageText: message.content,
        conversationContext: `Last Message from Customer: ${convo.lastMessage || 'N/A'}`
      });

      if (!result.shouldCreateInsight || !result.structuredContent) {
        logger.debug("onChatMessageCreatedForInsight: rejected by AI", { reason: result.reason });
        return;
      }

      // 3. CREATE INSIGHT
      const now = new Date().toISOString();
      const insightRef = db.collection("insights").doc();
      const spaceId = convo.spaceId || "default";
      
      // Auto-resolve Library
      const libraryQuery = await db.collection("help_centers")
        .where("spaceId", "==", spaceId)
        .where("name", "==", "Support Intelligence")
        .limit(1)
        .get();
      
      let libraryId = "";
      if (libraryQuery.empty) {
        const libRef = await db.collection("help_centers").add({
            spaceId,
            hubId: convo.hubId,
            name: "Support Intelligence",
            visibility: "internal",
            origin: "automatic",
            createdAt: now,
            updatedAt: now
        });
        libraryId = libRef.id;
      } else {
        libraryId = libraryQuery.docs[0].id;
      }

      const structuredText = `
Issue:
${result.structuredContent.issue}

Resolution:
${result.structuredContent.resolution}

Context:
${result.structuredContent.context || 'General'}
      `.trim();

      const insightData: any = {
        spaceId,
        hubId: convo.hubId,
        libraryId,
        title: result.title,
        content: structuredText,
        summary: result.structuredContent.resolution.substring(0, 200) + "...",
        type: 'support_resolution',
        source: {
            type: 'conversation_message',
            messageId: event.params.messageId,
            conversationId,
            channel: convo.channel || 'webchat'
        },
        visibility: 'private',
        origin: 'automatic',
        signalScore: result.confidence,
        processingStatus: 'processing',
        clusteringStatus: 'unclustered',
        createdByUserId: message.authorId,
        createdByName: convo.lastMessageAuthor,
        createdAt: now,
        updatedAt: now,
        ingestedAt: now
      };

      await insightRef.set(insightData);

      // 4. GENERATE EMBEDDING & CLUSTER
      const embedding = await generateDocumentEmbedding(structuredText);
      if (embedding) {
        // Find similar insights for clustering
        const similarQuery = (db.collection('insights') as any)
            .where('spaceId', '==', spaceId)
            .where('processingStatus', '==', 'completed')
            .findNearest({
                vectorField: 'embedding',
                queryVector: admin.firestore.FieldValue.vector(embedding),
                limit: 1,
                distanceMeasure: 'COSINE'
            });
        
        const similarSnap = await similarQuery.get();
        let clusterId = null;

        if (!similarSnap.empty) {
            const topMatch = similarSnap.docs[0];
            const distance = similarSnap.docs[0].get('distance') || 0;
            if (distance < 0.15) { // Similarity > 0.85
                clusterId = topMatch.data().clusterId || null;
            }
        }

        await insightRef.update({
            embedding: admin.firestore.FieldValue.vector(embedding),
            clusterId,
            processingStatus: 'completed',
            clusteringStatus: clusterId ? 'clustered' : 'unclustered'
        });

        if (clusterId) {
            await db.doc(`clusters/${clusterId}`).update({
                insightCount: admin.firestore.FieldValue.increment(1),
                updatedAt: now
            });
        }
      }

    } catch (err: any) {
      logger.error("onChatMessageCreatedForInsight: failed", {
        messageId: event.params.messageId,
        error: err?.message ?? err,
      });
    }
  }
);
