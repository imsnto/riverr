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
import { generateQueryEmbedding } from '@/lib/brain/embed';
import { crawlWebsiteKnowledge } from '@/ai/flows/crawl-website-knowledge';
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
 * Searches the Help Center documentation using Firestore Vector Search.
 */
async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  const { hubId, allowedHelpCenterIds, userId, query, topK = 8 } = params;

  if (!hubId || !query?.trim()) return { chunks: [] };

  const queryVector = await generateQueryEmbedding(query);
  if (!queryVector) return { chunks: [] };

  try {
    const coll = adminDB.collection('brain_chunks');
    
    const vectorQuery = (coll as any)
      .where('hubId', '==', hubId)
      .where('sourceType', 'in', ['help_center_article', 'website', 'pdf', 'manual_note'])
      .where('status', '==', 'active')
      .findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(queryVector),
        limit: Math.min(topK * 3, 30),
        distanceMeasure: 'DOT_PRODUCT',
      });

    const snap = await vectorQuery.get();

    const chunks = snap.docs
      .map((doc: any) => {
        const data = doc.data();
        return {
          chunkText: data.text,
          score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.7,
          articleId: data.sourceId,
          title: data.title,
          url: data.url || '',
          helpCenterIds: data.helpCenterId ? [data.helpCenterId] : [],
          updatedAt: data.updatedAt,
          articleType: data.sourceType === 'help_center_article' ? 'article' : 'snippet',
          articleContent: null,
          visibility: data.visibility || 'public',
          allowedUserIds: data.allowedUserIds || [],
        };
      })
      .filter((c: any) => {
        const hcOk = !allowedHelpCenterIds?.length || 
                     c.helpCenterIds.length === 0 || 
                     c.helpCenterIds.some((id: string) => allowedHelpCenterIds.includes(id));

        const visibilityOk = c.visibility === 'public' || 
                             c.visibility === 'internal' || 
                             (c.visibility === 'private' && userId && c.allowedUserIds.includes(userId));

        return hcOk && visibilityOk;
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK);

    return { chunks: chunks as HelpChunk[] };
  } catch (error) {
    console.error('Firestore vector search failed in searchHelpCenter:', error);
    return { chunks: [] };
  }
}

/**
 * Searches the Distilled Support Brain using Firestore Vector Search.
 */
