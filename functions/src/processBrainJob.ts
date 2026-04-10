import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { IndexServiceClient, protos } from '@google-cloud/aiplatform';
import { generateDocumentEmbedding, generateQueryEmbedding } from './lib/brain/embed';
import { queryVertexNeighbors } from './lib/brain/vertex-query';
import { GoogleGenAI } from '@google/genai';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const VECTOR_INDEX_RESOURCE_NAME = process.env.VERTEX_VECTOR_INDEX_RESOURCE_NAME || '';
const VECTOR_INDEX_NUMERIC_ID = process.env.VERTEX_AI_INDEX_ID || '';
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';

let indexClientInstance: IndexServiceClient | null = null;
function getIndexClient(): IndexServiceClient {
  if (!indexClientInstance) {
    indexClientInstance = new IndexServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });
  }
  return indexClientInstance;
}

let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

function resolveIndexResourceName(): string {
  if (VECTOR_INDEX_NUMERIC_ID && GCP_PROJECT) {
    const computed = `projects/${GCP_PROJECT}/locations/${location}/indexes/${VECTOR_INDEX_NUMERIC_ID}`;
    const configured = VECTOR_INDEX_RESOURCE_NAME.trim();
    if (configured && configured !== computed) {
      logger.warn('VERTEX_VECTOR_INDEX_RESOURCE_NAME differs from computed index resource; using VERTEX_AI_INDEX_ID value instead.', {
        configured,
        computed,
      });
    }
    return computed;
  }

  const configured = VECTOR_INDEX_RESOURCE_NAME.trim();

  if (configured) {
    if (configured.includes('/indexEndpoints/')) {
      throw new Error(
        'VERTEX_VECTOR_INDEX_RESOURCE_NAME is set to an Index Endpoint resource. Use an Index resource: projects/<project>/locations/<location>/indexes/<indexId>'
      );
    }
    if (!configured.includes('/indexes/')) {
      throw new Error(
        'VERTEX_VECTOR_INDEX_RESOURCE_NAME format is invalid. Expected: projects/<project>/locations/<location>/indexes/<indexId>'
      );
    }
    return configured;
  }

  throw new Error(
    'Missing Vertex index config. Set VERTEX_VECTOR_INDEX_RESOURCE_NAME or both GOOGLE_CLOUD_PROJECT and VERTEX_AI_INDEX_ID.'
  );
}

type SourceType = 'article' | 'help_center_article' | 'topic' | 'insight' | 'chunk';

function getCollectionName(sourceType: SourceType): string {
  switch (sourceType) {
    case 'article': return 'documents';
    case 'help_center_article': return 'help_center_articles';
    case 'topic': return 'topics';
    case 'insight': return 'insights';
    case 'chunk': return 'source_chunks';
    default: throw new Error(`Unsupported sourceType: ${sourceType}`);
  }
}

function buildRestricts(params: {
  sourceType: SourceType;
  spaceId: string;
  hubId?: string | null;
  libraryId?: string | null;
  helpCenterId?: string | null;
  visibility?: 'public' | 'private';
  internalOnly?: boolean;
  origin?: 'automatic' | 'manual' | 'imported';
  signalLevel?: 'low' | 'medium' | 'high' | null;
}): protos.google.cloud.aiplatform.v1.IndexDatapoint.IRestriction[] {
  const restricts: protos.google.cloud.aiplatform.v1.IndexDatapoint.IRestriction[] = [
    { namespace: 'sourceType', allowList: [params.sourceType] },
    { namespace: 'spaceId', allowList: [params.spaceId] },
  ];

  if (params.hubId) restricts.push({ namespace: 'hubId', allowList: [params.hubId] });
  if (params.libraryId) restricts.push({ namespace: 'libraryId', allowList: [params.libraryId] });
  if (params.helpCenterId) restricts.push({ namespace: 'helpCenterId', allowList: [params.helpCenterId] });
  if (params.visibility) restricts.push({ namespace: 'visibility', allowList: [params.visibility] });
  if (typeof params.internalOnly === 'boolean') {
    restricts.push({ namespace: 'internalOnly', allowList: [String(params.internalOnly)] });
  }
  if (params.origin) restricts.push({ namespace: 'origin', allowList: [params.origin] });
  if (params.signalLevel) restricts.push({ namespace: 'signalLevel', allowList: [params.signalLevel] });

  return restricts;
}

type SignalLevel = 'low' | 'medium' | 'high';

function deriveTopicSignalLevel(
  topicSignalLevel: SignalLevel,
  insightSignalLevel: SignalLevel
): SignalLevel {
  const rank: Record<SignalLevel, number> = { low: 0, medium: 1, high: 2 };
  const levels: SignalLevel[] = ['low', 'medium', 'high'];
  return levels[Math.max(rank[topicSignalLevel] ?? 0, rank[insightSignalLevel] ?? 0)];
}

