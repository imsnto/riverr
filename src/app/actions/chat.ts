
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk, SearchSupportParams, SearchSupportResult, SupportIntentNode } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";
import { getTypesenseAdmin, getTypesenseSearch } from '@/lib/typesense';
import { indexHelpCenterArticleToChunks } from '@/lib/knowledge/indexer';
import { LeadStateNode, Contact, SalesPersonaSegmentNode, ChatMessage, Visitor, HelpCenter, HelpCenterCollection, HelpCenterArticle } from '@/lib/data';
import { draftSalesEmail, type DraftSalesEmailInput, type DraftSalesEmailOutput } from '@/ai/flows/draft-sales-email';
import { serverTimestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { isWhimsical, generateWhimsicalName } from '@/lib/utils';

const typesense = getTypesenseSearch();

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
    
    const baseFilter = `type:='doc' && hubId:=${hubId} && helpCenterId:=[${allowedHelpCenterIds.join(',')}] && status:='published'`;

    const publicFilter = `${baseFilter} && isPublic:=true`;
    const publicSearchRequest = { ...searchParameters, filter_by: publicFilter };
    
    let privateSearchRequest = null;
    if (userId) {
        const privateFilter = `${baseFilter} && isPublic:=false && allowedUserIds:=[${userId}]`;
        privateSearchRequest = { ...searchParameters, filter_by: privateFilter };
    }
    
    try {
        const [publicResults, privateResults] = await Promise.all([
            typesense.collections('memory_nodes').documents().search(publicSearchRequest),
            privateSearchRequest ? typesense.collections('memory_nodes').documents().search(privateSearchRequest) : Promise.resolve(null)
        ]);
        
        const hits = [...(publicResults.hits || []), ...(privateResults?.hits || [])];
        const uniqueHits = Array.from(new Map(hits.map(item => [item.document.id, item])).values());
        
        const chunks: HelpChunk[] = uniqueHits.map(hit => {
            const doc = hit.document as any;
            return {
                chunkText: doc.text,
                score: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
                articleId: doc.sourceId,
                title: doc.title,
                url: doc.url,
                helpCenterId: doc.helpCenterId,
                updatedAt: new Date(doc.sourceUpdatedAt).toISOString(),
                articleType: doc.articleType,
                articleContent: doc.content || null,
            };
        }).sort((a, b) => b.score - a.score).slice(0, topK);

        return { chunks };
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.warn("Typesense search failed: 'memory_nodes' collection not found. Returning empty results.");
            return { chunks: [] };
        }
        console.error("Typesense search failed in searchHelpCenter:", error);
        throw error;
    }
}

async function searchSupport(params: SearchSupportParams): Promise<SearchSupportResult> {
    const { hubId, userId, query, topK = 5 } = params;

    if (!hubId) return { intents: [] };

    const searchParameters = {
        'q': query,
        'query_by': 'textForEmbedding,title,description',
        'query_by_weights': '4,2,1',
        'per_page': topK,
        'sort_by': '_text_match:desc',
        'filter_by': `type:='support_intent' && hubId:=${hubId}`
    };

    try {
        const results = await typesense.collections('memory_nodes').documents().search(searchParameters);
        
        const intents: any[] = (results.hits || []).map(hit => {
            return {
                ...(hit.document as SupportIntentNode),
                _searchScore: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
            };
        });

        return { intents };
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.warn("Typesense search failed: 'memory_nodes' collection not found. Returning empty results.");
            return { intents: [] };
        }
        console.error("Typesense search failed in searchSupport:", error);
        throw error;
    }
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
    
    try {
        const results = await typesense.collections('sales_extractions').documents().search(searchParameters);

        const extractions: SalesExtractionResult[] = (results.hits || []).map(hit => {
            return {
                id: hit.document.id,
                ...(hit.document as any),
                _searchScore: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
            };
        });

        return { extractions };
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.warn("Typesense search failed: 'sales_extractions' collection not found. Returning empty results.");
            return { extractions: [] };
        }
        console.error("Typesense search failed in searchSalesExtractions:", error);
        throw error;
    }
}

export async function updateConversation(conversationId: string, data: Partial<Conversation>) {
    const convRef = adminDB.collection('conversations').doc(conversationId);
    
    const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    await convRef.update(cleanData as any);
  
    if (cleanData.contactId) {
      const ticketsSnapshot = await adminDB.collection("tickets")
        .where("conversationId", "==", conversationId)
        .limit(5)
        .get();
  
      if (!ticketsSnapshot.empty) {
        const batch = adminDB.batch();
        ticketsSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { contactId: cleanData.contactId });
        });
        await batch.commit();
      }
    }
  }

