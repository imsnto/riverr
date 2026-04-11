import { GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';

let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

export interface DocumentInsight {
  title: string;
  content: string;
  summary: string;
  confidence: number;
}

export interface ExtractDocumentInsightsInput {
  chunks: Array<{ index: number; text: string }>;
  filename: string;
  sourceType: string;
}

const FALLBACK: DocumentInsight[] = [];

/**
 * Extracts reusable knowledge items from document text chunks.
 * Used for the import pipeline (PDF, CSV, JSON, TXT).
 */
export async function extractDocumentInsights(
  input: ExtractDocumentInsightsInput,
): Promise<DocumentInsight[]> {
  if (input.chunks.length === 0) return FALLBACK;

  const chunksBlock = input.chunks
    .map(c => `[Chunk ${c.index}]\n${c.text}`)
    .join('\n\n---\n\n');

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { responseMimeType: 'application/json' },
      contents: `You are a knowledge base writer. Your job is to read raw document content and produce clean, well-structured knowledge articles that a support agent or customer can read and understand immediately.

**Grouping rule:** If the document covers one coherent topic (e.g. a single policy, one procedure, one guide), produce ONE article. Only create multiple articles when the document genuinely covers distinct, independent topics.

For each article:
- title: clear, descriptive title (~5-8 words)
- content: rewrite the full content as a clean, well-structured markdown article — use headings, numbered lists, or bullet points as appropriate. Preserve all important details. Fix any formatting issues from the original.
- summary: one sentence describing what this article covers
- confidence: 0.0 to 1.0 (how complete and clear the extracted content is)

Skip: greetings, metadata, headers with no content, blank sections.

DOCUMENT CONTENT:
---
${chunksBlock}
---

Respond ONLY with a valid JSON array, no markdown:
[
  {
    "title": "...",
    "content": "...",
    "summary": "...",
    "confidence": 0.9
  }
]`,
    });

    const rawText = response.text ?? '';
    logger.info(`[extractDocumentInsights] raw response length: ${rawText.length}`);

    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    if (!cleaned) return FALLBACK;

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      logger.warn('[extractDocumentInsights] response is not an array');
      return FALLBACK;
    }

    return parsed as DocumentInsight[];
  } catch (err: any) {
    logger.error('[extractDocumentInsights] error:', err?.message || String(err));
    return FALLBACK;
  }
}

/**
 * Splits plain text into semantic chunks of ~1500 chars, respecting paragraph boundaries.
 */
export function chunkText(text: string, maxChunkSize = 1500): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChunkSize && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Parses CSV text into row-based chunks (groups of ~20 rows each).
 */
export function parseCsvChunks(csvText: string, rowsPerChunk = 20): string[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0];
  const dataRows = lines.slice(1);

  const chunks: string[] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerChunk) {
    const batch = dataRows.slice(i, i + rowsPerChunk);
    chunks.push([header, ...batch].join('\n'));
  }
  return chunks;
}
