
'use server';
/**
 * @fileOverview AI flow to evaluate if a human support response contains a reusable resolution.
 * 
 * - evaluateSupportInsight - Decides if an insight should be created and extracts content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateInsightInputSchema = z.object({
  messageText: z.string().describe('The content of the agent message to evaluate.'),
  conversationContext: z.string().optional().describe('Recent message history for context.'),
});
export type EvaluateInsightInput = z.infer<typeof EvaluateInsightInputSchema>;

const EvaluateInsightOutputSchema = z.object({
  shouldCreateInsight: z.boolean().describe('Whether this response contains a valuable, reusable resolution.'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the decision.'),
  reason: z.string().describe('Why this was or was not selected.'),
  title: z.string().optional().describe('A concise, internal-facing title for this insight.'),
  structuredContent: z.object({
    issue: z.string().describe('Normalized description of the customer problem.'),
    resolution: z.string().describe('The specific steps or explanation that solved it.'),
    context: z.string().optional().describe('System requirements, constraints, or channel-specific details.'),
  }).optional(),
});
export type EvaluateInsightOutput = z.infer<typeof EvaluateInsightOutputSchema>;

export async function evaluateSupportInsight(input: EvaluateInsightInput): Promise<EvaluateInsightOutput> {
  return evaluateSupportInsightFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateSupportInsightPrompt',
  input: {schema: EvaluateInsightInputSchema},
  output: {schema: EvaluateInsightOutputSchema},
  prompt: `You are an expert Knowledge Management AI. Your job is to analyze human support responses and identify "Insights" — reusable pieces of internal knowledge.

**EVALUATION CRITERIA:**
1. **Resolution Signal**: Does the message actually solve a problem or explain a process? Reject greetings, "checking now" status updates, or vague replies.
2. **Reusability**: Is the answer likely to be useful for other customers?
3. **Substance**: The response should be detailed and educational.

**MESSAGE TO EVALUATE:**
---
{{{messageText}}}
---

**CONTEXT:**
---
{{{conversationContext}}}
---

**TASK:**
Decide if this message contains a high-signal support resolution. If yes, extract the issue, the resolution, and a professional internal title. 
Focus on identifying the core problem solved.`,
});

const evaluateSupportInsightFlow = ai.defineFlow(
  {
    name: 'evaluateSupportInsightFlow',
    inputSchema: EvaluateInsightInputSchema,
    outputSchema: EvaluateInsightOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
