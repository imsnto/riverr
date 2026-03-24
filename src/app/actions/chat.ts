
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { 
  handleIncomingMessage, 
  AgentAdapters, 
  BotConfig, 
  Conversation, 
  IncomingMessage, 
  SearchHelpCenterParams, 
  SearchHelpCenterResult, 
  HelpChunk, 
  SearchSupportParams, 
  SearchSupportResult 
} from '@/lib/agent';
import { resolveRuntimeBot } from '@/lib/bot-runtime';
import { ChatMessage } from '@/lib/data';
import { agentResponse } from '@/ai/flows/agent-response';
import admin from 'firebase-admin';
import { getMessagingProvider } from '@/lib/comms/providerFactory';
import { retrieveBrainContext } from '@/lib/brain/retrieve-context';
import { searchBrainChunks, searchSupportMemory } from '@/lib/brain/vector-search';

export type PreviewAgentResponseResult = {
  answer: string;
  usedAgentName: string;
  sources: Array<{
    articleId: string;
    title: string;
    url: string;
    score: number;
  }>;
};

/**
 * Searches the Help Center documentation using Firestore Vector Search.
 * TIER 1: Primary Answer Sources (Articles)
 */
async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  const { hubId, allowedHelpCenterIds, userId, query, topK = 8 } = params;

  if (!hubId || !query?.trim()) return { chunks: [] };

  const results = await searchBrainChunks({
    query,
    hubId,
    limit: topK
  });

  const chunks = results
    .filter((c: any) => {
      const hcOk = !allowedHelpCenterIds?.length || 
                   !c.helpCenterId || 
                   allowedHelpCenterIds.includes(c.helpCenterId);

      const visibilityOk = c.visibility === 'public' || 
                           c.visibility === 'internal' || 
                           (c.visibility === 'private' && userId && c.allowedUserIds?.includes(userId));

      return hcOk && visibilityOk;
    })
    .map(c => ({
      chunkText: c.text,
      score: c.score,
      articleId: c.sourceId || c.id,
      title: c.title || 'Untitled',
      url: c.url || '',
      helpCenterIds: c.helpCenterId ? [c.helpCenterId] : [],
      articleType: 'article' as const,
      articleContent: null,
    }));

  return { chunks: chunks as HelpChunk[] };
}

/**
 * Searches the Distilled Support Brain using Firestore Vector Search.
 * TIER 2: Supporting Intelligence (Insights)
 */
async function searchSupport(params: SearchSupportParams): Promise<SearchSupportResult> {
  const { hubId, query, topK = 5 } = params;
  if (!hubId || !query?.trim()) return { intents: [] };

  const results = await searchSupportMemory({
    query,
    hubId,
    limit: topK
  });

  const intents: any[] = results.map((res: any) => ({
    id: res.id,
    intentKey: res.intentKey,
    title: res.title,
    description: res.description,
    _searchScore: res.score,
  }));

  return { intents };
}

/**
 * Non-mutating version of the agent logic used for settings previews.
 */
export async function previewAgentResponseAction(args: {
  widgetBotId: string;
  message: string;
  visitor?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}): Promise<PreviewAgentResponseResult> {
  const widgetBotId = String(args.widgetBotId || '').trim();
  const message = String(args.message || '').trim();

  if (!widgetBotId) {
    throw new Error('widgetBotId is required');
  }

  if (!message) {
    return {
      answer: '',
      usedAgentName: 'Assistant',
      sources: [],
    };
  }

  const resolved = await resolveRuntimeBot(widgetBotId);
  const effectiveBot = resolved?.effectiveBot;

  if (!effectiveBot) {
    throw new Error('Unable to resolve runtime bot');
  }

  const botName = effectiveBot.webAgentName || effectiveBot.name || 'Assistant';
  
  // REAL RETRIEVAL PATH
  const context = await retrieveBrainContext({
    message,
    hubId: effectiveBot.hubId,
    allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds,
    userId: null,
  });

  const conversationGoal = effectiveBot.conversationGoal || effectiveBot.primaryGoal || 'Provide information and let customer decide';

  let systemInstruction = `You are ${botName}, a helpful AI assistant. Be conversational, warm, accurate, and concise.`;

  if (conversationGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${conversationGoal}`;
  }

  const result = await agentResponse({
    query: message,
    botName,
    context: context?.chunks.map(c => ({ title: c.title || 'Source', text: c.text, url: c.url })) || [],
    greetingScript: systemInstruction,
  });

  return {
    answer: (result?.answer || '').trim() || `I'm not sure yet, but I need a little more detail to help with that.`,
    usedAgentName: botName,
    sources: (context?.chunks || []).slice(0, 3).map((c) => ({
      articleId: c.sourceId || c.id,
      title: c.title || 'Untitled',
      url: c.url || '',
      score: c.score,
    })),
  };
}

