
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";
import { getTypesenseSearch } from '@/lib/typesense';

const typesense = getTypesenseSearch();

function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
    const { hubId, allowedHelpCenterIds, userId, query, topK = 10 } = params;

    if (!hubId || !allowedHelpCenterIds?.length) return { chunks: [] };

    const searchParameters = {
        'q': query,
        'query_by': 'text,articleTitle,headingPath',
        'query_by_weights': '4,2,1',
        'per_page': topK,
        'sort_by': '_text_match:desc,chunkUpdatedAt:desc'
    };
    
    const hubFilter = `hubId:=${hubId} && helpCenterIds:=[${allowedHelpCenterIds.join(',')}] && status:='published'`;

    // Build search for public chunks
    const publicFilter = `${hubFilter} && isPublic:=true`;
    const publicSearchRequest = { ...searchParameters, filter_by: publicFilter };
    
    // Build search for private chunks if user is logged in
    let privateSearchRequest = null;
    if (userId) {
        const privateFilter = `${hubFilter} && isPublic:=false && allowedUserIds:=[${userId}]`;
        privateSearchRequest = { ...searchParameters, filter_by: privateFilter };
    }
    
    // Execute searches in parallel
    const [publicResults, privateResults] = await Promise.all([
        typesense.collections('bii_help_chunks').documents().search(publicSearchRequest),
        privateSearchRequest ? typesense.collections('bii_help_chunks').documents().search(privateSearchRequest) : Promise.resolve(null)
    ]);
    
    // Merge and de-duplicate results
    const hits = [...(publicResults.hits || []), ...(privateResults?.hits || [])];
    const uniqueHits = Array.from(new Map(hits.map(item => [item.document.id, item])).values());
    
    // Map to the HelpChunk type expected by the agent
    const chunks: HelpChunk[] = uniqueHits.map(hit => {
        const doc = hit.document as any; // Cast from typesense doc
        return {
            chunkText: doc.text,
            // Normalize score: Typesense text_match score is an integer. A simple division can scale it.
            // This might need tuning depending on observed score ranges.
            score: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
            articleId: doc.articleId,
            title: doc.articleTitle,
            url: doc.url,
            helpCenterIds: doc.helpCenterIds,
            updatedAt: new Date(doc.updatedAt).toISOString()
        };
    }).sort((a, b) => b.score - a.score).slice(0, topK);

    return { chunks };
}


export async function invokeAgent(args: {
    bot: BotConfig;
    conversation: Conversation;
    message: IncomingMessage;
}) {
    const adapters: AgentAdapters = {
        searchHelpCenter,
        escalateToHuman: async ({ conversationId, hubId, reason }) => {
            await db.updateConversation(conversationId, {
                status: 'human',
                escalated: true,
                escalationReason: reason,
                state: 'human_assigned',
            });
        },
        persistAssistantMessage: async ({ conversationId, hubId, text, sources, meta }) => {
            await db.addChatMessage({
                conversationId,
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: text,
                timestamp: new Date().toISOString(),
            });
        },
        updateConversation: async ({ conversationId, hubId, patch }) => {
            await db.updateConversation(conversationId, patch);
        },
    };

    await handleIncomingMessage({ ...args, adapters });
}

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}
