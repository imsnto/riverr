
import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'timeflow-6i3eo';
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

// ✅ v2 MODEL STANDARD: Gemini Gecko text-embedding-004
const EMBEDDING_MODEL = 'text-embedding-004';

// ✅ FIRESTORE/VERTEX VECTOR CAP: 2048-dimensions
const EMBEDDING_DIM = 2048;

let vertexAIInstance: VertexAI | null = null;

function getVertexAI() {
  if (!vertexAIInstance) {
    vertexAIInstance = new VertexAI({
      project: project,
      location: location,
    });
  }
  return vertexAIInstance;
}

/**
 * Generates an embedding for documentation content (articles, topics, etc).
 * Uses taskType: RETRIEVAL_DOCUMENT for optimal indexing.
 */
export async function generateDocumentEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;

  try {
    console.log(`[Embedding] Generating document embedding (text-embedding-004) for: ${text.substring(0, 50)}...`);
    const vertexAI = getVertexAI();
    const embeddingModel = vertexAI.getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    // @ts-ignore - SDK types mismatch
    const result = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text: text.trim() }],
      },
      config: {
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBEDDING_DIM,
      }
    });

    const values = result.embedding?.values;
    return values && values.length > 0 ? (values as number[]) : null;
  } catch (error) {
    console.error('generateDocumentEmbedding failed:', error);
    return null;
  }
}

/**
 * Generates an embedding for a user search query.
 * Uses taskType: RETRIEVAL_QUERY for optimal retrieval performance.
 */
export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;

  try {
    console.log(`[Embedding] Generating query embedding (text-embedding-004) for: ${text.substring(0, 50)}...`);
    const vertexAI = getVertexAI();
    const embeddingModel = vertexAI.getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    // @ts-ignore - SDK types mismatch
    const result = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text: text.trim() }],
      },
      config: {
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIM,
      }
    });

    const values = result.embedding?.values;
    return values && values.length > 0 ? (values as number[]) : null;
  } catch (error) {
    console.error('generateQueryEmbedding failed:', error);
    return null;
  }
}

// ==========================================
// V2 ENTITY TEXT COMPOSERS (Per Client Spec)
// ==========================================

/**
 * Articles embed: Title + Summary + Body
 */
export function composeArticleEmbeddingText(article: { title: string; summary?: string; body: string }): string {
  return [article.title, article.summary, article.body]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Topics embed: Title + Summary
 */
export function composeTopicEmbeddingText(topic: { title: string; summary?: string }): string {
  return [topic.title, topic.summary]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Insights embed: Title + Content (Issue & Resolution)
 */
export function composeInsightEmbeddingText(insight: { title: string; content: string }): string {
  return [insight.title, insight.content]
    .filter(Boolean)
    .join('\n\n');
}
