'use server';
/**
 * @fileOverview Distills a sales conversation into structured signals.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SalesConversationExtractionSchema = z.object({
  leadPersonaHints: z.object({
    industry: z.string().optional().describe("The lead's industry, if mentioned (e.g., 'SaaS', 'Healthcare')."),
    role: z.string().optional().describe("The lead's job role, if mentioned (e.g., 'CEO', 'Head of Engineering')."),
    orgSize: z.enum(['solo', 'small', 'mid', 'enterprise']).optional().describe("The size of the lead's organization."),
    nicheTags: z.array(z.string()).optional().describe("Specific tags about the lead's niche (e.g., 'fintech', 'B2B')."),
    geo: z.string().optional().describe("Geographic location of the lead."),
  }),
  pains: z.array(z.string()).describe("Direct quotes or summaries of problems the lead is experiencing."),
  objections: z.array(z.string()).describe("Reasons the lead gives for not wanting to buy or proceed."),
  buyingSignals: z.array(z.string()).describe("Positive signals indicating interest in the product (e.g., 'This could save us time', 'What's the pricing?')."),
  outboundMessages: z.array(z.object({
    messageId: z.string().optional(),
    purpose: z.enum(['initial', 'followup_1', 'followup_2', 'breakup', 'reply']).describe("The purpose of the sales rep's message."),
    subject: z.string().optional().describe("The email subject line."),
    opener: z.string().describe("The first sentence or two of the message."),
    cta: z.string().describe("The call-to-action at the end of the message."),
    bodyStructure: z.enum(['pain->proof->cta', 'proof->pain->cta', 'value_drop->cta', 'question_only', 'other']).describe("The structure of the message body."),
    toneTags: z.array(z.string()).describe("Tags describing the tone (e.g., 'direct', 'warm', 'consultative')."),
    lengthBucket: z.enum(['short', 'medium', 'long']).describe("The approximate length of the message body."),
  })).describe("Structured analysis of messages sent by the sales rep."),
  outcome: z.enum(['replied_positive', 'replied_negative', 'no_reply', 'meeting_booked', 'closed_won', 'closed_lost', 'unknown']).describe("The final outcome of the conversation."),
  recommendedPersonaClusterText: z.string().describe("A compact string summarizing persona hints, pains, and objections for embedding and clustering."),
  notes: z.string().optional().describe("Any other relevant notes or observations."),
});

export type SalesConversationExtraction = z.infer<typeof SalesConversationExtractionSchema>;

export const DistillSalesIntelligenceInputSchema = z.object({
    conversationText: z.string(),
    participants: z.array(z.object({ email: z.string().optional(), name: z.string().optional(), role: z.enum(['customer','agent','rep','internal']) })),
});

export async function extractSalesConversation(input: z.infer<typeof DistillSalesIntelligenceInputSchema>): Promise<SalesConversationExtraction> {
  return extractSalesConversationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSalesConversationPrompt',
  input: {schema: DistillSalesIntelligenceInputSchema},
  output: {schema: SalesConversationExtractionSchema},
  prompt: `You are an expert sales operations analyst. Your job is to dissect a sales conversation and extract structured data.

Analyze the following conversation transcript. The 'rep' is our salesperson, and the 'customer' is the lead.

**Conversation Transcript:**
---
{{{conversationText}}}
---

**Participants:**
{{#each participants}}
- {{name}} ({{email}}): {{role}}
{{/each}}

**Your Task:**
Based on the transcript and participant roles, fill out the JSON object with the specified schema.

- **leadPersonaHints**: Extract information about the lead (the 'customer').
- **pains**: What problems or challenges did the lead mention?
- **objections**: What reasons did the lead give for not proceeding?
- **buyingSignals**: What positive indicators did the lead show?
- **outboundMessages**: Analyze EACH message from the 'rep'. Classify its purpose, structure, tone, and length.
- **outcome**: Determine the final result of this entire interaction.
- **recommendedPersonaClusterText**: Create a compact string combining the lead's industry, role, pains, and objections. This will be used for clustering. Example: "industry:saas role:ceo pains:slow_manual_process,high_cost objections:too_expensive". Use snake_case for keywords.

If you are uncertain about a field, leave it empty or as an empty array. Do not invent information.
`,
});

const extractSalesConversationFlow = ai.defineFlow(
  {
    name: 'extractSalesConversationFlow',
    inputSchema: DistillSalesIntelligenceInputSchema,
    outputSchema: SalesConversationExtractionSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
