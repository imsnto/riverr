import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GCLOUD_PROJECT;
const location = 'us-central1';

// Vertex AI text-embedding-004 is the recommended model for high-fidelity 3072-dim vectors
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';

const vertexAI = new VertexAI({
  project: project,
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
    return values && values.length > 0 ? values : null;
  } catch (error) {
    console.error('generateEmbedding failed:', error);
    return null;
  }
}
