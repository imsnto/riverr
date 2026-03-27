'use server';
/**
 * @fileOverview Distills a support conversation into a structured Support Intent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const DistillSupportIntentInputSchema = z.object({
  conversationId: z.string().describe('The ID of the conversation being distilled.'),
  conversationText: z.string().describe('The full text of a support conversation, with roles prefixed.'),
  lastAgentMessage: z.string().optional(),
  resolutionStatus: z.string().describe('Must be "resolved" for knowledge extraction.'),
  resolutionSource: z.string().describe('Must be "agent_marked" or "customer_confirmed".'),
});
export type DistillSupportIntentInput = z.infer<typeof DistillSupportIntentInputSchema>;

export const DistillSupportIntentOutputSchema = z.object({
  intentKey: z.string().describe("A concise, machine-readable key for the user's core problem (e.g., 'password_reset', 'billing_dispute'). Use snake_case."),
  customerQuestion: z.string().describe("A clear, one-sentence summary of the customer's primary question or problem."),
  resolution: z.string().describe("A summary of the agent's final resolution or answer, rewritten to be a helpful, standalone piece of knowledge."),
  requiredContext: z.array(z.object({
    key: z.string().describe("The variable name for a piece of information needed to answer, e.g., 'orderId' or 'userEmail'."),
    question: z.string().describe("The question the AI should ask the user to get this piece of information, e.g., 'What is your order number?'."),
  })).describe("A list of questions the AI needs to ask to gather necessary context before it can answer."),
  safetyCriteria: z.object({
    mustNot: z.array(z.string()).describe("A list of things the AI must NOT do or say when answering this intent (e.g., 'Do not mention specific pricing')."),
    requiresHumanIf: z.array(z.string()).describe("A list of conditions under which the AI must escalate to a human (e.g., 'User is asking for a refund')."),
  }).describe("Safety and escalation policies for this intent."),
});
export type DistillSupportIntentOutput = z.infer<typeof DistillSupportIntentOutputSchema>;


export async function distillSupportIntent(input: DistillSupportIntentInput): Promise<DistillSupportIntentOutput | null> {
  // CLIENT REQUIREMENT: Only distill insights from successfully resolved conversations
  if (input.resolutionStatus !== 'resolved') {
    console.warn(`[Distill] Skipping conversation ${input.conversationId}: not resolved.`);
    return null;
  }
  
  if (!['agent_marked', 'customer_confirmed'].includes(input.resolutionSource)) {
    console.warn(`[Distill] Skipping conversation ${input.conversationId}: resolution source (${input.resolutionSource}) not trusted.`);
    return null;
  }

  return distillSupportIntentFlow(input);
}

const distillSupportIntentFlow = ai.defineFlow(
  {
    name: 'distillSupportIntent',
    inputSchema: DistillSupportIntentInputSchema,
    outputSchema: DistillSupportIntentOutputSchema,
  },
  async (input) => {
    const prompt = `
You are an expert at analyzing customer support conversations and distilling them into structured, reusable knowledge.

Given the conversation below, return:
- a stable intentKey (snake_case)
- the customerQuestion (one clear sentence)
- the resolution (standalone helpful answer)
- requiredContext (list of info needed to answer)
- safetyCriteria (guardrails and escalation conditions)

Conversation:
---
${input.conversationText}
---
`;

    const { output } = await ai.generate({
      prompt,
      output: {
        schema: DistillSupportIntentOutputSchema,
      },
    });

    return output!;
  }
);
