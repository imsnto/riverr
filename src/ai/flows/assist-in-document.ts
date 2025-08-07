
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

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const AssistInDocumentInputSchema = z.object({
  documentContent: z.string().describe('The full content of the document to provide context.'),
  history: z.array(MessageSchema).describe('The history of the conversation so far.'),
  request: z.string().describe('The user\'s latest message or request.'),
});
export type AssistInDocumentInput = z.infer<typeof AssistInDocumentInputSchema>;

const AssistInDocumentOutputSchema = z.object({
  response: z.string().describe('The AI\'s conversational response to the user.'),
  modification: z.string().optional().describe('A specific change or addition for the document, provided only when the user explicitly asks for it.'),
});
export type AssistInDocumentOutput = z.infer<typeof AssistInDocumentOutputSchema>;


export async function assistInDocument(input: AssistInDocumentInput): Promise<AssistInDocumentOutput> {
  return assistInDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assistInDocumentPrompt',
  input: {schema: AssistInDocumentInputSchema},
  output: {schema: AssistInDocumentOutputSchema},
  prompt: `You are a helpful and conversational writing assistant embedded in a project management tool. Your role is to help users with their documents by chatting with them, answering questions, and making suggestions.

You can and should hold a conversation. Do not be overly formal.

**CRITICAL INSTRUCTIONS:**
1.  **Conversational First**: Your primary goal is to be a good conversational partner. Always provide a helpful, conversational response in the 'response' field.
2.  **Generate Modifications ONLY on Command**: Only populate the 'modification' field if the user's latest request is an EXPLICIT command to change, add, or rewrite something in the document. For example: "insert that," "rephrase this paragraph," "add a summary," "fix the grammar in this section."
3.  **For questions or general discussion, leave 'modification' empty**: If the user asks a question (e.g., "What are some good titles for this?") or discusses ideas, provide your answer in the 'response' field and leave the 'modification' field empty.

**Conversation History:**
{{#each history}}
- **{{role}}**: {{content}}
{{/each}}

**Full Document Content (for context):**
---
{{{documentContent}}}
---

**User's Latest Request:**
"{{{request}}}"

Based on the user's latest request and the conversation history, provide a 'response'. If and only if the request is an explicit command to modify the document, also provide the 'modification' text.
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
