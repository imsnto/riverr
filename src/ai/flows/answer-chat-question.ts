'use server';
/**
 * @fileOverview An AI chatbot flow that answers user questions based on help center articles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenterArticle } from '@/lib/data';

const AnswerChatQuestionInputSchema = z.object({
  question: z.string().describe("The user's question."),
  hubId: z.string().describe('The ID of the hub where the chat is taking place.'),
  allowedHelpCenterIds: z.array(z.string()).describe('A list of help center IDs the bot is allowed to access.'),
  userId: z.string().describe('The ID of the user asking the question (for access control).'),
  botName: z.string().describe('The name of the bot.'),
});
type AnswerChatQuestionInput = z.infer<typeof AnswerChatQuestionInputSchema>;

const AnswerChatQuestionOutputSchema = z.object({
  answer: z.string().describe('A direct, helpful answer to the user\'s question, in plain language.'),
  sources: z.array(z.object({
    articleId: z.string(),
    title: z.string(),
    url: z.string(),
    relevanceScore: z.number().optional(),
  })).optional().describe('A list of 1-3 source articles used to formulate the answer.'),
  suggestedNextStep: z.string().optional().nullable().describe('A suggested next step if the answer is incomplete, e.g., "Would you like me to open a ticket?" or "escalate"'),
});
type AnswerChatQuestionOutput = z.infer<typeof AnswerChatQuestionOutputSchema>;

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


const answerChatPrompt = ai.definePrompt({
    name: 'answerChatPrompt',
    input: { schema: AnswerChatQuestionInputSchema },
    output: { schema: AnswerChatQuestionOutputSchema },
    tools: [searchHelpCenter],
    prompt: `You are the {{botName}} support assistant. Your job is to help users by answering questions clearly and concisely, and escalating to a human when necessary. You represent the brand and should sound human, confident, and calm.

      **CRITICAL RULES:**
      1.  **NEVER SAY**: "I am designed to...", "I can only answer based on...", "I cannot answer that because...", "Your question does not match...", "I didn’t find an article...".
      2.  **GREETINGS**: If the user says "hello" or "hi", respond warmly and invite them to ask a question (e.g., "Hey there! 👋 I’m here to help with your {{botName}} questions. What can I help you with today?"). Do not perform a search for simple greetings.
      3.  **IMMEDIATE ESCALATION**: If the user's message contains billing/money keywords, if they seem upset/frustrated, or if they explicitly ask for a human, you MUST escalate. To escalate, set the 'answer' to a polite handoff message (e.g., "I’m going to connect you with a teammate who can help with this.") and set the 'suggestedNextStep' field to "escalate".
          *   **Billing Keywords**: refund, charge, charged, billing, invoice, payment, credit card, overcharged, subscription, pricing error.
          *   **Human Request**: person, human, agent, support rep.
      4.  **HELP & TROUBLESHOOTING**: For all other questions, first, use the \`search_help_center\` tool to find relevant articles.
          *   If you find relevant information, provide a **direct answer first**. Then, if you used sources, list them under a "Sources:" heading.
          *   If the search results are not helpful, do NOT mention the search. Try to provide your best-guess guidance based on general product knowledge.
          *   If you are not confident, it's better to escalate than to give a wrong answer.
      5.  **ANSWER FORMAT**: Provide a direct answer. If you used sources, add a "Sources:" section with links. Example:
          Answer:
          You can reset your password by going to the settings page.

          Sources:
          - How to Reset Your Password — /hc/1/articles/123

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

export async function answerChatQuestion(input: AnswerChatQuestionInput): Promise<AnswerChatQuestionOutput> {
  return answerChatQuestionFlow(input);
}
