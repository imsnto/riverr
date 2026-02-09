

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as postmark from 'postmark';
import { gmailAdapter } from '../../src/lib/brain/adapters/gmail';
import { RawConversationNode, SupportIntentNode } from '../../src/lib/data';
import { genkit, type GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { distillSupportIntent } from '../../src/ai/flows/distill-support-intent';
import { extractSalesConversation } from '../../src/ai/flows/distill-sales-intelligence';
import { getTypesenseAdmin } from '../../src/lib/typesense';

admin.initializeApp();

// Initialize genkit for use in this cloud function
const ai = genkit({
  plugins: [googleAI()],
});

// ✅ Use your verified Postmark info
const POSTMARK_API_KEY = 'eed163d1-398a-40f8-b555-8ec1c5a53ae5';
const FROM_EMAIL = 'brad@riverr.app';
const POSTMARK_STREAM = 'defaultTransactional'; // from your "Invite Users (Riverr Project Management)" server
const DOMAIN = 'app.riverr.app'; // your actual frontend domain (must be verified in Postmark)

const postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);

// Cloud Function to send invite email when a new invite is created in Firestore
export const sendInviteEmail = functions.firestore
  .document('invites/{inviteId}')
  .onCreate(async (snap, context) => {
    const invite = snap.data();

    if (!invite?.email || !invite?.token) {
      console.error('Missing email or token in invite document');
      return;
    }

    const inviteLink = `https://${DOMAIN}/invite?token=${invite.token}`;

    try {
      await postmarkClient.sendEmail({
        From: FROM_EMAIL,
        To: invite.email,
        Subject: `You've been invited to join Riverr`,
        HtmlBody: `
          <h2>You’ve been invited to join Riverr Project Management</h2>
          <p>Hello!</p>
          <p>You’ve been invited to join the Riverr workspace. Click the button below to accept your invite and sign in using your Google account:</p>
          <p><a href="${inviteLink}" style="background-color:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;">Accept Invite</a></p>
          <p>If you did not expect this invite, you can safely ignore this email.</p>
        `,
        MessageStream: POSTMARK_STREAM,
      });

      console.log(`✅ Invite email sent to ${invite.email}`);
    } catch (error) {
      console.error(`❌ Error sending invite to ${invite.email}:`, error);
    }
  });

