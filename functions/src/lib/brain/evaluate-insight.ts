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

export interface EvaluateInsightInput {
  messageText: string;
  conversationContext?: string;
}

export interface EvaluateInsightOutput {
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

const FALLBACK: EvaluateInsightOutput = {
  shouldCreateInsight: false,
  confidence: 0,
  reason: 'parse_error',
};

export async function evaluateInsight(input: EvaluateInsightInput): Promise<EvaluateInsightOutput> {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { responseMimeType: 'application/json' },
      contents: `You are an expert Knowledge Management AI. Analyze a human support response and identify if it contains a reusable "Insight".

Only create an Insight if the message contains:
- Root cause of a problem
- Troubleshooting findings or workarounds
- Explanation of complex system behavior
- Repeatable resolution steps
- Onboarding clarification

DO NOT create an Insight for:
- Greetings or filler (thanks, hello, checking now)
- Short status updates (sent to team, escalating)
- General conversation with no reusable resolution

MESSAGE TO EVALUATE:
---
${input.messageText}
---

CONTEXT:
---
${input.conversationContext ?? 'N/A'}
---

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "shouldCreateInsight": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "short reason string",
  "title": "Professional internal title (only if shouldCreateInsight=true)",
  "issueLabel": "short issue label (only if shouldCreateInsight=true)",
  "resolutionLabel": "short resolution label (only if shouldCreateInsight=true)",
  "structuredContent": {
    "issue": "what the problem was",
    "resolution": "how it was resolved",
    "context": "optional extra context"
  }
}`,
    });

    const rawText = response.text ?? '';
    logger.info(`[evaluateInsight] raw response: ${rawText.substring(0, 200)}`);

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    if (!cleaned) {
      logger.warn('[evaluateInsight] empty response from model');
      return FALLBACK;
    }

    const parsed = JSON.parse(cleaned);

    if (typeof parsed.shouldCreateInsight !== 'boolean' || typeof parsed.confidence !== 'number') {
      logger.warn('[evaluateInsight] unexpected shape:', JSON.stringify(parsed).substring(0, 200));
      return FALLBACK;
    }

    return parsed as EvaluateInsightOutput;
  } catch (err: any) {
    logger.error('[evaluateInsight] error:', err?.message || String(err));
    return FALLBACK;
  }
}
