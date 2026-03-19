'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk, SearchSupportParams, SearchSupportResult, SupportIntentNode } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";
import { getTypesenseAdmin, getTypesenseSearch } from '@/lib/typesense';
import { indexHelpCenterArticleToChunks } from '@/lib/knowledge/indexer';
import { LeadStateNode, Contact, SalesPersonaSegmentNode, ChatMessage, Visitor, HelpCenter, HelpCenterCollection, HelpCenterArticle, ResponderType } from '@/lib/data';
import { draftSalesEmail, type DraftSalesEmailInput, type DraftSalesEmailOutput } from '@/ai/flows/draft-sales-email';
import { agentResponse } from '@/ai/flows/agent-response';
import { crawlWebsiteKnowledge } from '@/ai/flows/crawl-website-knowledge';
import { serverTimestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { isWhimsical, generateWhimsicalName, normalizePhoneFallback } from '@/lib/utils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { getMessagingProvider } from '@/lib/comms/providerFactory';

const typesense = getTypesenseSearch();

export type SearchSalesExtractionsResult = { extractions: any[] };

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
                helpCenterIds: doc.helpCenterIds || [doc.helpCenterId],
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

  // Resolve spaceId
  const hubSnap = await adminDB.collection("hubs").doc(convo.hubId).get();
  if (!hubSnap.exists) return null;
  const spaceId = hubSnap.data()?.spaceId;
  if (!spaceId) return null;

  // ---- CASE A: Webchat / Visitor-based ----
  if (convo.visitorId) {
    const visitorRef = adminDB.collection("visitors").doc(convo.visitorId);
    const visitorSnap = await visitorRef.get();
    if (!visitorSnap.exists) return null;
    const visitor = { id: visitorSnap.id, ...(visitorSnap.data() as any) };

    let vName = visitor.name;
    if (!vName || vName.trim() === "" || vName.trim() === "Unknown") {
      vName = '';
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

    const now = new Date();

    if (!contactId) {
      const newContactRef = await adminDB.collection("contacts").add({
        spaceId,
        name: vName,
        company: visitor.companyName || null,
        emails: vEmail ? [vEmail.toLowerCase()] : [],
        phones: vPhone ? [vPhone] : [],
        primaryEmail: vEmail ? vEmail.toLowerCase() : null,
        primaryPhone: vPhone || null,
        primaryPhoneE164: null,
        primaryPhoneNormalized: vPhone ? normalizePhoneFallback(vPhone) : null,
        phoneNormalizationStatus: vPhone ? "fallback" : "unknown",
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

      await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: "identity_added",
        summary: "Contact created automatically from chat.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { source: "chat", hubId: convo.hubId, spaceId },
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
          updates.primaryPhoneNormalized = normalizePhoneFallback(vPhone);
          updates.phoneNormalizationStatus = "fallback";
        }

        if (Object.keys(updates).length > 0) {
          await contactRef.update({ ...updates, updatedAt: now });
        }
      }
    }

    const eventQuery = await adminDB.collection("contacts").doc(contactId).collection("events")
      .where("type", "==", "chat_started")
      .where("ref.conversationId", "==", conversationId)
      .limit(1)
      .get();

    if (eventQuery.empty) {
      await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: "chat_started",
        summary: `Started a chat conversation as ${vName}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { conversationId, visitorId: visitor.id, hubId: convo.hubId, spaceId },
      });
    }

    const convoUpdates: any = {
      contactId,
      visitorName: vName,
      visitorEmail: vEmail,
      visitorPhone: vPhone,
      customerIdentified: true,
      updatedAt: new Date().toISOString(),
    };

    if (!convo.lastMessageAuthor ||
      convo.lastMessageAuthor === "Visitor" ||
      convo.lastMessageAuthor === "Unknown" ||
      isWhimsical(convo.lastMessageAuthor)) {
      convoUpdates.lastMessageAuthor = vName;
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(convoUpdates).filter(([_, v]) => v !== undefined)
   );

    await Promise.all([
      visitorRef.update({ contactId }),
      convoRef.update(cleanUpdates),
    ]);

    return contactId;
  }

  // ---- CASE B: SMS-based ----
  if (convo.channel === "sms" && convo.externalAddress) {
    const fromE164 = String(convo.externalAddress);
    const fromFallback = normalizePhoneFallback(fromE164);

    let contactId: string | null = convo.contactId || null;

    if (!contactId) {
      const byE164 = await adminDB.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhoneE164", "==", fromE164)
        .limit(1)
        .get();
      if (!byE164.empty) contactId = byE164.docs[0].id;
    }

    if (!contactId && fromFallback) {
      const byNorm = await adminDB.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhoneNormalized", "==", fromFallback)
        .limit(1)
        .get();
      if (!byNorm.empty) contactId = byNorm.docs[0].id;
    }

    if (!contactId) {
      const byRaw = await adminDB.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhone", "==", fromE164)
        .limit(1)
        .get();
      if (!byRaw.empty) contactId = byRaw.docs[0].id;
    }

    const now = new Date();

    if (!contactId) {
      const newContactRef = await adminDB.collection("contacts").add({
        spaceId,
        name: fromE164,
        emails: [],
        phones: [fromE164],
        primaryEmail: null,
        primaryPhone: fromE164,
        primaryPhoneE164: fromE164,
        primaryPhoneNormalized: fromFallback || null,
        phoneNormalizationStatus: "e164",
        source: "sms",
        externalIds: {},
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

      await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: "identity_added",
        summary: "Contact created automatically from SMS.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { source: "sms", hubId: convo.hubId, spaceId },
      });
    } else {
      const contactRef = adminDB.collection("contacts").doc(contactId);
      const contactSnap = await contactRef.get();
      if (contactSnap.exists) {
        const contactData = contactSnap.data() as any;
        const updates: any = {};

        if (!contactData.primaryPhone) {
          updates.primaryPhone = fromE164;
          updates.phones = admin.firestore.FieldValue.arrayUnion(fromE164);
        }
        if (!contactData.primaryPhoneE164) {
          updates.primaryPhoneE164 = fromE164;
        }
        if (!contactData.primaryPhoneNormalized && fromFallback) {
          updates.primaryPhoneNormalized = fromFallback;
          updates.phoneNormalizationStatus = contactData.primaryPhoneE164 ? "e164" : "fallback";
        }

        if (Object.keys(updates).length > 0) {
          await contactRef.update({ ...updates, updatedAt: now });
        }
      }
    }

    const eventQuery = await adminDB.collection("contacts").doc(contactId).collection("events")
      .where("type", "==", "chat_started")
      .where("ref.conversationId", "==", conversationId)
      .limit(1)
      .get();

    if (eventQuery.empty) {
      await adminDB.collection("contacts").doc(contactId).collection("events").add({
        type: "chat_started",
        summary: `Started an SMS conversation from ${fromE164}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ref: { conversationId, hubId: convo.hubId, spaceId },
      });
    }

    await convoRef.update({
      contactId,
      visitorPhone: fromE164,
      customerIdentified: true,
      updatedAt: new Date().toISOString(),
      lastMessageAuthor: convo.lastMessageAuthor && !isWhimsical(convo.lastMessageAuthor)
        ? convo.lastMessageAuthor
        : fromE164,
    });

    return contactId;
  }

  return null;
}
  
  export async function addChatMessage(message: Omit<ChatMessage, "id">) {
    const messageRef = await adminDB.collection("chat_messages").add(message);
    
    if (message.conversationId && message.type === 'message') {
      let authorName = "Visitor";
      let senderType = '';
  
      if (message.authorId === 'ai_agent') {
          authorName = message.responderType === 'ai' ? 'Assistant' : 'Support Assistant';
          senderType = 'ai';
      } else if (message.senderType === 'agent') {
        const userDoc = await adminDB.collection('users').doc(message.authorId).get();
        if (userDoc.exists) authorName = userDoc.data()?.name || 'Agent';
        senderType = 'agent'
      } else { 
        const linkedContactId = await ensureCrmLinkedForConversationAdmin(message.conversationId);
        if (linkedContactId) {
            const contactDoc = await adminDB.collection('contacts').doc(linkedContactId).get();
            authorName = contactDoc.data()?.name || 'Visitor';
        }
        senderType = 'visitor'
      }
  
      const preview = (message.content || "").slice(0, 140) || (message.attachments?.length ? "Sent an attachment" : "");
      const timestamp = new Date().toISOString();
  
      await Promise.all([
        updateConversation(message.conversationId, {
          lastMessageAt: message.timestamp,
          lastMessage: preview,
          lastMessageAuthor: authorName,
          lastResponderType: message.responderType,
          updatedAt: timestamp as any,
          senderType: senderType || ''
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
      bot: any;
      conversation: Conversation;
      message: IncomingMessage;
  }) {
      let { bot } = args;

      // ---- INTELLIGENT AGENT RESOLUTION (Stage vs Actor) ----
      // If this is a widget, resolve its brain from the assigned AI Agent
      if (bot.assignedAgentId) {
          const aiAgentDoc = await adminDB.collection('bots').doc(bot.assignedAgentId).get();
          if (aiAgentDoc.exists) {
              const aiAgentData = aiAgentDoc.data();
              bot = {
                  ...bot, // keep widget metadata (branding, etc)
                  ...aiAgentData, // inherit agent knowledge and logic
                  id: aiAgentDoc.id,
              };
          }
      }

      const adapters: AgentAdapters = {
          searchHelpCenter,
          searchSupport,
          generateAnswer: async (params) => {
              const result = await agentResponse(params);
              return result.answer;
          },
          escalateToHuman: async ({ conversationId, reason }) => {
              await updateConversation(conversationId, {
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
                  const msgRef = await adminDB.collection("chat_messages").add({
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
                      console.error("AI SMS delivery failed", e);
                      await msgRef.update({ deliveryStatus: 'failed' });
                  }
              } else {
                  await addChatMessage(messageData);
              }
          },
          updateConversation: async ({ conversationId, patch }) => {
              await updateConversation(conversationId, patch);
          },
      };

      const botConfig: BotConfig = {
          id: bot.id,
          hubId: bot.hubId,
          name: bot.name,
          webAgentName: bot.webAgentName,
          allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
          aiEnabled: bot.aiEnabled,
          handoffKeywords: bot.automations?.handoffKeywords,
          quickReplies: bot.automations?.quickReplies,
          flow: bot.flow,
          conversationGoal: bot.conversationGoal,
          identityCapture: bot.identityCapture,
      };
  
      await handleIncomingMessage({ ...args, bot: botConfig, adapters });
  }

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}

export async function searchSupportAction(params: SearchSupportParams): Promise<SearchSupportResult> {
  return searchSupport(params);
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
  convoStatus?: string
}) {
  const convoRef = await adminDB.collection("conversations").add({
    hubId: args.hubId,
    contactId: null,
    visitorId: args.visitorId,
    assigneeId: args.assigneeId,
    assignedAgentIds: args.assigneeId ? [args.assigneeId] : [], 
    status: "new",
    state: "ai_active",
    lastMessage: args.lastMessage,
    lastMessageAt: new Date().toISOString(),
    lastMessageAuthor: args.lastMessageAuthor,
    updatedAt: new Date().toISOString(),
    channel: 'webchat',
    ownerType: 'hub',
    ownerAgentId: null,
    sharedWithTeam: false,
    convoStatus: args.convoStatus || ''
  });

  await ensureCrmLinkedForConversationAdmin(convoRef.id);

  const snap = await convoRef.get();
  return { id: convoRef.id, ...(snap.data() as any) };
}

export async function exportLibraryAction(helpCenterId: string) {
  const hcDoc = await adminDB.collection('help_centers').doc(helpCenterId).get();
  const collectionsSnap = await adminDB.collection('help_center_collections').where('helpCenterId', '==', helpCenterId).get();
  const articlesSnap = await adminDB.collection('help_center_articles').where('helpCenterId', '==', helpCenterId).get();

  return {
    helpCenter: { id: hcDoc.id, ...hcDoc.data() },
    collections: collectionsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    articles: articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };
}

export async function importLibraryAction(hubId: string, spaceId: string, authorId: string, data: any) {
  const batch = adminDB.batch();
  
  // 1. Create HC
  const hcRef = adminDB.collection('help_centers').doc();
  const newHcId = hcRef.id;
  const { id: oldHcId, ...hcData } = data.helpCenter;
  batch.set(hcRef, { ...hcData, id: newHcId, hubId, spaceId });

  // 2. Collections (need to map old IDs to new IDs for parentId)
  const idMap: Record<string, string> = {};
  data.collections.forEach((c: any) => {
    const ref = adminDB.collection('help_center_collections').doc();
    idMap[c.id] = ref.id;
  });

  data.collections.forEach((c: any) => {
    const newId = idMap[c.id];
    const { id: oldId, ...collectionData } = c;
    batch.set(adminDB.collection('help_center_collections').doc(newId), {
      ...collectionData,
      id: newId,
      hubId,
      helpCenterId: newHcId,
      parentId: c.parentId ? (idMap[c.parentId] || null) : null
    });
  });

  // 3. Articles
  data.articles.forEach((a: any) => {
    const ref = adminDB.collection('help_center_articles').doc();
    const { id: oldId, ...articleData } = a;
    batch.set(ref, {
      ...articleData,
      id: ref.id,
      hubId,
      spaceId,
      helpCenterId: newHcId,
      folderId: a.folderId ? (idMap[a.folderId] || null) : null,
      authorId
    });
  });

  await batch.commit();
}

export async function reindexArticleAction(articleId: string) {
  const docSnap = await adminDB.collection("help_center_articles").doc(articleId).get();
  if (!docSnap.exists) return;
  const article = { id: docSnap.id, ...docSnap.data() };
  
  const hubDoc = await adminDB.collection("hubs").doc(article.hubId).get();
  const spaceId = hubDoc.data()?.spaceId;
  
  if (!spaceId) return;

  return indexHelpCenterArticleToChunks({
    adminDB,
    article,
    spaceId,
    publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "https://app.manowar.cloud",
  });
}

export async function searchSalesExtractionsAction(params: { query: string; spaceId: string }): Promise<SearchSalesExtractionsResult> {
    const { query, spaceId } = params;
    
    const searchParameters = {
        'q': query,
        'query_by': 'recommendedPersonaClusterText,pains,objections,buyingSignals',
        'filter_by': `spaceId:=${spaceId}`,
        'per_page': 50
    };

    try {
        const results = await typesense.collections('sales_extractions').documents().search(searchParameters);
        const extractions = (results.hits || []).map(hit => ({
            id: hit.document.id,
            ...hit.document,
            _searchScore: hit.text_match_info?.score ? parseFloat(hit.text_match_info.score) / 1000 : 0,
        }));
        return { extractions };
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.warn("Typesense search failed: 'sales_extractions' collection not found. Returning empty results.");
            return { extractions: [] };
        }
        console.error("Typesense search failed in searchSalesExtractionsAction:", error);
        return { extractions: [] };
    }
}

export async function crawlWebsiteAction(url: string) {
  return crawlWebsiteKnowledge({ url });
}