function deriveSignalLevelFromInsights(insights: admin.firestore.DocumentData[]): SignalLevel {
  if (insights.some((i) => i.signalLevel === 'high')) return 'high';
  if (insights.some((i) => i.signalLevel === 'medium')) return 'medium';
  return 'low';
}

async function generateTopicFromInsights(
  insights: admin.firestore.DocumentData[]
): Promise<{ title: string; summary: string }> {
  try {
    const ai = getGenAI();
    const clusterText = insights
      .map((ins, i) => `Insight ${i + 1}:\nTitle: ${ins.title ?? ''}\nIssue: ${(ins.content ?? '').split('\n')[0] ?? ''}`)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are an internal knowledge management system. Given these related support insights, generate a canonical Topic title and summary.

${clusterText}

Respond with JSON: { "title": "...", "summary": "..." }
Title: concise, ~5-8 words, internal-facing.
Summary: 1-2 sentences describing the common pattern.`,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    return {
      title: parsed.title ?? 'Recurring Support Issue',
      summary: parsed.summary ?? '',
    };
  } catch {
    return { title: 'Recurring Support Issue', summary: '' };
  }
}

/**
 * Processes brain_jobs for vector indexing, deletion, and topic grouping.
 */
export const processBrainJob = onDocumentCreated(
  {
    document: 'brain_jobs/{jobId}',
    memory: '1GiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data() as any;
    const jobId = event.params.jobId;

    await snap.ref.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      switch (job.type) {
        case 'process_vector_indexing': {
          const { sourceType, sourceId, text } = job.params as {
            sourceType: SourceType;
            sourceId: string;
            text?: string;
          };

          const indexResourceName = resolveIndexResourceName();
          if (!sourceType || !sourceId) throw new Error('Missing sourceType or sourceId');

          const collectionName = getCollectionName(sourceType);
          const docRef = db.collection(collectionName).doc(sourceId);
          const docSnap = await docRef.get();

          if (!docSnap.exists) throw new Error(`Source doc not found: ${collectionName}/${sourceId}`);

          const docData = docSnap.data()!;
          const normalizedText = text || [docData.title ?? '', docData.summary ?? '', docData.body ?? '', docData.content ?? ''].filter(Boolean).join('\n\n').trim();

          if (!normalizedText) throw new Error(`No text available to embed for ${sourceType}:${sourceId}`);

          logger.info(`[Job:${jobId}] Generating embedding for ${sourceType}:${sourceId}`);
          const embedding = await generateDocumentEmbedding(normalizedText);
          if (!embedding || embedding.length === 0) throw new Error('Embedding generation failed');

          const vectorDocId = `${sourceType}:${sourceId}`;
          const restricts = buildRestricts({
            sourceType,
            spaceId: docData.spaceId,
            hubId: docData.hubId,
            libraryId: docData.libraryId ?? docData.destinationLibraryId ?? docData.helpCenterId,
            helpCenterId: docData.helpCenterId,
            visibility: docData.visibility,
            internalOnly: sourceType === 'chunk' ? true : docData.visibility === 'private',
            origin: docData.origin,
            signalLevel: docData.signalLevel,
          });

          logger.info(`[Job:${jobId}] Upserting datapoint to Vertex index`, {
            vectorDocId,
            indexResourceName,
            embeddingDim: embedding.length,
          });

          const datapoint = new protos.google.cloud.aiplatform.v1.IndexDatapoint({
            datapointId: vectorDocId,
            featureVector: embedding,
          });

          if (restricts.length > 0) {
            datapoint.restricts = restricts.map(r => new protos.google.cloud.aiplatform.v1.IndexDatapoint.Restriction({
              namespace: r.namespace,
              allowList: r.allowList,
            }));
          }

          await getIndexClient().upsertDatapoints({
            index: indexResourceName,
            datapoints: [datapoint],
          });

          await docRef.update({
            embeddingStatus: 'ready',
            embeddingModel: 'gemini-embedding-001',
            embeddingVersion: 'v3',
            embeddingDim: 1536,
            embeddingUpdatedAt: new Date().toISOString(),
            vectorDocId,
          });

          // Chain topic grouping job for ungrouped medium/high-signal insights
          if (sourceType === 'insight' && docData.groupingStatus === 'ungrouped' && docData.signalLevel !== 'low') {
            await db.collection('brain_jobs').add({
              type: 'process_topic_grouping',
              status: 'pending',
              params: {
                insightId: sourceId,
                spaceId: docData.spaceId,
                hubId: docData.hubId ?? null,
                signalLevel: docData.signalLevel,
              },
              createdAt: new Date().toISOString(),
            });
            logger.info(`[Job:${jobId}] Chained process_topic_grouping for insight ${sourceId}`);
          }

          break;
        }

        case 'process_vector_deletion': {
          const { sourceType, sourceId } = job.params as {
            sourceType: SourceType;
            sourceId: string;
          };

          if (!sourceType || !sourceId) throw new Error('Missing sourceType or sourceId');

          const vectorDocId = `${sourceType}:${sourceId}`;
          const indexResourceName = resolveIndexResourceName();

          logger.info(`[Job:${jobId}] Deleting datapoint from Vertex index`, { vectorDocId });

          await getIndexClient().removeDatapoints({
            index: indexResourceName,
            datapointIds: [vectorDocId],
          });

          try {
            await db.collection(getCollectionName(sourceType)).doc(sourceId).update({
              embeddingStatus: 'failed',
              vectorDocId: admin.firestore.FieldValue.delete(),
              embeddingUpdatedAt: new Date().toISOString(),
            });
          } catch {
            // Document already deleted — expected for article/insight deletions
            logger.info(`[Job:${jobId}] Source doc already gone, skipping Firestore cleanup`);
          }

          break;
        }

        case 'process_topic_grouping': {
          const { insightId, spaceId, hubId } = job.params as {
            insightId: string;
            spaceId: string;
            hubId?: string | null;
            signalLevel: SignalLevel;
          };

          if (!insightId || !spaceId) throw new Error('Missing insightId or spaceId');

          const insightRef = db.collection('insights').doc(insightId);
          const insightSnap = await insightRef.get();

          if (!insightSnap.exists) throw new Error(`Insight not found: ${insightId}`);
          const insight = insightSnap.data()!;

          // Guard: skip if already grouped or ignored
          if (insight.groupingStatus !== 'ungrouped') {
            logger.info(`[Job:${jobId}] Insight ${insightId} already ${insight.groupingStatus}, skipping`);
            break;
          }

          const queryText = insight.content ?? insight.title ?? '';
          const queryVector = await generateQueryEmbedding(queryText);
          if (!queryVector) throw new Error('Failed to generate query embedding for insight');

          // Step 1: Look for a matching existing topic
          const TOPIC_MATCH_THRESHOLD = 0.40;
          const topicNeighbors = await queryVertexNeighbors({
            queryVector,
            sourceType: 'topic',
            spaceId,
            hubId,
            limit: 5,
          });

          logger.info(`[Job:${jobId}] Topic search: ${topicNeighbors.length} results`, {
            topics: topicNeighbors.map((n) => ({ id: n.datapointId, score: n.score })),
            threshold: TOPIC_MATCH_THRESHOLD,
          });

          const matchingTopic = topicNeighbors.find((n) => n.score >= TOPIC_MATCH_THRESHOLD);

          if (matchingTopic) {
            const topicId = matchingTopic.datapointId.split(':')[1];
            const topicRef = db.collection('topics').doc(topicId);

            await db.runTransaction(async (tx) => {
              const topicSnap = await tx.get(topicRef);
              if (!topicSnap.exists) return;
              const topic = topicSnap.data()!;

              tx.update(insightRef, {
                topicId,
                groupingStatus: 'grouped',
                updatedAt: new Date().toISOString(),
              });

              tx.update(topicRef, {
                insightCount: (topic.insightCount ?? 0) + 1,
                signalLevel: deriveTopicSignalLevel(
                  topic.signalLevel as SignalLevel,
                  insight.signalLevel as SignalLevel
                ),
                updatedAt: new Date().toISOString(),
              });
            });

            logger.info(`[Job:${jobId}] Insight ${insightId} assigned to existing topic ${topicId} (score: ${matchingTopic.score.toFixed(4)})`);
            break;
          }

          // Step 2: Check if enough similar insights exist to create a new topic
          const INSIGHT_CLUSTER_THRESHOLD = 0.40;
          const MIN_CLUSTER_SIZE = 2;

          const insightNeighbors = await queryVertexNeighbors({
            queryVector,
            sourceType: 'insight',
            spaceId,
            hubId,
            signalLevels: ['medium', 'high'],
            limit: 10,
          });

          const aboveThreshold = insightNeighbors.filter((n) => n.datapointId.split(':')[1] !== insightId && n.score >= INSIGHT_CLUSTER_THRESHOLD);
          logger.info(`[Job:${jobId}] Insight search: ${insightNeighbors.length} results, ${aboveThreshold.length} above threshold (${INSIGHT_CLUSTER_THRESHOLD})`, {
            allNeighbors: insightNeighbors.map((n) => ({ id: n.datapointId, score: n.score, pass: n.datapointId.split(':')[1] !== insightId && n.score >= INSIGHT_CLUSTER_THRESHOLD })),
          });

          // Check Firestore status of similar insights — some may already be grouped
          const similarInsightDocs = await Promise.all(
            aboveThreshold.map((n) => db.collection('insights').doc(n.datapointId.split(':')[1]).get())
          );

          // If any similar insight is already grouped, join their topic instead of creating a new one
          const alreadyGrouped = similarInsightDocs.find(
            (s) => s.exists && s.data()?.groupingStatus === 'grouped' && s.data()?.topicId
          );

          if (alreadyGrouped) {
            const existingTopicId = alreadyGrouped.data()!.topicId as string;
            const existingTopicRef = db.collection('topics').doc(existingTopicId);

            await db.runTransaction(async (tx) => {
              const topicSnap = await tx.get(existingTopicRef);
              if (!topicSnap.exists) return;
              const topic = topicSnap.data()!;

              tx.update(insightRef, {
                topicId: existingTopicId,
                groupingStatus: 'grouped',
                updatedAt: new Date().toISOString(),
              });

              tx.update(existingTopicRef, {
                insightCount: (topic.insightCount ?? 0) + 1,
                signalLevel: deriveTopicSignalLevel(
                  topic.signalLevel as SignalLevel,
                  insight.signalLevel as SignalLevel
                ),
                updatedAt: new Date().toISOString(),
              });
            });

            logger.info(`[Job:${jobId}] Insight ${insightId} joined existing topic ${existingTopicId} via grouped neighbor`);
            break;
          }

          // Only count ungrouped similar insights for cluster creation
          const ungroupedIds = new Set(
            similarInsightDocs
              .filter((s) => s.exists && s.data()?.groupingStatus === 'ungrouped')
              .map((s) => s.id)
          );
          const ungroupedSimilar = aboveThreshold.filter((n) => ungroupedIds.has(n.datapointId.split(':')[1]));

          if (ungroupedSimilar.length < MIN_CLUSTER_SIZE) {
            logger.info(`[Job:${jobId}] Insight ${insightId}: only ${ungroupedSimilar.length} ungrouped similar insights (need ${MIN_CLUSTER_SIZE}). Staying ungrouped.`);
            break;
          }

          // Step 3: Create a new topic from the cluster
          const clusterInsightIds = [insightId, ...ungroupedSimilar.slice(0, 4).map((n) => n.datapointId.split(':')[1])];

          const clusterSnaps = await Promise.all(
            clusterInsightIds.map((id) => db.collection('insights').doc(id).get())
          );
          const clusterInsights = clusterSnaps.filter((s) => s.exists).map((s) => s.data()!);

          const { title: topicTitle, summary: topicSummary } = await generateTopicFromInsights(clusterInsights);

          const now = new Date().toISOString();
          const topicRef = db.collection('topics').doc();

          const topicData = {
            spaceId,
            hubId: hubId ?? null,
            title: topicTitle,
            summary: topicSummary,
            insightCount: clusterInsights.length,
            signalLevel: deriveSignalLevelFromInsights(clusterInsights),
            articleId: null,
            embeddingStatus: 'pending',
            embeddingModel: null,
            embeddingVersion: null,
            vectorDocId: null,
            embeddingUpdatedAt: null,
            createdAt: now,
            updatedAt: now,
          };

          // Only update insights that still exist in Firestore
          const existingInsightIds = clusterSnaps
            .filter((s) => s.exists)
            .map((s) => s.id);

          const batch = db.batch();
          batch.set(topicRef, topicData);
          for (const id of existingInsightIds) {
            batch.update(db.collection('insights').doc(id), {
              topicId: topicRef.id,
              groupingStatus: 'grouped',
              updatedAt: now,
            });
          }
          await batch.commit();

          await db.collection('brain_jobs').add({
            type: 'process_vector_indexing',
            status: 'pending',
            params: {
              sourceType: 'topic',
              sourceId: topicRef.id,
              spaceId,
              text: `${topicTitle}\n\n${topicSummary}`,
            },
            createdAt: now,
          });

          logger.info(`[Job:${jobId}] Created topic ${topicRef.id} from ${clusterInsights.length} insights. Vector indexing enqueued.`);
          break;
        }

        default:
          logger.warn(`[Job:${jobId}] Unsupported job type: ${job.type}`);
      }

      await snap.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      logger.error(`[Job:${jobId}] FAILED`, error);
      await snap.ref.update({
        status: 'failed',
        error: error?.message || 'Unknown error',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