async function ensureCrmLinkedForConversationAdmin(conversationId: string) {
  const convoRef = adminDB.collection("conversations").doc(conversationId);
  const convoSnap = await convoRef.get();
  if (!convoSnap.exists) return null;

  const convo = convoSnap.data() as any;
  if (!convo.visitorId) return null;

  const hubSnap = await adminDB.collection("hubs").doc(convo.hubId).get();
  if (!hubSnap.exists) return null;
  const spaceId = hubSnap.data()?.spaceId;
  if (!spaceId) return null;

  const visitorRef = adminDB.collection("visitors").doc(convo.visitorId);
  const visitorSnap = await visitorRef.get();
  if (!visitorSnap.exists) return null;
  const visitor = { id: visitorSnap.id, ...(visitorSnap.data() as any) };

  let vName = visitor.name;
  if (!vName || vName.trim() === "" || vName.trim() === "Unknown") {
      vName = generateWhimsicalName();
      await visitorRef.update({ name: vName });
      visitor.name = vName;
  }
  
  const vEmail = visitor.email;
  const vPhone = visitor.phone;

  let contactId: string | null = convo.contactId || visitor.contactId || null;

  if (!contactId && vEmail) {
    const byEmail = await adminDB.collection("contacts")
      .where("spaceId", "==", spaceId)
      .where("primaryEmail", "==", vEmail.toLowerCase())
      .limit(1)
      .get();
    if (!byEmail.empty) contactId = byEmail.docs[0].id;
  }

  if (!contactId && vPhone) {
    const byPhone = await adminDB.collection("contacts")
      .where("spaceId", "==", spaceId)
      .where("primaryPhone", "==", vPhone)
      .limit(1)
      .get();
    if (!byPhone.empty) contactId = byPhone.docs[0].id;
  }

  if (!contactId) {
    const byVisitor = await adminDB.collection("contacts")
      .where("spaceId", "==", spaceId)
      .where("externalIds.chatVisitorId", "==", visitor.id)
      .limit(1)
      .get();
    if (!byVisitor.empty) contactId = byVisitor.docs[0].id;
  }

  if (!contactId) {
    const now = new Date();
    const newContactRef = await adminDB.collection("contacts").add({
      spaceId,
      name: vName,
      company: visitor.companyName || null,
      emails: vEmail ? [vEmail.toLowerCase()] : [],
      phones: vPhone ? [vPhone] : [],
      primaryEmail: vEmail ? vEmail.toLowerCase() : null,
      primaryPhone: vPhone || null,
      source: "chat",
      externalIds: { chatVisitorId: visitor.id },
      tags: [],
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      lastMessageAt: null,
      lastOrderAt: null,
      lastCallAt: null,
      mergeParentId: null,
      isMerged: false,
    });
    contactId = newContactRef.id;

    // Log the creation event
    await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: 'identity_added',
        summary: 'Contact created automatically from chat.',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { source: 'chat', hubId: convo.hubId, spaceId: spaceId }
    });
  } else {
      const contactRef = adminDB.collection("contacts").doc(contactId);
      const contactSnap = await contactRef.get();
      if (contactSnap.exists) {
          const contactData = contactSnap.data() as any;
          const updates: any = {};
          
          if (vName && (!contactData.name || isWhimsical(contactData.name) || contactData.name === "Unknown") && !isWhimsical(vName)) {
              updates.name = vName;
          }
          
          if (vEmail && !contactData.primaryEmail) {
              updates.primaryEmail = vEmail.toLowerCase();
              updates.emails = admin.firestore.FieldValue.arrayUnion(vEmail.toLowerCase());
          }

          if (vPhone && !contactData.primaryPhone) {
              updates.primaryPhone = vPhone;
              updates.phones = admin.firestore.FieldValue.arrayUnion(vPhone);
          }
          
          if (Object.keys(updates).length > 0) {
              await contactRef.update({ ...updates, updatedAt: new Date() });
          }
      }
  }

  // Ensure "Chat Started" event exists for this contact + conversation
  const eventQuery = await adminDB.collection("contacts").doc(contactId).collection("events")
    .where("type", "==", "chat_started")
    .where("ref.conversationId", "==", conversationId)
    .limit(1)
    .get();

  if (eventQuery.empty) {
    await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: 'chat_started',
        summary: `Started a chat conversation as ${vName}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { conversationId, visitorId: visitor.id, hubId: convo.hubId, spaceId: spaceId }
    });
  }

  const convoUpdates: any = {
    contactId,
    visitorName: vName,
    visitorEmail: vEmail,
    visitorPhone: vPhone,
    updatedAt: new Date().toISOString(),
  };

  if (!convo.lastMessageAuthor || 
      convo.lastMessageAuthor === "Visitor" || 
      convo.lastMessageAuthor === "Unknown" ||
      isWhimsical(convo.lastMessageAuthor)) {
      convoUpdates.lastMessageAuthor = vName;
  }

  await Promise.all([
    visitorRef.update({ contactId }),
    convoRef.update(convoUpdates),
  ]);

  return contactId;
}
  
  export async function addChatMessage(message: Omit<ChatMessage, "id">) {
    const messageRef = await adminDB.collection("chat_messages").add(message);
    
    if (message.conversationId && message.type === 'message') {
      let authorName = "Visitor";
  
      if (message.authorId === 'ai_agent') {
          authorName = 'AI Agent';
      } else if (message.senderType === 'agent') {
        const userDoc = await adminDB.collection('users').doc(message.authorId).get();
        if (userDoc.exists) authorName = userDoc.data()?.name || 'Agent';
      } else { 
        // Sync CRM and set author name
        const linkedContactId = await ensureCrmLinkedForConversationAdmin(message.conversationId);
        if (linkedContactId) {
            const contactDoc = await adminDB.collection('contacts').doc(linkedContactId).get();
            authorName = contactDoc.data()?.name || 'Visitor';
        }
      }
  
      const preview = (message.content || "").slice(0, 140) || (message.attachments?.length ? "Sent an attachment" : "");
      const timestamp = new Date().toISOString();
  
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
          onChatMessage: async (message) => {
              await addChatMessage(message);
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
    if (error.httpStatus === 404) {
      console.log(`No chunks found to delete for article ${articleId} (or collection doesn't exist).`);
    } else {
      console.error(`Error deleting chunks for article ${articleId}:`, error);
      throw error;
    }
  }
}

