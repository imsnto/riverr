
import { VertexAI } from '@google-cloud/vertexai';

// Fallback to the known project ID for Firebase Studio environment if env vars are missing
const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'timeflow-6i3eo';
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

// Vertex AI text-embedding-004 is recommended for high-fidelity 3072-dim vectors
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';

let vertexAIInstance: VertexAI | null = null;

/**
 * Lazily initializes the VertexAI instance to avoid initialization errors during module evaluation.
 */
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
 * Generates a high-dimensional vector embedding for the given text.
 * Standardized to 768 dimensions to match the Typesense index configuration.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;

  try {
    const vertexAI = getVertexAI();
    const embeddingModel = vertexAI.getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    const result = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text: text.trim() }],
      },
      config: {
        // MATCH TYPESENSE SCHEMA: ensure dimensions align with the search index
        outputDimensionality: 768,
      }
    });

    const values = result.embedding?.values;
    return values && values.length > 0 ? (values as number[]) : null;
  } catch (error) {
    console.error('generateEmbedding failed:', error);
    return null;
  }
}