async function searchSupport(params: SearchSupportParams): Promise<SearchSupportResult> {
  const { hubId, query, topK = 5 } = params;
  if (!hubId || !query?.trim()) return { intents: [] };

  const queryVector = await generateQueryEmbedding(query);
  if (!queryVector) return { intents: [] };

  try {
    const coll = adminDB.collection('brain_distilled_qas');
    
    const vectorQuery = (coll as any)
      .where('hubId', '==', hubId)
      .where('status', '==', 'approved')
      .findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(queryVector),
        limit: topK,
        distanceMeasure: 'DOT_PRODUCT',
      });

    const snap = await vectorQuery.get();

    const intents: any[] = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        intentKey: data.intentKey || doc.id,
        title: data.question,
        description: data.answer,
        _searchScore: typeof doc.distance === 'number' ? 1 - doc.distance : 0.8,
      };
    });

    return { intents };
  } catch (error) {
    console.error('Firestore vector search failed in searchSupport:', error);
    return { intents: [] };
  }
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
  const conversationGoal = effectiveBot.conversationGoal || effectiveBot.primaryGoal || 'Provide information and let customer decide';

  let systemInstruction = `You are ${botName}, a helpful AI assistant. Be conversational, warm, accurate, and concise.`;

  if (conversationGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${conversationGoal}`;
  }

  if (effectiveBot.businessContext?.businessName) {
    systemInstruction += `\n\nBUSINESS NAME:\n${effectiveBot.businessContext.businessName}`;
  }

  if (effectiveBot.businessContext?.whatYouDo) {
    systemInstruction += `\n\nWHAT THE BUSINESS DOES:\n${effectiveBot.businessContext.whatYouDo}`;
  }

  if (effectiveBot.businessContext?.targetAudience) {
    systemInstruction += `\n\nTARGET AUDIENCE:\n${effectiveBot.businessContext.targetAudience}`;
  }

  if (effectiveBot.businessContext?.hours) {
    systemInstruction += `\n\nHOURS:\n${effectiveBot.businessContext.hours}`;
  }

  if (effectiveBot.businessContext?.forbiddenTopics) {
    systemInstruction += `\n\nFORBIDDEN TOPICS:\n${effectiveBot.businessContext.forbiddenTopics}`;
  }

  // 1. Check Distilled Intents
  const supportSearch = await searchSupport({
    hubId: effectiveBot.hubId,
    userId: null,
    query: message,
    topK: 3,
  });

  const topIntent = supportSearch.intents?.[0];
  if (topIntent && topIntent._searchScore && topIntent._searchScore > 0.75) {
    return {
      answer: topIntent.description || 'I found a matching support answer.',
      usedAgentName: botName,
      sources: [],
    };
  }

  // 2. Search Documentation
  const docSearch = await searchHelpCenter({
    hubId: effectiveBot.hubId,
    allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds || [],
    userId: null,
    query: message,
    topK: 5,
  });

  const chunks = docSearch.chunks ?? [];
  const context = chunks.map((c) => ({
    title: c.title,
    text: c.chunkText,
    url: c.url,
  }));

  const result = await agentResponse({
    query: message,
    botName,
    context,
    greetingScript: systemInstruction,
  });

  return {
    answer: (result?.answer || '').trim() || `I'm not sure yet, but I need a little more detail to help with that.`,
    usedAgentName: botName,
    sources: chunks.slice(0, 3).map((c) => ({
      articleId: c.articleId,
      title: c.title,
      url: c.url,
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
        enabled: false,
        required: false,
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
  convoStatus?: string;
}) {
  const now = new Date().toISOString();
  const hubSnap = await adminDB.collection('hubs').doc(data.hubId).get();
  const spaceId = hubSnap.data()?.spaceId;

  const convoRef = await adminDB.collection('conversations').add({
    hubId: data.hubId,
    spaceId,
    visitorId: data.visitorId,
    assigneeId: data.assigneeId,
    status: data.convoStatus || 'ai_active',
    state: 'ai_active',
    channel: 'webchat', 
    lastMessage: data.lastMessage,
    lastMessageAt: now,
    lastMessageAuthor: data.lastMessageAuthor,
    createdAt: now,
    updatedAt: now,
    ownerType: 'hub',
    sharedWithTeam: true,
    aiAttempted: false,
    aiResolved: false,
  });

  return { id: convoRef.id, ...data, spaceId };
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
  const articleSnap = await adminDB.collection('help_center_articles').doc(articleId).get();
  if (!articleSnap.exists) return;
  const article = { id: articleSnap.id, ...articleSnap.data() };
  
  const hubSnap = await adminDB.collection('hubs').doc(article.hubId).get();
  const spaceId = hubSnap.data()?.spaceId;
  if (!spaceId) return;

  // 1. Delete existing chunks for this article to avoid duplicates
  const chunksRef = adminDB.collection('brain_chunks');
  const existingChunks = await chunksRef.where('sourceId', '==', articleId).get();
  const batch = adminDB.batch();
  existingChunks.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // 2. Index to Firestore Vector Search using actual grounding logic
  await indexHelpCenterArticleToChunks({
    adminDB,
    article,
    spaceId,
    publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || ''
  });
}

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}

export async function searchSupportAction(params: SearchSupportParams): Promise<SearchSupportResult> {
  return searchSupport(params);
}

export async function exportLibraryAction(helpCenterId: string) {
  const hcDoc = await adminDB.collection('help_centers').doc(helpCenterId).get();
  if (!hcDoc.exists) throw new Error("Library not found");

  const collectionsSnap = await adminDB.collection('help_center_collections')
    .where('helpCenterId', '==', helpCenterId)
    .get();
  
  const articlesSnap = await adminDB.collection('help_center_articles')
    .where('helpCenterId', '==', helpCenterId)
    .get();

  return {
    helpCenter: { id: hcDoc.id, ...hcDoc.data() },
    collections: collectionsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    articles: articlesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

export async function importLibraryAction(hubId: string, spaceId: string, userId: string, data: any) {
  const { helpCenter, collections, articles } = data;

  const newHcRef = adminDB.collection('help_centers').doc();
  const newHcId = newHcRef.id;

  const { id: _, ...hcData } = helpCenter;
  await newHcRef.set({
    ...hcData,
    hubId,
    spaceId,
  });

  const collectionIdMap: Record<string, string> = {};
  for (const coll of collections) {
    const newCollRef = adminDB.collection('help_center_collections').doc();
    collectionIdMap[coll.id] = newCollRef.id;
  }

  for (const coll of collections) {
    const { id: _, ...collData } = coll;
    const newId = collectionIdMap[coll.id];
    await adminDB.collection('help_center_collections').doc(newId).set({
      ...collData,
      hubId,
      helpCenterId: newHcId,
      parentId: collData.parentId ? (collectionIdMap[collData.parentId] || null) : null,
      updatedAt: new Date().toISOString(),
    });
  }

  for (const art of articles) {
    const { id: _, ...artData } = art;
    await adminDB.collection('help_center_articles').add({
      ...artData,
      hubId,
      spaceId,
      helpCenterId: newHcId,
      folderId: artData.folderId ? (collectionIdMap[artData.folderId] || null) : null,
      authorId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, newHelpCenterId: newHcId };
}

export async function crawlWebsiteAction(url: string) {
  return crawlWebsiteKnowledge({ url });
}
