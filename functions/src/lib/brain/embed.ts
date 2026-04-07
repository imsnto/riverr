import { GoogleGenAI } from '@google/genai';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 1536;

let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    genAIInstance = new GoogleGenAI({ apiKey });
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