export async function reindexArticleAction(articleId: string) {
    try {
        const articleRef = adminDB.collection("help_center_articles").doc(articleId);
        const docSnap = await articleRef.get();

        await deleteChunksForArticle(articleId);

        if (!docSnap.exists) {
            console.log(`Article ${articleId} not found, deleted from index.`);
            return { ok: true, message: `Article ${articleId} deleted from index.` };
        }
        
        const article = { id: docSnap.id, ...docSnap.data() };

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
        throw new Error(error.message || 'Unknown error occurred during re-indexing.');
    }
}

export async function ensureConversationCrmLinkedAction(conversationId: string) {
    return ensureCrmLinkedForConversationAdmin(conversationId);
}

export async function createConversationAndLinkCrm(args: {
  hubId: string;
  visitorId: string;
  assigneeId: string | null;
  lastMessage: string;
  lastMessageAuthor: string | null;
}) {
  const convoRef = await adminDB.collection("conversations").add({
    hubId: args.hubId,
    contactId: null,
    visitorId: args.visitorId,
    assigneeId: args.assigneeId,
    assignedAgentIds: args.assigneeId ? [args.assigneeId] : [], // Populate for notifications
    status: "bot",
    state: "ai_active",
    lastMessage: args.lastMessage,
    lastMessageAt: new Date().toISOString(),
    lastMessageAuthor: args.lastMessageAuthor,
    updatedAt: new Date().toISOString(),
  });

  await ensureCrmLinkedForConversationAdmin(convoRef.id);

  const snap = await convoRef.get();
  return { id: convoRef.id, ...(snap.data() as any) };
}

export async function exportLibraryAction(helpCenterId: string) {
  const hcDoc = await adminDB.collection("help_centers").doc(helpCenterId).get();
  if (!hcDoc.exists) throw new Error("Library not found");

  const collectionsSnap = await adminDB
    .collection("help_center_collections")
    .where("helpCenterId", "==", helpCenterId)
    .get();

  const articlesSnap = await adminDB
    .collection("help_center_articles")
    .where("helpCenterId", "==", helpCenterId)
    .get();

  return {
    helpCenter: { id: hcDoc.id, ...hcDoc.data() },
    collections: collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    articles: articlesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export async function importLibraryAction(
  hubId: string,
  spaceId: string,
  userId: string,
  data: any
) {
  const batch = adminDB.batch();
  const idMap: Record<string, string> = {};

  const newHcRef = adminDB.collection("help_centers").doc();
  const oldHcId = data.helpCenter.id;
  idMap[oldHcId] = newHcRef.id;

  const { id: _, ...hcData } = data.helpCenter;
  batch.set(newHcRef, {
    ...hcData,
    hubId,
  });

  for (const coll of data.collections) {
    const newRef = adminDB.collection("help_center_collections").doc();
    idMap[coll.id] = newRef.id;
  }

  for (const coll of data.collections) {
    const newId = idMap[coll.id];
    const { id: _, ...collData } = coll;
    batch.set(adminDB.collection("help_center_collections").doc(newId), {
      ...collData,
      hubId,
      helpCenterId: newHcRef.id,
      parentId: coll.parentId ? idMap[coll.parentId] || null : null,
    });
  }

  for (const art of data.articles) {
    const newRef = adminDB.collection("help_center_articles").doc();
    const { id: _, ...artData } = art;
    batch.set(newRef, {
      ...artData,
      hubId,
      spaceId,
      authorId: userId,
      helpCenterId: newHcRef.id,
      folderId: art.folderId ? idMap[art.folderId] || null : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  return { ok: true };
}
