
'use server';
/**
 * @fileOverview Summarizes a cluster of sales conversations into a persona segment.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SummarizeSalesClusterInputSchema = z.object({
    aggregatedPains: z.array(z.string()).describe("A collection of all customer pain points from this cluster."),
    aggregatedObjections: z.array(z.string()).describe("A collection of all customer objections from this cluster."),
    aggregatedBuyingSignals: z.array(z.string()).describe("A collection of all positive buying signals from this cluster."),
    examplePersonas: z.array(z.string()).describe("A list of example 'recommendedPersonaClusterText' strings from the conversations in this cluster.")
});

export const SummarizeSalesClusterOutputSchema = z.object({
    segmentKey: z.string().describe("A concise, descriptive, snake_case key for this persona segment (e.g., 'early_stage_fintech_founder')."),
    summary: z.string().describe("A one-paragraph summary describing this customer persona, their primary motivations, and their role."),
    commonPains: z.array(z.string()).describe("A list of the 3-5 most common pain points for this segment, summarized and consolidated."),
    commonObjections: z.array(z.string()).describe("A list of the 2-3 most common objections or hesitations for this segment."),
    winningAngles: z.array(z.string()).describe("A list of 2-3 key value propositions or 'winning angles' that resonate with this segment, derived from their pains and buying signals."),
});

export async function summarizeSalesCluster(input: z.infer<typeof SummarizeSalesClusterInputSchema>): Promise<z.infer<typeof SummarizeSalesClusterOutputSchema>> {
  return summarizeSalesClusterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeSalesClusterPrompt',
  input: {schema: SummarizeSalesClusterInputSchema},
  output: {schema: SummarizeSalesClusterOutputSchema},
  prompt: `You are a master sales analyst and strategist. Your task is to analyze a cluster of sales conversations and synthesize it into a coherent, actionable customer persona segment.

You have been given aggregated data from a number of similar sales prospects. Your goal is to find the common thread and create a profile.

**Example Personas from this Cluster:**
---
{{#each examplePersonas}}
- {{{this}}}
{{/each}}
---

**Aggregated Pains Mentioned:**
---
{{#each aggregatedPains}}
- {{{this}}}
{{/each}}
---

**Aggregated Objections Mentioned:**
---
{{#each aggregatedObjections}}
- {{{this}}}
{{/each}}
---

**Aggregated Buying Signals Mentioned:**
---
{{#each aggregatedBuyingSignals}}
- {{{this}}}
{{/each}}
---

**Your Task:**
Based on all the provided data, generate the following structured output:

1.  **segmentKey**: A concise, descriptive, snake_case key. This should capture the essence of the persona (e.g., 'non_technical_founder', 'enterprise_it_manager', 'smb_with_legacy_system').
2.  **summary**: A rich, one-paragraph summary. Who is this person? What is their role? What do they care about most? What is their primary driver for seeking a solution?
3.  **commonPains**: Distill the aggregated list into the top 3-5 most critical and frequently mentioned pain points. Rephrase them for clarity.
4.  **commonObjections**: Distill the aggregated list into the top 2-3 most common reasons for hesitation.
5.  **winningAngles**: Based on the pains and buying signals, what are the 2-3 most effective value propositions or arguments to use when selling to this persona?
`,
});

const summarizeSalesClusterFlow = ai.defineFlow(
  {
    name: 'summarizeSalesClusterFlow',
    inputSchema: SummarizeSalesClusterInputSchema,
    outputSchema: SummarizeSalesClusterOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
