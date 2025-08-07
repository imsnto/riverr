'use server';
/**
 * @fileOverview An AI assistant for help with writing documents.
 *
 * - assistInDocument - A function that provides writing assistance.
 * - AssistInDocumentInput - The input type for the assistInDocument function.
 * - AssistInDocumentOutput - The return type for the assistInDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssistInDocumentInputSchema = z.object({
  documentContent: z.string().describe('The full content of the document to provide context.'),
  request: z.string().describe('The user\'s specific request for assistance (e.g., "summarize this", "rephrase this paragraph", "give me an outline for a proposal").'),
});
export type AssistInDocumentInput = z.infer<typeof AssistInDocumentInputSchema>;

const AssistInDocumentOutputSchema = z.object({
  suggestion: z.string().describe('The AI-generated suggestion, formatted as plain text or Markdown.'),
});
export type AssistInDocumentOutput = z.infer<typeof AssistInDocumentOutputSchema>;


export async function assistInDocument(input: AssistInDocumentInput): Promise<AssistInDocumentOutput> {
  return assistInDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assistInDocumentPrompt',
  input: {schema: AssistInDocumentInputSchema},
  output: {schema: AssistInDocumentOutputSchema},
  prompt: `You are a helpful writing assistant embedded in a project management tool. Your role is to help users with their documents.

Analyze the user's request and the provided document content to generate a helpful response.

**User Request:**
{{{request}}}

**Full Document Content (for context):**
---
{{{documentContent}}}
---

Based on the request, provide a clear and concise suggestion. The output should be formatted and ready to be copied into the document. Do not add any conversational fluff or apologies.
`,
});

const assistInDocumentFlow = ai.defineFlow(
  {
    name: 'assistInDocumentFlow',
    inputSchema: AssistInDocumentInputSchema,
    outputSchema: AssistInDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
