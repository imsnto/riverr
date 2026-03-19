import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

// Vertex AI text-embedding-004 is recommended for high-fidelity 3072-dim vectors
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';

const vertexAI = new VertexAI({
  project: project || '',
  location: location,
});

const embeddingModel = vertexAI.getGenerativeModel({
  model: EMBEDDING_MODEL,
});

/**
 * Generates a high-dimensional vector embedding for the given text.
 * Returns a 3072-dimensional array of floats.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;

  try {
    const result = await embeddingModel.embedContent({
      content: {
        role: 'user',
        parts: [{ text: text.trim() }],
      },
      config: {
        outputDimensionality: 3072,
      }
    });

    const values = result.embedding?.values;
    return values && values.length > 0 ? (values as number[]) : null;
  } catch (error) {
    console.error('generateEmbedding failed:', error);
    return null;
  }
}