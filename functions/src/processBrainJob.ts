import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { IndexServiceClient, protos } from '@google-cloud/aiplatform';
import { generateDocumentEmbedding } from './lib/brain/embed';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const VECTOR_INDEX_RESOURCE_NAME = process.env.VERTEX_VECTOR_INDEX_RESOURCE_NAME || '';
const VECTOR_INDEX_NUMERIC_ID = process.env.VERTEX_AI_INDEX_ID || '';
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';

const indexClient = new IndexServiceClient({
  apiEndpoint: `${location}-aiplatform.googleapis.com`,
});

function resolveIndexResourceName(): string {
  // Prefer explicit numeric index id when available.
  // This avoids stale VERTEX_VECTOR_INDEX_RESOURCE_NAME values (often set to endpoint ids by mistake).
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

/**
 * Real Vertex-backed indexing job.
 * Generates embeddings, upserts datapoints to Vertex Vector Search,
 * and writes only vector linkage metadata back to Firestore.
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

        // Build proper datapoint using protobuf types
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

        await indexClient.upsertDatapoints({
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
});