'use server';
/**
 * @fileOverview An AI chatbot flow that answers user questions based on help center articles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenterArticle } from '@/lib/data';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const AnswerChatQuestionInputSchema = z.object({
  question: z.string().describe("The user's question."),
  hubId: z.string().describe('The ID of the hub where the chat is taking place.'),
  allowedHelpCenterIds: z.array(z.string()).describe('A list of help center IDs the bot is allowed to access.'),
  userId: z.string().describe('The ID of the user asking the question (for access control).'),
  botName: z.string().describe('The name of the bot.'),
  conversationState: z.enum(['ai_active', 'escalation_offered', 'escalation_declined', 'human_assigned']).optional().describe("The current state of the conversation."),
  history: z.array(MessageSchema).optional().describe("The conversation history so far."),
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
  suggestedNextStep: z.string().optional().nullable().describe('A suggested next step if the answer is incomplete, e.g., "Would you like me to open a ticket?", "offer_escalation", or "escalate"'),
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

      // In a real RAG implementation, you'd perform vector search here
      // and return only the most relevant chunks. For now, we filter by title.
      return accessibleArticles.filter(a => a.title.toLowerCase().includes(input.query.toLowerCase()) || a.content.toLowerCase().includes(input.query.toLowerCase()));

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
    prompt: `You are a brand-specific support assistant for {{{botName}}}, not a generic chatbot. Your job is to help users with questions related to {{{botName}}}’s product or service.

CRITICAL PHILOSOPHY:
- You must sound human, confident, and calm.
- If a good human support rep for {{{botName}}} wouldn’t say it, you shouldn’t either.
- Never expose internal limitations, tools, or system behavior. Do not say "I am designed to...", "I can only answer...", "Your question does not match...", or "I didn't find an article...".
- Always frame help in terms of {{{botName}}}. When orienting the user, say things like: “I’m here to help with your {{{botName}}} questions.”

CONVERSATION STATE RULES:
The current conversation state is: '{{conversationState}}'.
- If the state is 'escalation_declined', you MUST NOT escalate again. You must try to help based on the user's message.
- If the state is 'human_assigned', you must not respond at all.

RESPONSE RULES:
First, classify the user's LATEST message into ONE category: 'greeting', 'how_to', 'troubleshooting', 'billing', 'account_specific', 'upset', 'unknown'.

1.  If 'greeting' (e.g. "hello", "hi"):
    - Respond warmly, use the brand name, and invite them to ask a question.
    - Example: "Hey there! 👋 I’m here to help with your {{{botName}}} questions. What can I help you with today?"
    - Set 'suggestedNextStep' to null.

2.  If 'billing' OR 'upset' OR an explicit request for a "human" or "agent":
    - If 'conversationState' is 'escalation_offered' or 'escalation_declined', the user is insisting. Set 'suggestedNextStep' to "escalate". Answer: "Let me get you to a team member who can take over from here."
    - Otherwise, offer to escalate. Set 'suggestedNextStep' to "offer_escalation". For billing, answer: "I can connect you with someone from the {{{botName}}} team to help with this." For upset users, answer: "I’m sorry this has been frustrating. Let me bring in someone from the {{{botName}}} team to help."

3.  For ALL OTHER questions ('how_to', 'troubleshooting', 'account_specific', 'unknown'):
    - First, use the 'search_help_center' tool to find relevant articles.
    - **Article-First Override**: If the user's message is a direct question about a topic in your knowledge base (e.g., "tell me about bins"), you MUST answer it directly using the tool results, even if confidence would otherwise be low.
    - If helpful articles are found, provide a **direct answer first**, grounded in the content. Then, list 1-3 of the best articles under a "Sources:" heading.
    - If no relevant articles are found, or if confidence is low, try to provide your best-guess guidance based on general product knowledge. Then, you may ask ONE clarifying question. Do NOT mention the search failure.
    - If you are still not confident after trying to help, and the 'conversationState' is NOT 'escalation_declined', you may offer to escalate by setting 'suggestedNextStep' to "offer_escalation" and providing a message like "I'm not sure I have the answer to that. Would you like to talk to a team member?".

RESPONSE FORMAT:
Your final output MUST be a JSON object matching this schema.
- **answer**: Your clear, direct answer in plain language.
- **sources**: (Optional) An array of 1-3 source articles, each with \`articleId\`, \`title\`, \`url\`.
- **suggestedNextStep**: (Optional) Set to "escalate" for immediate handoff, "offer_escalation" to propose a handoff, or null.

CONVERSATION HISTORY (for context):
{{#each history}}
- **{{role}}**: {{content}}
{{/each}}

LATEST USER QUESTION:
"{{{question}}}"`,
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