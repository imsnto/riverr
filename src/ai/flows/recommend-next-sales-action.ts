
'use server';
/**
 * @fileOverview Recommends the next best sales action for a given lead.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const RecommendNextSalesActionInputSchema = z.object({
    lead: z.object({
        id: z.string(),
        name: z.string().optional(),
        company: z.string().optional(),
        primaryEmail: z.string().optional(),
        lastSeenAt: z.string().optional(),
    }),
    matchedPersona: z.object({
        segmentKey: z.string(),
        summary: z.string(),
        commonPains: z.array(z.string()),
        winningAngles: z.array(z.string()),
    }).optional(),
    bestMessagePattern: z.object({
        patternKey: z.string(),
        purpose: z.string(),
        bodyStructure: z.string(),
        ctaStyle: z.string(),
        openerStyle: z.string(),
        toneTagsSorted: z.array(z.string()),
    }).optional(),
});

export const RecommendNextSalesActionOutputSchema = z.object({
    recommendedNextAction: z.string().describe("A concise, specific next action to take for this lead. E.g., 'Send personalized outreach email', 'Follow-up on previous thread', 'Schedule for sequence'.") ,
    recommendedPatternKey: z.string().optional().describe("The key of the message pattern that is best suited for this action."),
    reason: z.string().describe("A brief explanation for why this action is being recommended, citing the persona and lead data."),
});

export async function recommendNextSalesAction(input: z.infer<typeof RecommendNextSalesActionInputSchema>): Promise<z.infer<typeof RecommendNextSalesActionOutputSchema>> {
  return recommendNextSalesActionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendNextSalesActionPrompt',
  input: {schema: RecommendNextSalesActionInputSchema},
  output: {schema: RecommendNextSalesActionOutputSchema},
  prompt: `You are an expert sales operations AI. Your job is to recommend the next best action for a sales lead based on their profile and our internal persona data.

**Lead Information:**
- Name: {{{lead.name}}}
- Company: {{{lead.company}}}
- Email: {{{lead.primaryEmail}}}
- Last Seen: {{{lead.lastSeenAt}}}

**Matched Persona:**
{{#if matchedPersona}}
- Segment: {{{matchedPersona.segmentKey}}}
- Summary: {{{matchedPersona.summary}}}
- Common Pains: {{#each matchedPersona.commonPains}}- {{{this}}}{{/each}}
- Winning Angles: {{#each matchedPersona.winningAngles}}- {{{this}}}{{/each}}
{{else}}
- No matching persona found.
{{/if}}

**Best Performing Message Pattern:**
{{#if bestMessagePattern}}
- Pattern Key: {{{bestMessagePattern.patternKey}}}
- Style: {{{bestMessagePattern.openerStyle}}} opener, {{{bestMessagePattern.bodyStructure}}} structure, {{{bestMessagePattern.ctaStyle}}} CTA.
- Tone: {{#each bestMessagePattern.toneTagsSorted}}{{{this}}} {{/each}}
{{else}}
- No message pattern data available.
{{/if}}


**Your Task:**
Based on all the provided data, determine the single best "next action" to take for this lead.
1.  **recommendedNextAction**: Be specific. Examples: "Send initial outreach email", "Send follow-up about pricing", "Add to automated nurture sequence", "Mark as 'Do Not Contact'".
2.  **recommendedPatternKey**: If a message should be sent, provide the key of the best message pattern to use. If no message is needed, leave this empty.
3.  **reason**: Briefly explain your recommendation. What about the lead or their persona makes this the right next step?
`,
});

const recommendNextSalesActionFlow = ai.defineFlow(
  {
    name: 'recommendNextSalesActionFlow',
    inputSchema: RecommendNextSalesActionInputSchema,
    outputSchema: RecommendNextSalesActionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

