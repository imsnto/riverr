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

export interface EvaluateInsightOutput {
  messageIndex: number;
  shouldCreateInsight: boolean;
  confidence: number;
  reason: string;
  title?: string;
  issueLabel?: string;
  resolutionLabel?: string;
  structuredContent?: {
    issue: string;
    resolution: string;
    context?: string;
  };
}

export interface BatchEvaluateInsightInput {
  messages: Array<{ index: number; messageId: string; text: string }>;
  conversationContext?: string;
}

const FALLBACK_ITEM = (index: number): EvaluateInsightOutput => ({
  messageIndex: index,
  shouldCreateInsight: false,
  confidence: 0,
  reason: 'parse_error',
});

export async function evaluateInsightBatch(input: BatchEvaluateInsightInput): Promise<EvaluateInsightOutput[]> {
  if (input.messages.length === 0) return [];

  const messagesBlock = input.messages
    .map(m => `[Message ${m.index}]\n${m.text}`)
    .join('\n\n---\n\n');

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { responseMimeType: 'application/json' },
      contents: `You are an expert Knowledge Management AI. A human support agent handled a customer conversation after the AI could not fully resolve it. Analyze each agent message below and decide which ones contain reusable "Insights" worth saving to a knowledge base.

CONVERSATION CONTEXT:
---
${input.conversationContext ?? 'N/A'}
---

Create an Insight if a message contains:
- A direct answer to a customer question the AI could not handle (human escalation resolution)
- Step-by-step instructions or guides provided by the human agent
- Root cause of a problem or troubleshooting findings
- Explanation of system behavior or onboarding clarification
- Any repeatable resolution that could help future customers

IMPORTANT: This is a human handoff scenario — the human agent stepped in because the AI had a gap. Treat the human's substantive answers as high-value insights even if the topic seems like general knowledge.

DO NOT create an Insight for:
- Greetings or filler (thanks, hello, you're welcome, checking now, hi there)
- Short status updates with no actionable information
- Messages with no reusable content

MESSAGES TO EVALUATE:
---
${messagesBlock}
---

Respond ONLY with a valid JSON array (one entry per message), no markdown, no explanation:
[
  {
    "messageIndex": 0,
    "shouldCreateInsight": true or false,
    "confidence": 0.0 to 1.0,
    "reason": "short reason",
    "title": "Professional internal title (only if shouldCreateInsight=true)",
    "issueLabel": "short issue label (only if shouldCreateInsight=true)",
    "resolutionLabel": "short resolution label (only if shouldCreateInsight=true)",
    "structuredContent": {
      "issue": "what the customer needed help with",
      "resolution": "how the human agent resolved it",
      "context": "optional extra context"
    }
  }
]`,
    });

    const rawText = response.text ?? '';
    logger.info(`[evaluateInsightBatch] raw response: ${rawText.substring(0, 300)}`);

    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    if (!cleaned) {
      logger.warn('[evaluateInsightBatch] empty response from model');
      return input.messages.map(m => FALLBACK_ITEM(m.index));
    }

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      logger.warn('[evaluateInsightBatch] response is not an array:', JSON.stringify(parsed).substring(0, 200));
      return input.messages.map(m => FALLBACK_ITEM(m.index));
    }

    return parsed as EvaluateInsightOutput[];
  } catch (err: any) {
    logger.error('[evaluateInsightBatch] error:', err?.message || String(err));
    return input.messages.map(m => FALLBACK_ITEM(m.index));
  }
}
