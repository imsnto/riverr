'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CandidateSchema = z.object({
  id: z.string(),
  sourceType: z.enum(['article', 'topic', 'insight', 'chunk']),
  title: z.string().optional(),
  text: z.string(),
});

const RerankInputSchema = z.object({
  query: z.string(),
  candidates: z.array(CandidateSchema),
});

const RerankOutputSchema = z.object({
  relevantIds: z
    .array(z.string())
    .describe('IDs of relevant candidates, ordered from most to least relevant. Exclude irrelevant ones.'),
});

const rerankPrompt = ai.definePrompt({
  name: 'rerankCandidatesPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: { schema: RerankInputSchema },
  output: { schema: RerankOutputSchema },
  prompt: `You are a relevance filter for a customer support knowledge base.

User's question: "{{{query}}}"

Below are retrieved knowledge base documents. Your job:
1. Remove documents that are NOT relevant to the user's question.
2. Return the IDs of relevant documents, ordered from MOST to LEAST relevant.
3. If a document partially answers the question, keep it.
4. If a document is about a completely different topic, exclude it.

Documents:
{{#each candidates}}
---
ID: {{id}}
Type: {{sourceType}}
Title: {{title}}
Content: {{{text}}}
---
{{/each}}

Return ONLY the IDs of relevant documents in order. If none are relevant, return an empty array.`,
});

const rerankFlow = ai.defineFlow(
  {
    name: 'rerankCandidatesFlow',
    inputSchema: RerankInputSchema,
    outputSchema: RerankOutputSchema,
  },
  async (input) => {
    const { output } = await rerankPrompt(input);
    return output!;
  }
);

export type RerankCandidate = z.infer<typeof CandidateSchema>;

export async function rerankCandidates(args: {
  query: string;
  candidates: RerankCandidate[];
}): Promise<string[]> {
  if (args.candidates.length === 0) return [];

  try {
    // Truncate text to keep token count low — 300 chars is enough for relevance judgement
    const truncated = args.candidates.map((c) => ({
      ...c,
      text: c.text.substring(0, 300) + (c.text.length > 300 ? '...' : ''),
    }));

    const result = await rerankFlow({ query: args.query, candidates: truncated });

    console.log(`[rerankCandidates] input=${args.candidates.length} → relevant=${result.relevantIds.length}`);
    console.log(`[rerankCandidates] relevantIds:`, result.relevantIds);

    return result.relevantIds;
  } catch (e) {
    console.error('[rerankCandidates] failed, returning all candidates:', e);
    // Fallback: return all IDs in original order
    return args.candidates.map((c) => c.id);
  }
}
