import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { 
  generateDocumentEmbedding, 
  composeArticleEmbeddingText, 
  composeTopicEmbeddingText, 
  composeInsightEmbeddingText 
} from "../../../src/lib/brain/embed";
import { MatchServiceClient } from '@google-cloud/aiplatform';

// Ensure admin initialized
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Ensure the Vertex client is initialized
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'timeflow-6i3eo';
const LOCATION = process.env.VERTEX_API_LOCATION || 'us-central1';
const INDEX_ID = process.env.VERTEX_AI_INDEX_ID || '';
const INDEX_RESOURCE_NAME = INDEX_ID ? `projects/${PROJECT}/locations/${LOCATION}/indexes/${INDEX_ID}` : '';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || 'us-central1-aiplatform.googleapis.com';

const matchClient = new MatchServiceClient({
  apiEndpoint: PUBLIC_ENDPOINT_DOMAIN,
});

// Telemetry Logger per client specification
const Telemetry = {
  log: (event: string, payload: Record<string, any>) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      component: 'VertexQueue',
      event,
      timestamp: new Date().toISOString(),
      ...payload
    }));
  }
};

/**
 * Generic handler for embedding and upserting any entity
 */
async function handleEntityEmbedding(
  id: string, 
  data: any, 
  sourceType: 'article' | 'topic' | 'insight',
  composeTextFn: (d: any) => string,
  docRef: any
) {
  // Only trigger if specifically marked as pending
  if (data.embeddingStatus !== 'pending') return;

  Telemetry.log('indexing_job_queued', { sourceType, id, spaceId: data.spaceId });

  console.log(`[VertexQueue] Processing ${sourceType} ${id} for embedding...`);

  try {
    const textToEmbed = composeTextFn(data);
    
    if (!textToEmbed || textToEmbed.trim() === '') {
      console.warn(`[VertexQueue] Skipping ${sourceType} ${id} — no text content to embed.`);
      await docRef.update({ embeddingStatus: 'failed', embeddingUpdatedAt: new Date().toISOString() });
      return;
    }

    const vector = await generateDocumentEmbedding(textToEmbed);
    
    Telemetry.log('embedding_generated', { sourceType, id, dimensions: vector?.length || 0, model: 'text-embedding-004' });
    
    if (!vector || vector.length === 0) {
      throw new Error(`Embedding model failed to return a vector for ${sourceType} ${id}`);
    }

    // Build the specific Vertex AI format requirement: "sourceType:docId"
    const vectorDocId = `${sourceType}:${id}`;

    // Build restricts/metadata
    const restricts: Array<{ name: string; allowTokens: string[] }> = [
      { name: 'sourceType', allowTokens: [sourceType] },
      { name: 'spaceId', allowTokens: [data.spaceId] },
    ];

    if (data.hubId) restricts.push({ name: 'hubId', allowTokens: [data.hubId] });
    // Default to private unless explicitly public (like published articles)
    const visibility = data.visibility || 'private';
    restricts.push({ name: 'visibility', allowTokens: [visibility] });
    
    // Articles have library IDs (Help Centers) for scoping
    if (sourceType === 'article' && data.destinationLibraryId) {
       restricts.push({ name: 'libraryId', allowTokens: [data.destinationLibraryId] });
    }

    if (!INDEX_RESOURCE_NAME) {
      throw new Error('VERTEX_AI_INDEX_ID is missing from environment. Cannot upsert.');
    }

    // Upsert to Vertex AI
    Telemetry.log('vertex_upsert_started', { sourceType, id, vectorDocId });
    await (matchClient as any).upsertDatapoints({
      index: INDEX_RESOURCE_NAME,
      datapoints: [
        {
          datapointId: vectorDocId,
          featureVector: vector,
          // @ts-ignore - The SDK v3 in this project uses restricts instead of stringFilters locally
          restricts,
        }
      ]
    });

    Telemetry.log('vertex_upsert_successful', { sourceType, id, vectorDocId, index: INDEX_RESOURCE_NAME });

    // Flag success on the canonical document
    Telemetry.log('indexing_completed', { sourceType, id, vectorDocId });
    await docRef.update({
      embeddingStatus: 'ready',
      vectorDocId,
      embeddingUpdatedAt: new Date().toISOString()
    });

  } catch (error) {
    Telemetry.log('indexing_failed', { sourceType, id, error: (error as Error)?.message });
    console.error(`[VertexQueue] Error processing ${sourceType} ${id}:`, error);
    await docRef.update({
      embeddingStatus: 'failed',
      embeddingUpdatedAt: new Date().toISOString()
    });
  }
}

export const onArticleWrittenEmbed = onDocumentWritten("articles/{articleId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.after.data();
  if (!data) {
     // Deleted document — we should remove it from Vertex (can add later if needed)
     return;
  }
  await handleEntityEmbedding(event.params.articleId, data, 'article', composeArticleEmbeddingText, snapshot.after.ref);
});

export const onTopicWrittenEmbed = onDocumentWritten("topics/{topicId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.after.data();
  if (!data) return;
  await handleEntityEmbedding(event.params.topicId, data, 'topic', composeTopicEmbeddingText, snapshot.after.ref);
});

export const onInsightWrittenEmbed = onDocumentWritten("insights/{insightId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.after.data();
  if (!data) return;
  await handleEntityEmbedding(event.params.insightId, data, 'insight', composeInsightEmbeddingText, snapshot.after.ref);
});
