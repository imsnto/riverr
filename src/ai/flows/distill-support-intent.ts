'use server';
/**
 * @fileOverview Distills a support conversation into a structured Support Intent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const DistillSupportIntentInputSchema = z.object({
  conversationText: z.string().describe('The full text of a support conversation, with roles prefixed (e.g., "Customer: ...", "Agent: ...").'),
  lastAgentMessage: z.string().optional().describe('The final message from the support agent, which likely contains the resolution.'),
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


export async function distillSupportIntent(input: DistillSupportIntentInput): Promise<DistillSupportIntentOutput> {
  return distillSupportIntentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'distillSupportIntentPrompt',
  input: {schema: DistillSupportIntentInputSchema},
  output: {schema: DistillSupportIntentOutputSchema},
  prompt: `You are an expert at analyzing customer support conversations and distilling them into structured, reusable knowledge.

Analyze the following conversation. Your goal is to extract a single, core "support intent" from it.

**Conversation Transcript:**
---
{{{conversationText}}}
---

**Key Information:**
- The customer's problem is the core issue they are trying to solve.
- The agent's final message likely contains the correct answer or resolution.

**Your Task:**
Based on the transcript, extract the following information and provide it in the requested JSON format:

1.  **intentKey**: Create a unique, machine-readable key for this specific problem. Use snake_case. Examples: 'cannot_login', 'update_shipping_address', 'cancel_subscription'.
2.  **customerQuestion**: Rephrase the customer's initial messages into a single, clear question that represents their core need.
3.  **resolution**: Analyze the agent's final message ('{{{lastAgentMessage}}}') and rewrite it as a clear, helpful, standalone answer.
4.  **requiredContext**: What specific pieces of information (like an order ID, email, or username) would an AI need to ask for *before* it could provide this resolution?
5.  **safetyCriteria**: Define the guardrails for this intent. When should an AI escalate to a human? What should it avoid saying?

Provide your analysis in the structured JSON format.
`,
});

const distillSupportIntentFlow = ai.defineFlow(
  {
    name: 'distillSupportIntentFlow',
    inputSchema: DistillSupportIntentInputSchema,
    outputSchema: DistillSupportIntentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
