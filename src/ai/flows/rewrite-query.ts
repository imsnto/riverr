'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RewriteQueryInputSchema = z.object({
  query: z.string().describe("The user's latest message."),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional()
    .describe('Recent conversation turns for context.'),
  botContext: z.string().optional().describe('Brief description of what the business/bot is about.'),
});

const RewriteQueryOutputSchema = z.object({
  rewrittenQuery: z.string().describe('The rewritten search query optimized for vector retrieval.'),
});

const prompt = ai.definePrompt({
  name: 'rewriteQueryPrompt',
  input: { schema: RewriteQueryInputSchema },
  output: { schema: RewriteQueryOutputSchema },
  prompt: `You are a search query optimizer. Your job is to rewrite a user's conversational message into a concise, keyword-rich search query that will retrieve the most relevant documents from a knowledge base.

{{#if botContext}}
Business context: {{{botContext}}}
{{/if}}

{{#if history}}
Recent conversation:
{{#each history}}
{{role}}: {{{content}}}
{{/each}}
{{/if}}

User's message: "{{{query}}}"

Rules:
- Output ONLY the rewritten search query, nothing else.
- Use specific nouns and keywords. Remove filler words ("what is", "can you tell me", "I want to know").
- If business context is provided, extract the business name and prefix the query with it (e.g. "SportZone BD official website URL").
- If the query references something from conversation history (e.g. "that product", "it"), resolve the reference using the business name if relevant.
- Keep it under 15 words.
- Do NOT answer the question — just rewrite it for search.

Examples (assuming business context is "SportZone BD"):
  "what is your website link?" → "SportZone BD official website URL"
  "how do I return something I bought?" → "SportZone BD return policy refund process"
  "do you deliver to Dhaka?" → "SportZone BD delivery shipping Dhaka"
  "what about the price?" (prev: discussing jerseys) → "SportZone BD jersey price cost"
  "how can I contact you?" → "SportZone BD contact phone email address"
`,
});

const rewriteQueryFlow = ai.defineFlow(
  {
    name: 'rewriteQueryFlow',
    inputSchema: RewriteQueryInputSchema,
    outputSchema: RewriteQueryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function rewriteQueryForRetrieval(args: {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  botContext?: string;
}): Promise<string> {
  try {
    const result = await rewriteQueryFlow(args);
    console.log(`[rewriteQuery] "${args.query}" → "${result.rewrittenQuery}"`);
    return result.rewrittenQuery;
  } catch (e) {
    console.error('[rewriteQuery] failed, using original query:', e);
    return args.query;
  }
}
