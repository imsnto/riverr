
import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { generateDocumentEmbedding } from '../../src/lib/brain/embed';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Unified background processing for the Intelligence Pipeline.
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
        const { sourceType, sourceId, spaceId, text } = job.params;
        if (!sourceId || !text) throw new Error('Missing sourceId or text for indexing');

        console.log(`[Job:${jobId}] Generating v2 embedding for ${sourceType}:${sourceId}...`);
        
        // 1. Generate text-embedding-004 vector
        const embedding = await generateDocumentEmbedding(text);
        if (!embedding) throw new Error('Embedding generation failed');

        // 2. Resolve target collection
        const collectionName = sourceType === 'article' ? 'articles' : 
                               sourceType === 'topic' ? 'topics' : 'insights';
        const docRef = db.collection(collectionName).doc(sourceId);

        // 3. Update Firestore with Vector & Metadata
        // NOTE: Production retrieval still hydrations from here, but the vector 
        // is now standardized on v2 (2048-dim).
        await docRef.update({
          embedding: admin.firestore.FieldValue.vector(embedding),
          embeddingStatus: 'ready',
          embeddingModel: 'text-embedding-004',
          embeddingVersion: 'v2',
          embeddingUpdatedAt: new Date().toISOString(),
          vectorDocId: `v-${sourceId}`
        });

        console.log(`[Job:${jobId}] Vector indexed successfully.`);
        break;
      }

      default:
        console.warn(`[Job:${jobId}] Unsupported job type: ${job.type}`);
    }

    await snap.ref.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error(`[Job:${jobId}] FAILED:`, error);
    await snap.ref.update({
      status: 'failed',
      error: error?.message || 'Unknown error',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