// Cloud Function to process jobs from the Business Brain queue
export const processBrainJob = functions.firestore
  .document('brain_jobs/{jobId}')
  .onCreate(async (snap, context) => {
    const job = snap.data();
    const jobId = context.params.jobId;

    if (!job) {
      console.error(`Job ${jobId} has no data.`);
      return;
    }

    // Update job status to 'running'
    await snap.ref.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      console.log(`🧠 Processing job ${jobId} of type: ${job.type}`);

      // Future logic will go here based on job.type
      switch (job.type) {
        case 'ingest_conversations':
          {
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
          }
          break;
        case 'distill_support_intents':
          {
            console.log('Starting support intent distillation...');
            const rawNodesSnapshot = await admin.firestore().collection('memory_nodes')
                .where('type', '==', 'raw_conversation')
                .where('channel', '==', 'support')
                .where('processedForIntent', '==', null) // Only get unprocessed nodes
                .limit(10) // Process in batches
                .get();

            if (rawNodesSnapshot.empty) {
                console.log('No new support conversations to distill.');
                break;
            }

            console.log(`Found ${rawNodesSnapshot.docs.length} conversations to process.`);
            
            for (const rawDoc of rawNodesSnapshot.docs) {
                const node = rawDoc.data() as RawConversationNode;
                
                try {
                    const result = await distillSupportIntent({
                        conversationText: node.normalized.cleanedText,
                        lastAgentMessage: node.normalized.lastAgentOrRepMessage,
                    });

                    // Check if an intent with this key already exists for the space
                    const intentQuery = admin.firestore().collection('memory_nodes')
                        .where('type', '==', 'support_intent')
                        .where('spaceId', '==', node.spaceId)
                        .where('intentKey', '==', result.intentKey)
                        .limit(1);

                    const intentSnapshot = await intentQuery.get();

                    if (intentSnapshot.empty) {
                        // --- EMBEDDING STEP ---
                        const textForEmbedding = `${result.customerQuestion}\n${result.resolution}`;
                        const { embedding } = await ai.embed({
                            model: 'googleai/embedding-004',
                            content: textForEmbedding,
                        });
                        const embeddedAt = new Date().toISOString();
                        const embeddingModel = "embedding-004";
                        // --- END EMBEDDING ---

                        // --- CREATE NEW INTENT NODE ---
                        const newIntentNode: Omit<SupportIntentNode, 'id'> = {
                            type: 'support_intent',
                            spaceId: node.spaceId,
                            hubId: node.hubId || '',
                            intentKey: result.intentKey,
                            title: result.customerQuestion,
                            description: result.resolution,
                            requiredContext: result.requiredContext,
                            safeAnswerPolicy: result.safetyCriteria,
                            answerVariants: [{
                                variantId: 'default',
                                style: 'professional',
                                template: result.resolution,
                                whenToUse: 'All situations',
                            }],
                            escalationRule: { maxAttempts: 2 },
                            learnedFromNodeIds: [rawDoc.id],
                            confidence: 0.75, // Starting confidence
                            freshnessHalfLifeDays: 365,
                            visibility: 'support_only',
                            embedding,
                            embeddingModel,
                            embeddedAt,
                            textForEmbedding,
                        };
                        
                        await admin.firestore().collection('memory_nodes').add(newIntentNode);
                        console.log(`Created and embedded new intent '${result.intentKey}' from node ${rawDoc.id}.`);

                    } else {
                        // --- UPDATE EXISTING INTENT NODE ---
                        const existingDoc = intentSnapshot.docs[0];
                        const existingIntent = existingDoc.data() as SupportIntentNode;

                        const updates: { [key: string]: any } = {
                            learnedFromNodeIds: admin.firestore.FieldValue.arrayUnion(rawDoc.id),
                        };

                        const resolutionExists = existingIntent.answerVariants.some(v => v.template === result.resolution);
                        
                        if (!resolutionExists) {
                            const newVariant = {
                                variantId: `variant-${Date.now()}`,
                                style: 'professional',
                                template: result.resolution,
                                whenToUse: 'Learned from new example',
                            };
                            updates.answerVariants = admin.firestore.FieldValue.arrayUnion(newVariant);
                        }

                        await existingDoc.ref.update(updates);
                        console.log(`Updated existing intent '${result.intentKey}' with data from node ${rawDoc.id}.`);
                    }

                    // Mark raw node as processed
                    await rawDoc.ref.update({ processedForIntent: true });

                } catch (e: any) {
                    console.error(`Failed to distill intent for node ${rawDoc.id}:`, e.message || e);
                    const error = e as GenkitError;
                    if (error.data?.llmResponse) {
                        console.error("LLM Response:", JSON.stringify(error.data.llmResponse, null, 2));
                    }
                    // Mark as failed to avoid retrying problematic conversations
                    await rawDoc.ref.update({ processedForIntent: 'failed' });
                }
            }
          }
          break;
        case 'distill_sales_intelligence':
          {
            console.log('Starting sales intelligence distillation...');
            const rawNodesSnapshot = await admin.firestore().collection('memory_nodes')
                .where('type', '==', 'raw_conversation')
                .where('channel', '==', 'sales')
                .where('processedForSales', '==', null)
                .limit(10) // Process in batches
                .get();

            if (rawNodesSnapshot.empty) {
                console.log('No new sales conversations to distill.');
                break;
            }

            console.log(`Found ${rawNodesSnapshot.docs.length} sales conversations to process.`);

            for (const rawDoc of rawNodesSnapshot.docs) {
                const node = rawDoc.data() as RawConversationNode;
                
                try {
                    const extraction = await extractSalesConversation({
                        conversationText: node.normalized.cleanedText,
                        participants: node.participants,
                    });
                    
                    // --- EMBED PERSONA TEXT ---
                    const { embedding } = await ai.embed({
                        model: 'googleai/embedding-004',
                        content: extraction.recommendedPersonaClusterText,
                    });
                    const embeddedAt = new Date().toISOString();
                    const embeddingModel = "embedding-004";
                    // --- END EMBEDDING ---

                    const finalExtraction = {
                        ...extraction,
                        spaceId: node.spaceId,
                        sourceNodeId: rawDoc.id,
                        embedding,
                        embeddingModel,
                        embeddedAt
                    };

                    // Save extraction to a separate collection
                    const extractionRef = admin.firestore().collection('sales_extractions').doc();
                    await extractionRef.set(finalExtraction);
                    
                    console.log(`Saved and embedded sales extraction for node ${rawDoc.id}.`);
                    
                    // --- INDEX IN TYPESENSE ---
                    const typesenseClient = getTypesenseAdmin();
                    try {
                        const { leadPersonaHints, ...restOfExtraction } = finalExtraction;
                        const typesenseDoc = {
                            id: extractionRef.id,
                            ...restOfExtraction,
                            industry: leadPersonaHints.industry,
                            role: leadPersonaHints.role,
                            orgSize: leadPersonaHints.orgSize,
                        };
                        await typesenseClient.collections('sales_extractions').documents().create(typesenseDoc);
                        console.log(`Indexed sales extraction ${extractionRef.id} in Typesense.`);
                    } catch (tsError: any) {
                        console.error(`Failed to index extraction ${extractionRef.id} in Typesense:`, tsError.importResults?.[0]?.error || tsError);
                        // We don't fail the whole job for a Typesense error, just log it.
                    }

                    // Mark raw node as processed
                    await rawDoc.ref.update({ processedForSales: true });

                } catch (e: any) {
                    console.error(`Failed to distill sales intelligence for node ${rawDoc.id}:`, e.message || e);
                    const error = e as GenkitError;
                    if (error.data?.llmResponse) {
                        console.error("LLM Response:", JSON.stringify(error.data.llmResponse, null, 2));
                    }
                    // Mark as failed to avoid retrying problematic conversations
                    await rawDoc.ref.update({ processedForSales: 'failed' });
                }
            }
          }
          break;
        case 'cluster_sales_personas':
          {
            console.log(`Starting sales persona clustering for space: ${job.params.spaceId}`);
            // TODO:
            // 1. Fetch all sales_extractions for the spaceId.
            // 2. Run clustering algorithm on embeddings.
            // 3. For each cluster, call LLM to generate summary/name.
            // 4. Upsert sales_persona_segment nodes.
            console.log('Persona clustering logic not yet implemented.');
          }
          break;
        // ... other job types will be added here
        default:
          console.warn(`Unknown job type: ${job.type}`);
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // If successful, update status to 'completed'
      await snap.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Successfully completed job ${jobId}`);

    } catch (error: any) {
      console.error(`❌ Failed to process job ${jobId}:`, error);
      await snap.ref.update({
        status: 'failed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
      });
    }
  });
