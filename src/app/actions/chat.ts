'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk, SearchSupportParams, SearchSupportResult, SupportIntentNode } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";
import { getTypesenseAdmin, getTypesenseSearch } from '@/lib/typesense';
import { indexHelpCenterArticleToChunks } from '@/lib/knowledge/indexer';
import { LeadStateNode, Contact, SalesPersonaSegmentNode, ChatMessage } from '@/lib/data';
import { draftSalesEmail, type DraftSalesEmailInput, type DraftSalesEmailOutput } from '@/ai/flows/draft-sales-email';

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
        'query_by': 'text,title,tags,headingPath',
        'query_by_weights': '4,2,2,1',
        'per_page': topK,
        'sort_by': '_text_match:desc,sourceUpdatedAt:desc'
    };
    
    // Filter by type: 'doc' to only search knowledge base articles for now
    const baseFilter = `type:='doc' && hubId:=${hubId} && helpCenterIds:=[${allowedHelpCenterIds.join(',')}] && status:='published'`;

    // Build search for public chunks
    const publicFilter = `${baseFilter} && isPublic:=true`;
    const publicSearchRequest = { ...searchParameters, filter_by: publicFilter };
    
    // Build search for private chunks if user is logged in
    let privateSearchRequest = null;
    if (userId) {
        const privateFilter = `${baseFilter} && isPublic:=false && allowedUserIds:=[${userId}]`;
        privateSearchRequest = { ...searchParameters, filter_by: privateFilter };
    }
    
    // Execute searches in parallel
    const [publicResults, privateResults] = await Promise.all([
        typesense.collections('memory_nodes').documents().search(publicSearchRequest),
        privateSearchRequest ? typesense.collections('memory_nodes').documents().search(privateSearchRequest) : Promise.resolve(null)
    ]);
    
    // Merge and de-duplicate results
    const hits = [...(publicResults.hits || []), ...(privateResults?.hits || [])];
    const uniqueHits = Array.from(new Map(hits.map(item => [item.document.id, item])).values());
    
    // Map to the HelpChunk type expected by the agent
    const chunks: HelpChunk[] = uniqueHits.map(hit => {
        const doc = hit.document as any;
        return {
            chunkText: doc.text,
            score: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
            articleId: doc.sourceId,
            title: doc.title,
            url: doc.url,
            helpCenterIds: doc.helpCenterIds,
            updatedAt: new Date(doc.sourceUpdatedAt).toISOString(),
            articleType: doc.articleType,
            articleContent: doc.content || null,
        };
    }).sort((a, b) => b.score - a.score).slice(0, topK);

    return { chunks };
}

async function searchSupport(params: SearchSupportParams): Promise<SearchSupportResult> {
    const { hubId, userId, query, topK = 5 } = params;

    if (!hubId) return { intents: [] };

    // For now, simple text search. Later, this will be a vector search.
    const searchParameters = {
        'q': query,
        'query_by': 'textForEmbedding,title,description',
        'query_by_weights': '4,2,1',
        'per_page': topK,
        'sort_by': '_text_match:desc'
    };
    
    const filter = `type:='support_intent' && hubId:=${hubId}`;

    const results = await typesense.collections('memory_nodes').documents().search(searchParameters);
    
    const intents: any[] = (results.hits || []).map(hit => {
        return {
            ...(hit.document as SupportIntentNode),
            _searchScore: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
        };
    });

    return { intents };
}

export interface SearchSalesExtractionsParams {
    query: string;
    spaceId: string;
    topK?: number;
}
export interface SalesExtractionResult {
    id: string;
    [key: string]: any;
}
export interface SearchSalesExtractionsResult {
    extractions: SalesExtractionResult[];
}

async function searchSalesExtractions(params: SearchSalesExtractionsParams): Promise<SearchSalesExtractionsResult> {
    const { query, spaceId, topK = 25 } = params;

    const searchParameters = {
        'q': query,
        'query_by': 'recommendedPersonaClusterText,pains,objections,buyingSignals',
        'filter_by': `spaceId:=${spaceId}`,
        'per_page': topK,
        'sort_by': '_text_match:desc',
    };

    const results = await typesense.collections('sales_extractions').documents().search(searchParameters);

    const extractions: SalesExtractionResult[] = (results.hits || []).map(hit => {
        return {
            id: hit.document.id,
            ...(hit.document as any),
            _searchScore: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
        };
    });

    return { extractions };
}

/**
 * SERVER-SIDE DATABASE CALLS
 * Uses firebase-admin (adminDB) to bypass client-side restrictions.
 */

