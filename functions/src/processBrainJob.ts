import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { distillSupportIntent } from "../../src/ai/flows/distill-support-intent";
import { extractSalesConversation } from "../../src/ai/flows/distill-sales-intelligence";
import { summarizeSalesCluster } from "../../src/ai/flows/summarize-sales-cluster";
import { recommendNextSalesAction } from "../../src/ai/flows/recommend-next-sales-action";
import { RawConversationNode, SupportIntentNode, SalesPersonaSegmentNode, LeadStateNode } from "../../src/lib/data";
import { gmailAdapter } from "../../src/lib/brain/adapters/gmail";

if (!admin.apps.length) admin.initializeApp();

const ai = genkit({
  plugins: [googleAI()],
});

export const processBrainJob = onDocumentCreated("brain_jobs/{jobId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const job = snap.data() as any;
  const jobId = event.params.jobId;

  await snap.ref.update({
    status: "running",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    switch (job.type) {
      case "ingest_conversations": {
        console.log(`Starting conversation ingestion for source: ${job.params.source}`);
        if (job.params.source !== 'gmail') {
            throw new Error(`Unsupported ingestion source: ${job.params.source}`);
        }

        const rawThreads = await gmailAdapter.fetchBatch({ query: job.params.query, maxResults: 50 });
        const batch = admin.firestore().batch();
        let processedCount = 0;

        for (const rawThread of rawThreads) {
            const normalizedThread = gmailAdapter.normalize(rawThread);
            const rawNode = gmailAdapter.toRawNode(normalizedThread);

            // --- REAL EMBEDDING STEP ---
            const { embedding } = await ai.embed({
                model: 'googleai/embedding-004',
                content: rawNode.textForEmbedding,
            });
            const embeddedAt = new Date().toISOString();
            const embeddingModel = "embedding-004";
            // --- END REAL EMBEDDING ---

            const finalNode: Omit<RawConversationNode, 'id'> = {
                ...(rawNode as Omit<RawConversationNode, 'id'>),
                spaceId: job.params.spaceId,
                embedding: embedding,
                embeddingModel: embeddingModel,
                embeddedAt: embeddedAt,
            };
            
            const nodeRef = admin.firestore().collection('memory_nodes').doc();
            batch.set(nodeRef, finalNode);
            processedCount++;
        }
        
        await batch.commit();
        console.log(`Ingested and embedded ${processedCount} conversation(s).`);
        break;
      }

      case "distill_support_intents": {
        const rawNodesSnap = await admin.firestore().collection("memory_nodes")
          .where("type", "==", "raw_conversation")
          .where("channel", "==", "support")
          .where("processedForIntent", "==", null)
          .limit(10)
          .get();

        for (const doc of rawNodesSnap.docs) {
          const node = doc.data() as RawConversationNode;
          const result = await distillSupportIntent({
            conversationText: node.normalized.cleanedText,
            lastAgentMessage: node.normalized.lastAgentOrRepMessage,
          });

          const intentRef = admin.firestore().collection("memory_nodes").doc();
          await intentRef.set({
            type: "support_intent",
            spaceId: node.spaceId,
            hubId: node.hubId || "",
            intentKey: result.intentKey,
            title: result.customerQuestion,
            description: result.resolution,
            learnedFromNodeIds: [doc.id],
            answerVariants: [{ variantId: "default", template: result.resolution }],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await doc.ref.update({ processedForIntent: true });
        }
        break;
      }

      case "distill_sales_intelligence": {
        const rawNodesSnap = await admin.firestore().collection("memory_nodes")
          .where("type", "==", "raw_conversation")
          .where("channel", "==", "sales")
          .where("processedForSales", "==", null)
          .limit(10)
          .get();

        for (const doc of rawNodesSnap.docs) {
          const node = doc.data() as RawConversationNode;
          const extraction = await extractSalesConversation({
            conversationText: node.normalized.cleanedText,
            participants: node.participants as any,
          });

          await admin.firestore().collection("sales_extractions").add({
            ...extraction,
            spaceId: node.spaceId,
            sourceNodeId: doc.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await doc.ref.update({ processedForSales: true });
        }
        break;
      }

      case "cluster_sales_personas": {
        const extractionsSnap = await admin.firestore().collection("sales_extractions")
          .where("spaceId", "==", job.params.spaceId)
          .limit(50)
          .get();

        const extractions = extractionsSnap.docs.map(d => d.data());
        const result = await summarizeSalesCluster({
          aggregatedPains: extractions.flatMap(e => e.pains),
          aggregatedObjections: extractions.flatMap(e => e.objections),
          aggregatedBuyingSignals: extractions.flatMap(e => e.buyingSignals),
          examplePersonas: extractions.map(e => e.recommendedPersonaClusterText),
        });

        await admin.firestore().collection("memory_nodes").add({
          type: "sales_persona_segment",
          spaceId: job.params.spaceId,
          ...result,
          learnedFromNodeIds: extractionsSnap.docs.map(d => d.id),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        break;
      }

      case "update_lead_states": {
        const contactsSnap = await admin.firestore().collection("contacts")
          .where("spaceId", "==", job.params.spaceId)
          .limit(20)
          .get();

        for (const contactDoc of contactsSnap.docs) {
          const contact = contactDoc.data();
          const extractionsSnap = await admin.firestore().collection("sales_extractions")
            .where("spaceId", "==", job.params.spaceId)
            .limit(5)
            .get();

          const bestExtraction = extractionsSnap.docs[0]?.data();
          const personaSnap = await admin.firestore().collection("memory_nodes")
            .where("type", "==", "sales_persona_segment")
            .where("spaceId", "==", job.params.spaceId)
            .limit(1)
            .get();

          const result = await recommendNextSalesAction({
            lead: { id: contactDoc.id, name: contact.name, company: contact.company },
            matchedPersona: personaSnap.docs[0]?.data() as any,
          });

          await admin.firestore().collection("memory_nodes").doc(`lead_state_${contactDoc.id}`).set({
            type: "lead_state",
            spaceId: job.params.spaceId,
            leadId: contactDoc.id,
            ...result,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
        break;
      }
    }

    await snap.ref.update({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Job failed:", error);
    await snap.ref.update({
      status: "failed",
      error: error.message,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