export async function invokeAgent(args: {
  bot: any;
  conversation: Conversation;
  message: IncomingMessage;
}) {
  let { bot, conversation } = args;

  const resolved = bot?.id ? await resolveRuntimeBot(bot.id) : null;
  const effectiveBot = resolved?.effectiveBot || bot;

  const adapters: AgentAdapters = {
    searchHelpCenter,
    searchSupport,
    generateAnswer: async (params) => {
      const result = await agentResponse(params);
      return result.answer;
    },
    escalateToHuman: async ({ conversationId, reason }) => {
      await adminDB.collection('conversations').doc(conversationId).update({
        status: 'waiting_human',
        escalated: true,
        escalationReason: reason,
        state: 'human_assigned',
      });
    },
    persistAssistantMessage: async ({ conversationId, text, responderType }) => {
      const convo = await adminDB.collection('conversations').doc(conversationId).get();
      const convoData = convo.data() as Conversation;

      const messageData: Omit<ChatMessage, 'id'> = {
        conversationId,
        authorId: 'ai_agent',
        type: 'message',
        senderType: 'agent',
        responderType,
        content: text,
        timestamp: new Date().toISOString(),
      };

      if (convoData?.channel === 'sms') {
        const msgRef = await adminDB.collection('chat_messages').add({
          ...messageData,
          channel: 'sms',
          provider: 'twilio',
          deliveryStatus: 'created',
        });

        const provider = getMessagingProvider('twilio');

        try {
          const { providerMessageId } = await provider.sendSms({
            from: convoData.channelAddress!,
            to: convoData.externalAddress!,
            body: text,
          });

          await msgRef.update({
            providerMessageId,
            deliveryStatus: 'queued',
          });

          await adminDB.doc(`provider_message_lookups/twilio_${providerMessageId}`).set({
            messageId: msgRef.id,
            conversationId,
          });
        } catch (e) {
          console.error('AI SMS delivery failed', e);
          await msgRef.update({ deliveryStatus: 'failed' });
        }
      } else {
        await adminDB.collection('chat_messages').add(messageData);
      }
    },
    updateConversation: async ({ conversationId, patch }) => {
      await adminDB.collection('conversations').doc(conversationId).update(patch);
    },
  };

  const botConfig: BotConfig = {
    id: effectiveBot.id,
    hubId: effectiveBot.hubId,
    name: effectiveBot.name,
    webAgentName: effectiveBot.webAgentName || effectiveBot.name,
    allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds || [],
    aiEnabled: effectiveBot.aiEnabled !== false,
    handoffKeywords:
      effectiveBot.channelConfig?.web?.handoffKeywords ||
      effectiveBot.automations?.handoffKeywords ||
      ['human', 'agent', 'person', 'representative', 'support'],
    quickReplies:
      effectiveBot.automations?.quickReplies || [],
    flow: effectiveBot.flow,
    conversationGoal:
      effectiveBot.conversationGoal ||
      effectiveBot.primaryGoal ||
      'Provide information and let customer decide',
    identityCapture:
      effectiveBot.identityCapture || {
        timing: 'after',
        fields: {
          name: true,
          email: true,
          phone: false,
        },
      },
  };

  await handleIncomingMessage({
    ...args,
    conversation,
    bot: botConfig,
    adapters,
  });
}

export async function addChatMessage(message: Omit<ChatMessage, 'id'>) {
  const docRef = await adminDB.collection('chat_messages').add(message);
  return { id: docRef.id, ...message };
}

export async function updateConversation(id: string, patch: Partial<Conversation>) {
  await adminDB.collection('conversations').doc(id).update(patch);
}

export async function createConversationAndLinkCrm(data: {
  hubId: string;
  visitorId: string;
  assigneeId: string | null;
  lastMessage: string;
  lastMessageAuthor: string | null;
}) {
  const now = new Date().toISOString();
  const hubSnap = await adminDB.collection('hubs').doc(data.hubId).get();
  const spaceId = hubSnap.data()?.spaceId;

  const convoRef = await adminDB.collection('conversations').add({
    hubId: data.hubId,
    spaceId,
    visitorId: data.visitorId,
    assigneeId: data.assigneeId,
    assignedAgentIds: data.assigneeId ? [data.assigneeId] : [],
    status: 'ai_active',
    state: 'ai_active',
    channel: 'webchat', 
    lastMessage: data.lastMessage,
    lastMessageAt: now,
    lastMessageAuthor: data.lastMessageAuthor,
    createdAt: now,
    updatedAt: now,
    ownerType: 'hub',
    ownerAgentId: null,
    sharedWithTeam: true,
    aiAttempted: false,
    aiResolved: false,
  });

  return { id: convoRef.id, hubId: data.hubId, spaceId };
}

export async function ensureConversationCrmLinkedAction(conversationId: string) {
  const convoRef = adminDB.collection('conversations').doc(conversationId);
  const convoSnap = await convoRef.get();
  const convo = convoSnap.data();
  if (!convo || convo.contactId) return;

  const visitorSnap = await adminDB.collection('visitors').doc(convo.visitorId).get();
  const visitor = visitorSnap.data();
  if (!visitor?.email) return;

  const contactQuery = await adminDB.collection('contacts')
    .where('spaceId', '==', convo.spaceId)
    .where('primaryEmail', '==', visitor.email.toLowerCase())
    .limit(1)
    .get();

  if (!contactQuery.empty) {
    await convoRef.update({ contactId: contactQuery.docs[0].id });
  }
}

export async function reindexArticleAction(articleId: string) {
  // Placeholder - in real app would trigger indexing job
}

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}

export async function searchSupportAction(params: SearchSupportParams): Promise<SearchSupportResult> {
  return searchSupport(params);
}
