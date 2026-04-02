import { GoogleGenAI } from '@google/genai';

const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'timeflow-6i3eo';
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 1536;

let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({
      vertexai: true,
      project: project,
      location: location,
    });
  }
  return genAIInstance;
}

export async function generateDocumentEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    console.log(`[Embedding] Generating document embedding (${EMBEDDING_MODEL}, dim=${EMBEDDING_DIM}) for: ${text.substring(0, 50)}...`);
    const ai = getGenAI();
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.trim(),
      config: {
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBEDDING_DIM,
      }
    });
    const values = response.embeddings?.[0]?.values;
    return values && values.length > 0 ? values : null;
  } catch (error) {
    console.error('generateDocumentEmbedding failed:', error);
    return null;
  }
}

export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    console.log(`[Embedding] Generating query embedding (${EMBEDDING_MODEL}, dim=${EMBEDDING_DIM}) for: ${text.substring(0, 50)}...`);
    const ai = getGenAI();
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.trim(),
      config: {
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIM,
      }
    });
    const values = response.embeddings?.[0]?.values;
    return values && values.length > 0 ? values : null;
  } catch (error) {
    console.error('generateQueryEmbedding failed:', error);
    return null;
  }
}
