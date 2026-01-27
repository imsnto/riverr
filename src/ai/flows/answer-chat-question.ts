'use server';
/**
 * @fileOverview An AI chatbot flow that answers user questions based on help center articles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenterArticle } from '@/lib/data';

// 1. DEFINE SCHEMAS
export const AnswerChatQuestionInputSchema = z.object({
  question: z.string().describe("The user's question."),
  hubId: z.string().describe('The ID of the hub where the chat is taking place.'),
  allowedHelpCenterIds: z.array(z.string()).describe('A list of help center IDs the bot is allowed to access.'),
  userId: z.string().describe('The ID of the user asking the question (for access control).'),
});
export type AnswerChatQuestionInput = z.infer<typeof AnswerChatQuestionInputSchema>;

const AnswerChatQuestionOutputSchema = z.object({
  answer: z.string().describe('A direct, helpful answer to the user\'s question, in plain language.'),
  sources: z.array(z.object({
    articleId: z.string(),
    title: z.string(),
    url: z.string(),
    relevanceScore: z.number().optional(),
  })).optional().describe('A list of 1-5 source articles used to formulate the answer.'),
  suggestedNextStep: z.string().optional().describe('A suggested next step if the answer is incomplete, e.g., "Would you like me to open a support ticket?"'),
});
export type AnswerChatQuestionOutput = z.infer<typeof AnswerChatQuestionOutputSchema>;

// 2. DEFINE THE TOOL
const searchHelpCenter = ai.defineTool(
  {
    name: 'search_help_center',
    description: 'Searches the knowledge base to find relevant articles to answer a user\'s question.',
    input: { schema: z.object({ query: z.string() }) },
    output: { schema: z.array(z.object({ articleId: z.string(), title: z.string(), content: z.string(), url: z.string() })) },
  },
  async (input, context) => {
    const flowData = context as AnswerChatQuestionInput;
    
    if (!flowData.hubId || !flowData.allowedHelpCenterIds || flowData.allowedHelpCenterIds.length === 0) {
      console.log("No hub or allowed help centers provided, skipping search.");
      return [];
    }

    try {
      const articlesRef = adminDB.collection('help_center_articles');
      
      const q = articlesRef
        .where('hubId', '==', flowData.hubId)
        .where('status', '==', 'published')
        .where('helpCenterIds', 'array-contains-any', flowData.allowedHelpCenterIds);
      
      const snapshot = await q.get();

      if (snapshot.empty) {
        return [];
      }
      
      const accessibleArticles = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle))
        .filter(article => {
          // Access control check
          if (article.isPublic) return true;
          if (article.allowedUserIds?.includes(flowData.userId)) return true;
          return false;
        })
        .map(article => ({
            articleId: article.id,
            title: article.title,
            // For this simplified version, we return the full content.
            // A real vector search would return relevant chunks.
            content: article.content, 
            url: `/hc/${article.helpCenterIds?.[0]}/articles/${article.id}`
        }));

      return accessibleArticles;

    } catch (error) {
      console.error("Error searching help center:", error);
      // It's better to return empty than to throw, so the AI can handle "no results".
      return [];
    }
  }
);


// 3. DEFINE THE PROMPT & FLOW
const answerChatPrompt = ai.definePrompt({
    name: 'answerChatPrompt',
    input: { schema: AnswerChatQuestionInputSchema },
    output: { schema: AnswerChatQuestionOutputSchema },
    tools: [searchHelpCenter],
    prompt: `You are a helpful support assistant. Your job is to help users by answering questions clearly and quickly based on the provided context.

      **CRITICAL INSTRUCTIONS:**
      1.  **Use Your Tools**: First, use the \`search_help_center\` tool with the user's question as the query to find relevant help articles.
      2.  **Ground Your Answer**: Base your answer **only** on the information retrieved from the help center articles.
      3.  **Answer Directly**: Provide a direct, concise answer to the user's question.
      4.  **Cite Sources**: If you used content from the articles, you **MUST** include a "Sources" section and list the top 1-3 most relevant articles you used. Use the title and URL provided by the tool.
      5.  **Be Honest**: If you cannot find an answer in the provided articles, state that you don't have the information and offer to create a support ticket. Do NOT invent answers.
      6.  **Handle No Results**: If the search tool returns no articles, inform the user you couldn't find any relevant documents and offer to help further (e.g., "I couldn't find any documents related to that. Would you like me to create a support ticket for you?").

      **User's Question:**
      "{{{question}}}"
      `,
});

const answerChatQuestionFlow = ai.defineFlow(
  {
    name: 'answerChatQuestionFlow',
    inputSchema: AnswerChatQuestionInputSchema,
    outputSchema: AnswerChatQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await answerChatPrompt(input);
    return output!;
  }
);

// 4. EXPORT THE WRAPPER FUNCTION
export async function answerChatQuestion(input: AnswerChatQuestionInput): Promise<AnswerChatQuestionOutput> {
  return answerChatQuestionFlow(input);
}
