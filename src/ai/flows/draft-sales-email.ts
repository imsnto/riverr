'use server';
/**
 * @fileOverview An AI flow for drafting personalized sales emails.
 *
 * - draftSalesEmail - A function that generates a sales email based on lead and persona data.
 * - DraftSalesEmailInput - The input type for the draftSalesEmail function.
 * - DraftSalesEmailOutput - The return type for the draftSalesEmail function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftSalesEmailInputSchema = z.object({
  lead: z.object({
    name: z.string().optional(),
    company: z.string().optional(),
  }),
  persona: z.object({
    summary: z.string(),
    winningAngles: z.array(z.string()),
  }).optional(),
  messagePattern: z.object({
    purpose: z.string(),
    bodyStructure: z.string(),
    ctaStyle: z.string(),
    openerStyle: z.string(),
    toneTagsSorted: z.array(z.string()),
  }).optional(),
});
export type DraftSalesEmailInput = z.infer<typeof DraftSalesEmailInputSchema>;


const DraftSalesEmailOutputSchema = z.object({
    subject: z.string().describe("A compelling, concise email subject line."),
    body: z.string().describe("The full, personalized email body. Use markdown for formatting."),
});
export type DraftSalesEmailOutput = z.infer<typeof DraftSalesEmailOutputSchema>;


export async function draftSalesEmail(input: DraftSalesEmailInput): Promise<DraftSalesEmailOutput> {
  return draftSalesEmailFlow(input);
}


const prompt = ai.definePrompt({
  name: 'draftSalesEmailPrompt',
  input: {schema: DraftSalesEmailInputSchema},
  output: {schema: DraftSalesEmailOutputSchema},
  prompt: `You are an expert sales copywriter. Your task is to draft a personalized outreach email to a lead.

**Lead Information:**
- Name: {{{lead.name}}}
- Company: {{{lead.company}}}

**Matched Persona Profile:**
{{#if persona}}
- Summary: {{{persona.summary}}}
- Key angles that work for this persona: {{#each persona.winningAngles}}- {{{this}}}{{/each}}
{{else}}
- No matching persona found.
{{/if}}

**Recommended Message Pattern:**
{{#if messagePattern}}
- Purpose: {{{messagePattern.purpose}}}
- Opener Style: {{{messagePattern.openerStyle}}}
- Body Structure: {{{messagePattern.bodyStructure}}}
- CTA Style: {{{messagePattern.ctaStyle}}}
- Tone: {{#each messagePattern.toneTagsSorted}}{{{this}}} {{/each}}
{{else}}
- No specific message pattern recommended. Use your best judgment for a cold outreach email.
{{/if}}

**Your Task:**
Based on all the provided information, write a highly personalized and effective sales email.

1.  **Subject Line**: Create a subject that is intriguing and relevant to the lead.
2.  **Email Body**:
    *   Craft an opener that aligns with the recommended 'openerStyle'.
    *   Structure the body according to the 'bodyStructure' (e.g., address their pain, provide proof, then have a call-to-action).
    *   Weave in the 'winningAngles' for the persona to make the email resonate.
    *   Maintain the recommended 'tone'.
    *   End with a clear Call-to-Action (CTA) that matches the 'ctaStyle'.
    *   Address the lead by their name, and keep the email concise and professional.
`,
});


const draftSalesEmailFlow = ai.defineFlow(
  {
    name: 'draftSalesEmailFlow',
    inputSchema: DraftSalesEmailInputSchema,
    outputSchema: DraftSalesEmailOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