export async function updateConversation(conversationId: string, data: Partial<Conversation>) {
    const convRef = adminDB.collection('conversations').doc(conversationId);
    
    // 1. Direct Server Update
    await convRef.update(data as any);
  
    // 2. Server-side side effects (Sync contactId to tickets)
    if (data.contactId) {
      const ticketsSnapshot = await adminDB.collection("tickets")
        .where("conversationId", "==", conversationId)
        .limit(1)
        .get();
  
      if (!ticketsSnapshot.empty) {
        await ticketsSnapshot.docs[0].ref.update({ contactId: data.contactId });
      }
    }
  }
  
  export async function addChatMessage(message: Omit<ChatMessage, "id">) {
    // 1. Create the message in the server collection
    const messageRef = await adminDB.collection("chat_messages").add(message);
    
    // 2. Process metadata updates (Last message preview, author name, etc.)
    if (message.conversationId && message.type === 'message') {
      let authorName = "System";
  
      // Direct server-to-server fetch for author names
      if (message.senderType === 'agent') {
        const userDoc = await adminDB.collection('users').doc(message.authorId).get();
        if (userDoc.exists) authorName = userDoc.data()?.name;
      } else {
        const visitorDoc = await adminDB.collection('visitors').doc(message.authorId).get();
        if (visitorDoc.exists) authorName = visitorDoc.data()?.name;
      }
  
      const preview = (message.content || "").slice(0, 140);
      const timestamp = new Date().toISOString();
  
      // 3. Batch/Parallel update for Conversation and Tickets
      await Promise.all([
        updateConversation(message.conversationId, {
          lastMessageAt: message.timestamp,
          lastMessage: preview,
          lastMessageAuthor: authorName,
          updatedAt: timestamp as any,
        }),
        adminDB.collection("tickets")
          .where("conversationId", "==", message.conversationId)
          .limit(1)
          .get()
          .then(async (snap) => {
            if (!snap.empty) {
              await snap.docs[0].ref.update({
                lastMessagePreview: preview,
                lastMessageAt: message.timestamp,
                lastMessageAuthor: authorName,
                updatedAt: timestamp,
              });
            }
          })
      ]);
    }
  
    return { ...message, id: messageRef.id };
  }
  
  /**
   * REFACTORED AGENT INVOCATION
   */
  export async function invokeAgent(args: {
      bot: BotConfig;
      conversation: Conversation;
      message: IncomingMessage;
  }) {
      const adapters: AgentAdapters = {
          searchHelpCenter,
          searchSupport,
          searchSalesExtractions,
          escalateToHuman: async ({ conversationId, reason }) => {
              // These calls now trigger the adminDB functions above
              await updateConversation(conversationId, {
                  status: 'human',
                  escalated: true,
                  escalationReason: reason,
                  state: 'human_assigned',
              });
          },
          persistAssistantMessage: async ({ conversationId, text }) => {
              await addChatMessage({
                  conversationId,
                  authorId: 'ai_agent',
                  type: 'message',
                  senderType: 'agent',
                  content: text,
                  timestamp: new Date().toISOString(),
              });
          },
          updateConversation: async ({ conversationId, patch }) => {
              await updateConversation(conversationId, patch);
          },
      };
  
      await handleIncomingMessage({ ...args, adapters });
  }

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}

export async function searchSupportAction(params: SearchSupportParams): Promise<SearchSupportResult> {
  return searchSupport(params);
}

export async function searchSalesExtractionsAction(params: SearchSalesExtractionsParams): Promise<SearchSalesExtractionsResult> {
  return searchSalesExtractions(params);
}

const PUBLIC_HELP_BASE_URL = process.env.PUBLIC_HELP_BASE_URL || "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev";

async function deleteChunksForArticle(articleId: string) {
  const typesenseAdmin = getTypesenseAdmin();
  try {
    await typesenseAdmin.collections('memory_nodes').documents().delete({
      filter_by: `sourceId:=${articleId}`,
    });
  } catch (error: any) {
    if (error.httpStatus !== 404) {
      console.error(`Error deleting chunks for article ${articleId}:`, error);
      throw error;
    }
  }
}

