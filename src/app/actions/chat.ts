
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { 
  handleIncomingMessage, 
  AgentAdapters, 
  BotConfig, 
  Conversation, 
  IncomingMessage, 
} from '@/lib/agent';
import { resolveRuntimeBot } from '@/lib/bot-runtime';
import { ChatMessage, IntelligenceAccessLevel } from '@/lib/data';
import { agentResponse } from '@/ai/flows/agent-response';
import { orchestrateRetrieval, AgentKnowledgePolicy } from '@/lib/brain/retrieve-context';
import { getMessagingProvider } from '@/lib/comms/providerFactory';
import { indexHelpCenterArticleToChunks } from '@/lib/knowledge/indexer';

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
 * Non-mutating version of the agent logic used for settings previews.
 * Updated to accept full botData for live previews of unsaved changes.
 */
export async function previewAgentResponseAction(args: {
  botData: any;
  message: string;
  visitor?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}): Promise<PreviewAgentResponseResult> {
  const message = String(args.message || '').trim();
  const effectiveBot = args.botData;

  if (!effectiveBot) throw new Error('botData is required');
  if (!message) return { answer: '', usedAgentName: 'Assistant', sources: [] };

  const webAgentName = effectiveBot.webAgentName || effectiveBot.name || 'Assistant';

  // PLUMBING: Policy derives from Bot Config
  const policy: AgentKnowledgePolicy = {
    agentId: effectiveBot.id,
    isCustomerFacing: effectiveBot.type === 'widget',
    accessLevel: effectiveBot.intelligenceAccessLevel || 'topics_only',
    allowedLibraryIds: effectiveBot.allowedHelpCenterIds || []
  };

  const decision = await orchestrateRetrieval({
    message,
    hubId: effectiveBot.hubId,
    spaceId: effectiveBot.spaceId,
    policy
  });

  let systemInstruction = `You are ${webAgentName}, a helpful AI assistant. Be conversational, warm, and accurate.`;
  
  if (decision.answerMode === 'insight_supported_hidden') {
    systemInstruction += `\n\nCRITICAL POLICY: Your answer is based on internal support signals. DO NOT cite sources. DO NOT reveal internal language or customer names. Keep the tone helpful but cautious.`;
  } else if (decision.answerMode === 'topic_supported') {
    systemInstruction += `\n\nPOLICY: This information is based on recurring patterns. Avoid presenting it as absolute official policy if it sounds like a guarantee.`;
  }

  if (effectiveBot.conversationGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${effectiveBot.conversationGoal}`;
  }

  const result = await agentResponse({
    query: message,
    botName: webAgentName,
    context: decision.chosenCandidates.map(c => ({ title: c.title || 'Source', text: c.text, url: c.url })),
    greetingScript: systemInstruction,
  });

  return {
    answer: (result?.answer || '').trim() || (decision.answerMode === 'escalate' ? `I'm not sure, let me connect you to a human.` : ''),
    usedAgentName: webAgentName,
    sources: decision.chosenCandidates
      .filter(c => c.sourceType === 'article')
      .slice(0, 3)
      .map((c) => ({
        articleId: c.id,
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
    retrieveContext: async (params) => {
      // PLUMBING: Pass resolved bot type to set customer-facing flag
      return orchestrateRetrieval({
        ...params,
        policy: {
          ...params.policy,
          isCustomerFacing: effectiveBot.type === 'widget'
        }
      });
    },
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
    persistAssistantMessage: async ({ conversationId, text, responderType, meta, sources }) => {
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
        attachments: [],
        sources: sources || null,
        ...((meta as any) || {})
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

  // PLUMBING: Map BotConfig fields correctly from effectiveBot
  const botConfig: BotConfig = {
    id: effectiveBot.id,
    type: effectiveBot.type || 'widget', 
    hubId: effectiveBot.hubId,
    name: effectiveBot.name,
    webAgentName: effectiveBot.webAgentName || effectiveBot.name,
    allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds || [],
    intelligenceAccessLevel: effectiveBot.intelligenceAccessLevel || 'topics_only',
    aiEnabled: effectiveBot.aiEnabled !== false,
    handoffKeywords:
      effectiveBot.channelConfig?.web?.handoffKeywords ||
      effectiveBot.automations?.handoffKeywords ||
      ['human', 'agent', 'person', 'representative', 'support'],
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

/**
 * Triggered whenever an article is updated or created to ensure the 
 * search index (brain_chunks) is accurate.
 */
export async function reindexArticleAction(articleId: string) {
  const articleSnap = await adminDB.collection("help_center_articles").doc(articleId).get();
  if (!articleSnap.exists) return;
  const article = { id: articleSnap.id, ...articleSnap.data() };
  
  const hubDoc = await adminDB.collection("hubs").doc(article.hubId as string).get();
  const spaceId = hubDoc.data()?.spaceId;
  if (!spaceId) return;

  // 1. Cleanup existing chunks for this article to prevent duplicates
  const chunksRef = adminDB.collection('brain_chunks');
  const existingChunks = await chunksRef.where('sourceId', '==', articleId).get();
  const batch = adminDB.batch();
  existingChunks.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  // 2. Run indexer to create new chunks + embeddings
  await indexHelpCenterArticleToChunks({
    adminDB,
    article,
    spaceId,
    publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "",
  });
}
