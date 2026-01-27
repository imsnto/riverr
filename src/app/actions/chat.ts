'use server';

import { adminDB } from '@/lib/firebase-admin';
import { HelpCenterArticle } from '@/lib/data';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult } from '@/lib/agent';
import * as db from '@/lib/db';

async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
    // This is the RAG logic from the old Genkit flow
    const { hubId, allowedHelpCenterIds, userId, query } = params;

    if (!hubId || !allowedHelpCenterIds || allowedHelpCenterIds.length === 0) {
        return { chunks: [] };
    }

    try {
        const articlesRef = adminDB.collection('help_center_articles');
        const q = articlesRef
            .where('hubId', '==', hubId)
            .where('status', '==', 'published')
            .where('helpCenterIds', 'array-contains-any', allowedHelpCenterIds);
        
        const snapshot = await q.get();

        if (snapshot.empty) {
            return { chunks: [] };
        }
        
        const accessibleArticles = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle))
            .filter(article => {
                if (!userId) return article.isPublic; // For anonymous users, only public articles
                if (article.isPublic) return true;
                if (article.allowedUserIds?.includes(userId)) return true;
                return false;
            })
            .map(article => ({
                chunkText: article.content, // Using full content as a "chunk" for now
                score: 0.8, // Fake score, since we're not doing real vector search
                articleId: article.id,
                title: article.title,
                url: `/hc/${article.helpCenterIds?.[0]}/articles/${article.id}`,
                helpCenterIds: article.helpCenterIds || [],
                updatedAt: article.updatedAt,
            }));

        // Simplified filtering for now, as in the old flow
        const filtered = accessibleArticles.filter(a =>
            a.title.toLowerCase().includes(query.toLowerCase()) ||
            a.chunkText.toLowerCase().includes(query.toLowerCase())
        );

        return { chunks: filtered };

    } catch (error) {
        console.error("Error searching help center:", error);
        return { chunks: [] };
    }
}

export async function invokeAgent(args: {
    bot: BotConfig;
    conversation: Conversation;
    message: IncomingMessage;
}) {
    const adapters: AgentAdapters = {
        searchHelpCenter,
        escalateToHuman: async ({ conversationId, reason }) => {
            await db.updateConversation(conversationId, {
                status: 'human',
                escalated: true,
                escalationReason: reason,
                state: 'human_assigned',
            });
        },
        persistAssistantMessage: async ({ conversationId, text, sources }) => {
            await db.addChatMessage({
                conversationId,
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: text,
                timestamp: new Date().toISOString(),
            });
        },
        updateConversation: async ({ conversationId, patch }) => {
            await db.updateConversation(conversationId, patch);
        },
    };

    await handleIncomingMessage({ ...args, adapters });
}

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}
