

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as postmark from 'postmark';
import { gmailAdapter } from '../../src/lib/brain/adapters/gmail';
import { RawConversationNode, SalesMessagePatternNode, SalesPersonaSegmentNode, SupportIntentNode, Contact, LeadStateNode } from '../../src/lib/data';
import { genkit, type GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { distillSupportIntent } from '../../src/ai/flows/distill-support-intent';
import { extractSalesConversation } from '../../src/ai/flows/distill-sales-intelligence';
import { getTypesenseAdmin, getTypesenseSearch } from '../../src/lib/typesense';
import { summarizeSalesCluster } from '../../src/ai/flows/summarize-sales-cluster';
import { createHash } from 'crypto';
import { recommendNextSalesAction } from '../../src/ai/flows/recommend-next-sales-action';


admin.initializeApp();

// Initialize genkit for use in this cloud function
const ai = genkit({
  plugins: [googleAI()],
});

// --- Helper Functions for Step 5C ---
function classifyCTA(cta: string): 'question'|'calendar_link'|'value_offer'|'soft_close'|'hard_close'|'other' {
    const c = cta.toLowerCase();
    if (c.includes('book.com') || c.includes('calendar.com') || c.includes('schedule a call')) return 'calendar_link';
    if (c.endsWith('?')) return 'question';
    if (c.includes('check out') || c.includes('learn more') || c.includes('download')) return 'value_offer';
    if (c.includes('let me know your thoughts') || c.includes('worth exploring?')) return 'soft_close';
    if (c.includes('sign up now') || c.includes('buy now')) return 'hard_close';
    return 'other';
}

function classifyOpener(opener: string): 'personal'|'pain'|'compliment'|'reference'|'straight_ask'|'other' {
    const o = opener.toLowerCase();
    if (o.includes('saw your post') || o.includes('noticed your background')) return 'personal';
    if (o.includes('congrats on') || o.includes('impressed by')) return 'compliment';
    if (o.includes('spoke with') || o.includes('was referred by')) return 'reference';
    if (o.includes('struggling with') || o.includes('problem of')) return 'pain';
    if (o.includes('are you responsible for') || o.includes('quick question about')) return 'straight_ask';
    return 'other';
}

function generatePatternKey(message: any): string {
    const signature = {
        purpose: message.purpose,
        bodyStructure: message.bodyStructure,
        ctaStyle: classifyCTA(message.cta),
        openerStyle: classifyOpener(message.opener),
        toneTagsSorted: [...message.toneTags].sort(),
        lengthBucket: message.lengthBucket
    };
    const hash = createHash('sha256');
    hash.update(JSON.stringify(signature));
    return hash.digest('hex').substring(0, 16);
}


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
export const processBrainJob = functions.runWith({ memory: '1GB', timeoutSeconds: 300 }).firestore
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
                    channel: job.params.channel,
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
                    
                    // --- STEP 5C: Process outbound messages for pattern analysis ---
                    const isSuccess = extraction.outcome === 'replied_positive' || extraction.outcome === 'meeting_booked';

                    for (const outboundMsg of extraction.outboundMessages) {
                        const patternKey = generatePatternKey(outboundMsg);
                        const patternRef = admin.firestore().collection('memory_nodes').doc(`pattern-${patternKey}`);

                        await admin.firestore().runTransaction(async (transaction) => {
                            const patternDoc = await transaction.get(patternRef);

                            if (!patternDoc.exists) {
                                const newPatternNode: Omit<SalesMessagePatternNode, 'id'> = {
                                    type: 'sales_message_pattern',
                                    spaceId: node.spaceId,
                                    patternKey: patternKey,
                                    pattern: {
                                        purpose: outboundMsg.purpose,
                                        bodyStructure: outboundMsg.bodyStructure,
                                        ctaStyle: classifyCTA(outboundMsg.cta),
                                        openerStyle: classifyOpener(outboundMsg.opener),
                                        toneTagsSorted: [...outboundMsg.toneTags].sort(),
                                        lengthBucket: outboundMsg.lengthBucket,
                                    },
                                    performance: {
                                        sampleSize: 1,
                                        successCount: isSuccess ? 1 : 0,
                                        replyRate: isSuccess ? 1 : 0,
                                    },
                                    learnedFromNodeIds: [rawDoc.id],
                                    confidence: 0.5,
                                    freshnessHalfLifeDays: 90,
                                    visibility: 'sales_only',
                                };
                                transaction.set(patternRef, newPatternNode);
                            } else {
                                const existingData = patternDoc.data() as SalesMessagePatternNode;
                                const newSampleSize = (existingData.performance.sampleSize || 0) + 1;
                                const newSuccessCount = (existingData.performance.successCount || 0) + (isSuccess ? 1 : 0);
                                const newReplyRate = newSuccessCount / newSampleSize;

                                transaction.update(patternRef, {
                                    'performance.sampleSize': newSampleSize,
                                    'performance.successCount': newSuccessCount,
                                    'performance.replyRate': newReplyRate,
                                    'learnedFromNodeIds': admin.firestore.FieldValue.arrayUnion(rawDoc.id),
                                });
                            }
                        });
                    }
                    console.log(`Processed ${extraction.outboundMessages.length} outbound messages for pattern analysis.`);


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
            // 1. Fetch all sales_extractions for the spaceId.
            const extractionsSnapshot = await admin.firestore().collection('sales_extractions')
                .where('spaceId', '==', job.params.spaceId)
                .get();

            if (extractionsSnapshot.empty) {
                console.log('No sales extractions found to cluster for this space.');
                break;
            }
            const extractions = extractionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
            console.log(`Found ${extractions.length} extractions to cluster.`);

            // A simple clustering approach: group by a composite key of industry and role.
            const groupedByPersona = new Map<string, any[]>();
            extractions.forEach(e => {
                const industry = e.leadPersonaHints?.industry || 'unknown';
                const role = e.leadPersonaHints?.role || 'unknown';
                const key = `${industry}-${role}`.toLowerCase();
                
                if (!groupedByPersona.has(key)) {
                    groupedByPersona.set(key, []);
                }
                groupedByPersona.get(key)!.push(e);
            });

            const clusters = Array.from(groupedByPersona.values());

            console.log(`Created ${clusters.length} cluster(s) based on industry and role.`);
            
            // 3. For each cluster, call LLM to generate summary/name.
            for (const cluster of clusters) {
                if (cluster.length === 0) continue;

                const aggregatedPains = cluster.flatMap(e => e.pains || []);
                const aggregatedObjections = cluster.flatMap(e => e.objections || []);
                const aggregatedBuyingSignals = cluster.flatMap(e => e.buyingSignals || []);
                const examplePersonas = cluster.map(e => e.recommendedPersonaClusterText).slice(0, 10); // Limit examples

                const summary = await summarizeSalesCluster({
                    aggregatedPains,
                    aggregatedObjections,
                    aggregatedBuyingSignals,
                    examplePersonas,
                });
                
                const textForEmbedding = `${summary.segmentKey}: ${summary.summary}. Pains: ${summary.commonPains.join(', ')}. Winning Angles: ${summary.winningAngles.join(', ')}`;
                const { embedding } = await ai.embed({
                    model: 'googleai/embedding-004',
                    content: textForEmbedding,
                });
                const embeddedAt = new Date().toISOString();
                const embeddingModel = "embedding-004";

                // 4. Upsert sales_persona_segment nodes.
                const segmentQuery = admin.firestore().collection('memory_nodes')
                    .where('type', '==', 'sales_persona_segment')
                    .where('spaceId', '==', job.params.spaceId)
                    .where('segmentKey', '==', summary.segmentKey)
                    .limit(1);
                
                const segmentSnapshot = await segmentQuery.get();
                
                const learnedFromNodeIds = cluster.map(e => e.sourceNodeId);

                if (segmentSnapshot.empty) {
                    const newSegmentNode: Omit<SalesPersonaSegmentNode, 'id'> = {
                        type: 'sales_persona_segment',
                        spaceId: job.params.spaceId,
                        segmentKey: summary.segmentKey,
                        summary: summary.summary,
                        commonPains: summary.commonPains,
                        commonObjections: summary.commonObjections,
                        winningAngles: summary.winningAngles,
                        exampleLines: { openers: [], proofPoints: [], ctas: [] }, // Placeholder
                        learnedFromNodeIds: learnedFromNodeIds,
                        confidence: 0.75,
                        freshnessHalfLifeDays: 120,
                        visibility: 'sales_only',
                        embedding,
                        embeddingModel,
                        embeddedAt,
                        textForEmbedding,
                    };
                    await admin.firestore().collection('memory_nodes').add(newSegmentNode);
                    console.log(`Created new persona segment: ${summary.segmentKey}`);
                } else {
                    const existingDoc = segmentSnapshot.docs[0];
                    await existingDoc.ref.update({
                        summary: summary.summary, // Overwrite with latest summary
                        commonPains: summary.commonPains,
                        commonObjections: summary.commonObjections,
                        winningAngles: summary.winningAngles,
                        learnedFromNodeIds: admin.firestore.FieldValue.arrayUnion(...learnedFromNodeIds),
                        embedding,
                        embeddingModel,
                        embeddedAt,
                        textForEmbedding,
                    });
                    console.log(`Updated existing persona segment: ${summary.segmentKey}`);
                }
            }
          }
          break;
        case 'update_lead_states':
          {
            console.log(`Starting lead state generation/update for space: ${job.params.spaceId}`);
            const spaceId = job.params.spaceId;
            const typesenseClient = getTypesenseSearch();

            // 1. Fetch leads (contacts) for the space.
            const leadsSnapshot = await admin.firestore().collection('contacts').where('spaceId', '==', spaceId).get();
            const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Contact }));

            if (leads.length === 0) {
              console.log('No leads found for this space.');
              break;
            }
            console.log(`Found ${leads.length} leads to process.`);

            // 2. Fetch all sales persona segments with embeddings for this space.
            const personasSnapshot = await admin.firestore().collection('memory_nodes')
                .where('spaceId', '==', spaceId)
                .where('type', '==', 'sales_persona_segment')
                .get();
            const personas = personasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as SalesPersonaSegmentNode }));
            if (personas.length === 0) {
                console.log("No sales personas found. Cannot match leads.");
                break;
            }

             // 3. Fetch the best performing message pattern
            const patternsSnapshot = await admin.firestore().collection('memory_nodes')
                .where('spaceId', '==', spaceId)
                .where('type', '==', 'sales_message_pattern')
                .orderBy('performance.replyRate', 'desc')
                .limit(1).get();
            const bestPattern = patternsSnapshot.empty ? null : patternsSnapshot.docs[0].data() as SalesMessagePatternNode;
            
            // 4. For each lead, find matching persona and recommend next action.
            for (const lead of leads) {
                try {
                    // a. Create a text representation of the lead for embedding
                    const leadText = `Lead: ${lead.name || 'Unknown'}. Email: ${lead.primaryEmail || 'none'}. Company: ${lead.company || 'unknown'}.`;
                    
                    // b. Generate embedding for the lead
                    const { embedding: leadEmbedding } = await ai.embed({
                        model: 'googleai/embedding-004',
                        content: leadText,
                    });

                    // c. Find matching persona via vector search in Typesense
                    let matchedPersona: SalesPersonaSegmentNode | null = null;
                    try {
                        const searchRequest = {
                            'searches': [{
                                'collection': 'memory_nodes',
                                'q': '*',
                                'vector_query': `embedding:(${JSON.stringify(leadEmbedding)}, k:1)`,
                                'filter_by': `spaceId:=${spaceId} && type:='sales_persona_segment'`
                            }]
                        };
                        const searchResult = await typesenseClient.multiSearch.perform(searchRequest, {});
                        const hits = searchResult.results[0]?.hits;

                        if (hits && hits.length > 0) {
                            matchedPersona = hits[0].document as SalesPersonaSegmentNode;
                        }
                    } catch (e: any) {
                        if (e.httpStatus === 404) {
                            console.warn(`Typesense search failed for lead ${lead.id}: collection not found. Skipping persona match.`);
                        } else {
                            // Don't fail the whole job, just log the error for this lead.
                            console.error(`Error during Typesense search for lead ${lead.id}:`, e.message || e);
                        }
                    }
                    
                    // d. Recommend next best action and message pattern.
                    const recommendation = await recommendNextSalesAction({
                        lead: {
                            id: lead.id,
                            name: lead.name || undefined,
                            company: lead.company || undefined,
                            primaryEmail: lead.primaryEmail || undefined,
                            lastSeenAt: lead.lastSeenAt ? new Date(lead.lastSeenAt.seconds * 1000).toISOString() : undefined
                        },
                        matchedPersona: matchedPersona ? {
                            segmentKey: matchedPersona.segmentKey,
                            summary: matchedPersona.summary,
                            commonPains: matchedPersona.commonPains,
                            winningAngles: matchedPersona.winningAngles,
                        } : undefined,
                        bestMessagePattern: bestPattern ? {
                            patternKey: bestPattern.patternKey,
                            purpose: bestPattern.pattern.purpose,
                            bodyStructure: bestPattern.pattern.bodyStructure,
                            ctaStyle: bestPattern.pattern.ctaStyle,
                            openerStyle: bestPattern.pattern.openerStyle,
                            toneTagsSorted: bestPattern.pattern.toneTagsSorted,
                        } : undefined
                    });

                    // e. Upsert LeadStateNode.
                    const leadStateRef = admin.firestore().collection('lead_states').doc(lead.id);
                    const leadStateData: LeadStateNode = {
                        id: lead.id,
                        spaceId: spaceId,
                        type: 'lead_state',
                        leadId: lead.id,
                        status: 'contacted', // Assuming we are recommending an action.
                        warmScore: matchedPersona ? 75 : 25, // simple scoring
                        matchedPersonaSegmentKey: matchedPersona?.segmentKey,
                        recommendedNextAction: recommendation.recommendedNextAction,
                        recommendedPatternKey: recommendation.recommendedPatternKey,
                        reasons: [recommendation.reason],
                        updatedAt: new Date().toISOString(),
                        visibility: 'sales_only',
                    };
                    await leadStateRef.set(leadStateData, { merge: true });
                    console.log(`Updated lead state for ${lead.id} (${lead.name}). Recommended: ${recommendation.recommendedNextAction}`);

                } catch (e: any) {
                    console.error(`Failed to process lead ${lead.id}:`, e.message || e);
                }
            }

          }
          break;
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