export async function reindexArticleAction(articleId: string) {
    try {
        const articleRef = adminDB.collection("help_center_articles").doc(articleId);
        const docSnap = await articleRef.get();

        // Always delete old chunks first. If the doc doesn't exist, we still want to clean up the index.
        await deleteChunksForArticle(articleId);

        if (!docSnap.exists) {
            console.log(`Article ${articleId} not found, deleted from index.`);
            return { ok: true, message: `Article ${articleId} deleted from index.` };
        }
        
        const article = { id: docSnap.id, ...docSnap.data() };

        // If the article is not 'published', we're done. Deleting it was the goal.
        if (article.status !== 'published') {
            console.log(`Article ${articleId} is a draft, removed from index.`);
            return { ok: true, message: `Article ${articleId} is a draft and was removed from the index.` };
        }

        const hubId = article.hubId;
        if (!hubId) {
            throw new Error(`Article ${articleId} is missing a hubId.`);
        }

        const hubDoc = await adminDB.collection("hubs").doc(hubId).get();
        if (!hubDoc.exists) {
            throw new Error(`Hub ${hubId} not found.`);
        }
        const spaceId = hubDoc.data()?.spaceId;
        if (!spaceId) {
            throw new Error(`Hub ${hubId} is missing a spaceId.`);
        }
        
        // Re-index if published.
        const res = await indexHelpCenterArticleToChunks({
            adminDB,
            article,
            spaceId,
            publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
        });

        console.log(`Successfully re-indexed article ${articleId}. Total chunks: ${res.chunkCount}`);
        return { ok: true, totalChunks: res.chunkCount };

    } catch (error: any) {
        console.error(`Failed to re-index article ${articleId}:`, error);
        // Re-throw to let the client-side know something went wrong.
        throw new Error(error.message || 'Unknown error occurred during re-indexing.');
    }
}


export interface SuggestedLead {
  contact: Contact;
  leadState: LeadStateNode;
  persona?: SalesPersonaSegmentNode | null;
}

export interface GetSuggestedLeadsParams {
    spaceId: string;
    topK?: number;
}

export async function getSuggestedLeadsAction(params: GetSuggestedLeadsParams): Promise<SuggestedLead[]> {
    const { spaceId, topK = 10 } = params;

    // 1. Fetch top lead states
    const leadStatesQuery = adminDB.collection('lead_states')
        .where('spaceId', '==', spaceId)
        .orderBy('warmScore', 'desc')
        .limit(topK);
    const leadStatesSnapshot = await leadStatesQuery.get();
    if (leadStatesSnapshot.empty) {
        return [];
    }
    const leadStates = leadStatesSnapshot.docs.map(doc => doc.data() as LeadStateNode);

    // 2. Batch fetch contacts and personas
    const contactIds = [...new Set(leadStates.map(ls => ls.leadId))];
    const personaKeys = [...new Set(leadStates.map(ls => ls.matchedPersonaSegmentKey).filter(Boolean))] as string[];

    const contactPromises = contactIds.map(id => adminDB.collection('contacts').doc(id).get());
    
    let personaPromises: Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>>[] = [];
    if (personaKeys.length > 0) {
      // Firestore 'in' query is limited to 30 items
      for (let i = 0; i < personaKeys.length; i += 30) {
        const chunk = personaKeys.slice(i, i + 30);
        const personasQuery = adminDB.collection('memory_nodes')
            .where('spaceId', '==', spaceId)
            .where('type', '==', 'sales_persona_segment')
            .where('segmentKey', 'in', chunk);
        personaPromises.push(personasQuery.get());
      }
    }
    
    const [contactDocs, ...personaSnapshots] = await Promise.all([
        Promise.all(contactPromises),
        ...personaPromises
    ]);

    const contactsMap = new Map<string, Contact>();
    contactDocs.forEach(doc => {
        if (doc.exists) {
            contactsMap.set(doc.id, { id: doc.id, ...doc.data() } as Contact);
        }
    });

    const personasMap = new Map<string, SalesPersonaSegmentNode>();
    personaSnapshots.flat().forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const persona = doc.data() as SalesPersonaSegmentNode;
        personasMap.set(persona.segmentKey, persona);
      })
    });

    // 3. Combine data
    const suggestedLeads: SuggestedLead[] = leadStates.map(ls => {
        const contact = contactsMap.get(ls.leadId);
        const persona = ls.matchedPersonaSegmentKey ? personasMap.get(ls.matchedPersonaSegmentKey) : null;
        if (!contact) return null; // Should not happen if data is consistent
        return { contact, leadState: ls, persona };
    }).filter((l): l is SuggestedLead => l !== null);

    return suggestedLeads;
}

export async function draftSalesEmailAction(input: DraftSalesEmailInput): Promise<DraftSalesEmailOutput> {
    return draftSalesEmail(input);
}
