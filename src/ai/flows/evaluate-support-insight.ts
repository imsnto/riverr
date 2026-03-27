
'use server';
/**
 * @fileOverview AI flow to evaluate if a human support response contains a reusable resolution.
 * 
 * - evaluateSupportInsight - Decides if an insight should be created and extracts content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const EvaluateInsightInputSchema = z.object({
  messageText: z.string().describe('The content of the agent message to evaluate.'),
  conversationContext: z.string().optional().describe('Recent message history for context.'),
});
export type EvaluateInsightInput = z.infer<typeof EvaluateInsightInputSchema>;

export const EvaluateInsightOutputSchema = z.object({
  shouldCreateInsight: z.boolean().describe('Whether this response contains a valuable, reusable resolution.'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the decision.'),
  reason: z.string().describe('Why this was or was not selected.'),
  title: z.string().optional().describe('A concise, internal-facing title for this insight. Normalized and reusable.'),
  issueLabel: z.string().optional().describe('A machine-readable label for the issue type.'),
  resolutionLabel: z.string().optional().describe('A machine-readable label for the resolution type.'),
  structuredContent: z.object({
    issue: z.string().describe('Normalized description of the customer problem. Root cause focus.'),
    resolution: z.string().describe('The specific steps or explanation that solved it. Reusable finding.'),
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

**CREATION RULES:**
Only create an Insight if the message contains:
- Root cause of a problem
- Troubleshooting findings or workarounds
- Explanation of complex system behavior
- Repeatable resolution steps
- Onboarding clarification

**DO NOT CREATE IF:**
- Greeting or filler (thanks, hello, checking now)
- Short status updates (sent to team, escalating)
- General conversation with no reusable resolution

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
Focus on identifying the core problem solved. Output a stable title and labels.`,
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
