import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { IndexServiceClient } from '@google-cloud/aiplatform';
import { generateDocumentEmbedding } from '../../src/lib/brain/embed';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const VECTOR_INDEX_RESOURCE_NAME = process.env.VERTEX_VECTOR_INDEX_RESOURCE_NAME || '';

const indexClient = new IndexServiceClient({
  apiEndpoint: `${location}-aiplatform.googleapis.com`,
});

type SourceType = 'article' | 'topic' | 'insight' | 'chunk';

function getCollectionName(sourceType: SourceType): string {
  switch (sourceType) {
    case 'article': return 'articles';
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
  visibility?: 'public' | 'private';
  internalOnly?: boolean;
  origin?: 'automatic' | 'manual' | 'imported';
  signalLevel?: 'low' | 'medium' | 'high' | null;
}) {
  const restricts: Array<{ namespace: string; allowList: string[] }> = [
    { namespace: 'sourceType', allowList: [params.sourceType] },
    { namespace: 'spaceId', allowList: [params.spaceId] },
  ];

  if (params.hubId) restricts.push({ namespace: 'hubId', allowList: [params.hubId] });
  if (params.libraryId) restricts.push({ namespace: 'libraryId', allowList: [params.libraryId] });
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
export const processBrainJob = onDocumentCreated('brain_jobs/{jobId}', async (event) => {
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

        if (!VECTOR_INDEX_RESOURCE_NAME) throw new Error('Missing VERTEX_VECTOR_INDEX_RESOURCE_NAME');
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
          libraryId: docData.libraryId ?? docData.destinationLibraryId,
          visibility: docData.visibility,
          internalOnly: sourceType === 'chunk' ? true : docData.visibility === 'private',
          origin: docData.origin,
          signalLevel: docData.signalLevel,
        });

        logger.info(`[Job:${jobId}] Upserting datapoint to Vertex index`, { vectorDocId });

        await indexClient.upsertDatapoints({
          index: VECTOR_INDEX_RESOURCE_NAME,
          datapoints: [
            {
              datapointId: vectorDocId,
              featureVector: embedding,
              restricts,
            },
          ],
        });

        await docRef.update({
          embeddingStatus: 'ready',
          embeddingModel: 'text-embedding-004',
          embeddingVersion: 'v2',
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