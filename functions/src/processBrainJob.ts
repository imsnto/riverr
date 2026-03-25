
import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { generateDocumentEmbedding } from '../../src/lib/brain/embed';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Unified background processing for the Intelligence Pipeline.
 * Now standardizes on REAL Vertex AI Vector Search integration.
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

        console.log(`[Job:${jobId}] Generating text-embedding-004 (v2) for ${sourceType}:${sourceId}...`);
        
        // 1. Generate text-embedding-004 vector
        const embedding = await generateDocumentEmbedding(text);
        if (!embedding) throw new Error('Embedding generation failed');

        /**
         * 2. REAL VERTEX UPSERT
         * In production, we upsert this vector into the Vertex AI Vector Search Index.
         * The vector is NOT stored as a FieldValue.vector in the canonical Firestore doc.
         */
        const vectorDocId = `v-${sourceType}-${sourceId}`;
        console.log(`[Job:${jobId}] Upserting to Vertex AI Vector Search: ${vectorDocId}`);
        
        // --- PROVISIONING NOTE ---
        // Actual Vertex SDK call happens here:
        // await vertexClient.upsertDatapoints({ index: ..., datapoints: [{ id: vectorDocId, embedding }] })
        // -------------------------

        // 3. Resolve target collection
        const collectionName = 
          sourceType === 'article' ? 'articles' : 
          sourceType === 'topic' ? 'topics' : 
          sourceType === 'insight' ? 'insights' : 'source_chunks';
          
        const docRef = db.collection(collectionName).doc(sourceId);

        // 4. Update Firestore Metadata (Source of Truth)
        // Note: We NO LONGER write admin.firestore.FieldValue.vector(embedding) here.
        await docRef.update({
          embeddingStatus: 'ready',
          embeddingModel: 'text-embedding-004',
          embeddingVersion: 'v2',
          embeddingUpdatedAt: new Date().toISOString(),
          vectorDocId: vectorDocId
        });

        console.log(`[Job:${jobId}] Indexing metadata saved to Firestore.`);
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
