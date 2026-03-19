'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk, SearchSupportParams, SearchSupportResult, SupportIntentNode } from '@/lib/agent';
import * as db from '@/lib/db';
import { resolveRuntimeBot } from '@/lib/bot-runtime';
import { getTypesenseSearch } from '@/lib/typesense';
import { indexHelpCenterArticleToChunks } from '@/lib/knowledge/indexer';
import { ChatMessage, Visitor, HelpCenter, Contact } from '@/lib/data';
import { agentResponse } from '@/ai/flows/agent-response';
import { crawlWebsiteKnowledge } from '@/ai/flows/crawl-website-knowledge';
import admin from 'firebase-admin';
import { normalizePhoneFallback } from '@/lib/utils';
import { getMessagingProvider } from '@/lib/comms/providerFactory';
import { generateEmbedding } from '@/lib/brain/embed';

const typesense = getTypesenseSearch();

export type SearchSalesExtractionsResult = { extractions: any[] };

/**
 * Searches the Help Center documentation using Typesense.
 */
async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  const { hubId, allowedHelpCenterIds, userId, query, topK = 10 } = params;

  if (!hubId || !allowedHelpCenterIds?.length) return { chunks: [] };

  const safeIds = allowedHelpCenterIds
    .filter(Boolean)
    .map((id) => String(id).replace(/'/g, "\\'"));

  if (!safeIds.length) return { chunks: [] };

  const searchParameters = {
    q: query,
    query_by: 'text,title,tags,headingPath',
    query_by_weights: '4,2,2,1',
    per_page: topK,
    sort_by: '_text_match:desc,sourceUpdatedAt:desc',
  };

  const hcFilter = safeIds.map(id => `'${id}'`).join(',');
  const baseFilter = `type:='doc' && hubId:='${hubId}' && helpCenterId:=[${hcFilter}] && status:='published'`;

  const publicFilter = `${baseFilter} && isPublic:=true`;
  const publicSearchRequest = { ...searchParameters, filter_by: publicFilter };

  let privateSearchRequest = null;
  if (userId) {
    const privateFilter = `${baseFilter} && isPublic:=false && allowedUserIds:=['${String(userId).replace(/'/g, "\\'")}']`;
    privateSearchRequest = { ...searchParameters, filter_by: privateFilter };
  }

  try {
    const [publicResults, privateResults] = await Promise.all([
      typesense.collections('memory_nodes').documents().search(publicSearchRequest),
      privateSearchRequest
        ? typesense.collections('memory_nodes').documents().search(privateSearchRequest)
        : Promise.resolve(null),
    ]);

    const hits = [...(publicResults.hits || []), ...(privateResults?.hits || [])];
    const uniqueHits = Array.from(new Map(hits.map((item: any) => [item.document.id, item])).values());

    const chunks: HelpChunk[] = uniqueHits
      .map((hit: any) => {
        const doc = hit.document as any;
        return {
          chunkText: doc.text,
          score: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
          articleId: doc.sourceId,
          title: doc.title,
          url: doc.url,
          helpCenterIds: doc.helpCenterIds || [doc.helpCenterId],
          updatedAt: new Date(doc.sourceUpdatedAt).toISOString(),
          articleType: doc.articleType,
          articleContent: doc.content || null,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return { chunks };
  } catch (error: any) {
    if (error.httpStatus === 404) {
      console.warn("Typesense search failed: 'memory_nodes' collection not found.");
      return { chunks: [] };
    }
    console.error('Typesense search failed:', error);
    throw error;
  }
}

/**
 * Searches the Distilled Support Brain using Firestore Vector Search.
 */
async function searchSupport(params: SearchSupportParams): Promise<SearchSupportResult> {
  const { hubId, query, topK = 5 } = params;
  if (!hubId || !query) return { intents: [] };

  // 1. Generate embedding for the user's question
  const queryVector = await generateEmbedding(query);
  if (!queryVector) return { intents: [] };

  try {
    const coll = adminDB.collection('brain_distilled_qas');
    
    // 2. Perform Firestore Nearest-Neighbor search
    // Using DOT_PRODUCT as Vertex vectors are normalized
    const vectorQuery = coll
      .where('hubId', '==', hubId)
      .where('status', '==', 'approved')
      .findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(queryVector),
        limit: topK,
        distanceMeasure: 'DOT_PRODUCT',
      });

    const snap = await vectorQuery.get();

    const intents: any[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.question,
        description: data.answer,
        intentKey: data.intentKey,
        requiredContext: data.requiredContext || [],
        safeAnswerPolicy: { 
          mustNot: data.mustNot || [], 
          requiresHumanIf: data.requiresHumanIf || [] 
        },
        _searchScore: (doc as any).distance ? 1 - (doc as any).distance : 0.8,
      };
    });

    return { intents };
  } catch (error) {
    console.error('Firestore vector search failed in searchSupport:', error);
    return { intents: [] };
  }
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
      await db.updateConversation(conversationId, {
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
        await db.addChatMessage(messageData);
      }
    },
    updateConversation: async ({ conversationId, patch }) => {
      await db.updateConversation(conversationId, patch);
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
      effectiveBot.automations?.handoffKeywords ||
      effectiveBot.channelConfig?.sms?.escalation?.keywords ||
      [],
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

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}

export async function searchSupportAction(params: SearchSupportParams): Promise<SearchSupportResult> {
  return searchSupport(params);
}

export async function crawlWebsiteAction(url: string) {
  return crawlWebsiteKnowledge({ url });
}
