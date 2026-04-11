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

  const policy: AgentKnowledgePolicy = {
    agentId: effectiveBot.id,
    isCustomerFacing: effectiveBot.type === 'widget',
    accessLevel: effectiveBot.intelligenceAccessLevel || 'insights_hidden_support',
    allowedLibraryIds: effectiveBot.allowedHelpCenterIds || []
  };

  const decision = await orchestrateRetrieval({
    message,
    hubId: effectiveBot.hubId,
    spaceId: effectiveBot.spaceId,
    policy
  });

  let systemInstruction = `You are ${webAgentName}, a helpful AI assistant. Be conversational, warm, and accurate.`;
  
  const score = decision.confidence;
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  const strategy = effectiveBot.confidenceHandling?.[level] || (level === 'low' ? 'clarify' : 'answer');

  if (strategy === 'answer_softly') {
    systemInstruction += "\n\nCRITICAL: Answer cautiously but confidently. If you aren't fully certain, offer to connect to a human. Do NOT use phrases like 'Based on our documentation' or 'It appears'.";
  }
  
  if (effectiveBot.behavior?.revealUncertainty && level !== 'high') {
    systemInstruction += "\n\nPOLITE DISCLOSURE: Be open about your level of certainty if the documentation isn't perfectly clear.";
  }

  if (effectiveBot.behavior?.mode === 'sales') {
    systemInstruction += "\n\nSALES POSTURE: Be consultative and focused on value. Move the user towards a meeting or quote.";
  }

  if (effectiveBot.conversationGoal || effectiveBot.primaryGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${effectiveBot.conversationGoal || effectiveBot.primaryGoal}`;
  }

  // Business context
  if (effectiveBot.businessContext) {
    const bc = effectiveBot.businessContext;
    const lines: string[] = [];
    if (bc.businessName) lines.push(`Business: ${bc.businessName}`);
    if (bc.location) lines.push(`Location: ${bc.location}`);
    if (bc.hours) lines.push(`Operating Hours: ${bc.hours}`);
    if (bc.description) lines.push(`What We Do: ${bc.description}`);
    if (bc.targetAudience) lines.push(`Target Audience: ${bc.targetAudience}`);
    if (bc.minOrder) lines.push(`Minimum Order: ${bc.minOrder}`);
    if (bc.turnaround) lines.push(`Typical Turnaround: ${bc.turnaround}`);
    if (bc.differentiation) lines.push(`Why Choose Us: ${bc.differentiation}`);
    if (bc.forbiddenTopics) lines.push(`NEVER discuss: ${bc.forbiddenTopics}`);
    if (lines.length > 0) {
      systemInstruction += `\n\nBUSINESS CONTEXT:\n${lines.join('\n')}`;
    }
  }

  // Products
  if (effectiveBot.products?.length) {
    const productLines = effectiveBot.products.map((p: any, i: number) => {
      let line = `${i + 1}. ${p.name}`;
      if (p.price) line += ` — ${p.price}`;
      if (p.description) line += `\n   Description: ${p.description}`;
      if (p.triggers) line += `\n   Recommend when: ${p.triggers}`;
      return line;
    });
    systemInstruction += `\n\nPRODUCTS & SERVICES:\n${productLines.join('\n')}`;
  }

  // FAQs
  if (effectiveBot.faqs?.length) {
    const faqLines = effectiveBot.faqs.map((f: any, i: number) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`);
    systemInstruction += `\n\nFREQUENTLY ASKED QUESTIONS:\n${faqLines.join('\n')}`;
  }

  // Objections
  if (effectiveBot.objections?.length) {
    const objLines = effectiveBot.objections.map((o: any, i: number) => `${i + 1}. Objection: ${o.objection}\n   Response: ${o.response}`);
    systemInstruction += `\n\nHOW TO HANDLE OBJECTIONS:\n${objLines.join('\n')}`;
  }

  const result = await agentResponse({
    query: message,
    botName: webAgentName,
    context: decision.chosenCandidates.map((c) => ({
      sourceId: c.id,
      sourceType: c.sourceType,
      title: c.title || 'Source',
      text: c.text,
      url: c.url,
    })),
    greetingScript: systemInstruction,
  });

  const selectedSourceIds = new Set(
    (result?.selectedSourceIds || [])
      .map((id) => String(id || '').trim())
      .filter((id) => id.length > 0)
  );

  return {
    answer: (result?.answer || '').trim() || (decision.answerMode === 'escalate' ? `I'm not sure, let me connect you to a human.` : ''),
    usedAgentName: webAgentName,
    sources: result?.showSources
      ? decision.chosenCandidates
          .filter((c) => c.sourceType === 'article' && selectedSourceIds.has(c.id))
          .slice(0, 3)
          .map((c) => ({
            articleId: c.id,
            title: c.title || 'Untitled',
            url: c.url || '',
            score: c.score,
          }))
      : [],
  };
}

export async function invokeAgent(args: {
  bot: any;
  conversation: Conversation;
  message: IncomingMessage;
}) {
  console.log("[invokeAgent] Starting with args:", { botId: args.bot?.id, convoId: args.conversation?.id });
  
  let { bot, conversation } = args;

  const resolved = bot?.id ? await resolveRuntimeBot(bot.id) : null;
  console.log("[invokeAgent] resolveRuntimeBot result:", resolved ? "found" : "not found");
  const effectiveBot = resolved?.effectiveBot || bot;

  const adapters: AgentAdapters = {
    retrieveContext: async (params) => {
      return orchestrateRetrieval({
        ...params,
        policy: {
          ...params.policy,
          isCustomerFacing: effectiveBot.type === 'widget'
        }
      });
    },
    generateAnswer: async (params) => {
      // Fetch recent conversation history for context
      let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      try {
        const convoId = conversation.id;
        const recentMsgs = await adminDB.collection('chat_messages')
          .where('conversationId', '==', convoId)
          .orderBy('timestamp', 'desc')
          .limit(6)
          .get();
        history = recentMsgs.docs
          .reverse()
          .map(doc => {
            const d = doc.data();
            return {
              role: d.senderType === 'agent' ? 'assistant' as const : 'user' as const,
              content: String(d.content || ''),
            };
          })
          .filter(m => m.content.length > 0);
      } catch (e) {
        // history is optional, continue without it
      }

      const llmInput = { ...params, history };
      console.log('\n==================== LLM INPUT ====================');
      console.log('[query]', llmInput.query);
      console.log('[botName]', llmInput.botName);
      console.log('[greetingScript]', llmInput.greetingScript);
      console.log('[history]', JSON.stringify(llmInput.history, null, 2));
      console.log('[context chunks]');
      (llmInput.context || []).forEach((c, i) => {
        console.log(`  [${i + 1}] sourceType=${c.sourceType} id=${c.sourceId} title="${c.title}"`);
        console.log(`       text (${c.text.length} chars): ${c.text.substring(0, 600)}${c.text.length > 600 ? '...' : ''}`);
      });
      console.log('==================== END LLM INPUT ====================\n');

      const result = await agentResponse(llmInput);
      return {
        answer: result.answer,
        showSources: result.showSources,
        selectedSourceIds: result.selectedSourceIds,
        requestsHumanHandoff: result.requestsHumanHandoff,
      };
    },
    escalateToHuman: async ({ conversationId, reason }) => {
      await adminDB.collection('conversations').doc(conversationId).update({
        escalated: true,
        escalationReason: reason,
      });
    },
    persistAssistantMessage: async ({ conversationId, text, responderType, meta, sources }) => {
      const convo = await adminDB.collection('conversations').doc(conversationId).get();
      const convoData = convo.data() as Conversation;

      const messageData: Omit<ChatMessage, 'id'> & { meta?: any } = {
        conversationId,
        authorId: 'ai_agent',
        type: 'message',
        senderType: 'agent',
        responderType,
        content: text,
        timestamp: new Date().toISOString(),
        attachments: [],
        sources: sources || null,
        ...(meta ? { meta } : {}),
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
    getOnlineAgentIds: async ({ hubId }) => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      // Single-field query avoids needing a composite Firestore index.
      // Filter lastSeenAt in memory.
      const snap = await adminDB.collection('users')
        .where('hubIds', 'array-contains', hubId)
        .get();
      return snap.docs
        .filter(d => {
          const lastSeen = d.data().lastSeenAt;
          return lastSeen && lastSeen >= fiveMinAgo;
        })
        .map(d => d.id);
    },
  };

  const botConfig: BotConfig = {
    id: effectiveBot.id,
    type: effectiveBot.type || 'widget', 
    hubId: effectiveBot.hubId,
    name: effectiveBot.name,
    webAgentName: effectiveBot.webAgentName || effectiveBot.name,
    allowedHelpCenterIds: effectiveBot.allowedHelpCenterIds || [],
    intelligenceAccessLevel: effectiveBot.intelligenceAccessLevel || 'insights_hidden_support',
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
    behavior: effectiveBot.behavior,
    confidenceHandling: effectiveBot.confidenceHandling,
    escalation: effectiveBot.escalation,
    offlineFollowup: effectiveBot.offlineFollowup,
    identityCapture: effectiveBot.identityCapture,
    channelConfig: effectiveBot.channelConfig,
    tone: effectiveBot.tone,
    responseLength: effectiveBot.responseLength,
    voiceNotes: effectiveBot.voiceNotes,
    primaryGoal: effectiveBot.primaryGoal,
    secondaryGoal: effectiveBot.secondaryGoal,
    roleTitle: effectiveBot.roleTitle,
    businessContext: effectiveBot.businessContext,
    products: effectiveBot.products,
    faqs: effectiveBot.faqs,
    objections: effectiveBot.objections,
  };

  console.log("[invokeAgent] Calling handleIncomingMessage with botConfig:", { id: botConfig.id, aiEnabled: botConfig.aiEnabled });
  
  await handleIncomingMessage({
    ...args,
    conversation,
    bot: botConfig,
    adapters,
  });
  
  console.log("[invokeAgent] handleIncomingMessage completed");
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

  const chunksRef = adminDB.collection('brain_chunks');
  const existingChunks = await chunksRef.where('sourceId', '==', articleId).get();
  const batch = adminDB.batch();
  existingChunks.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  await indexHelpCenterArticleToChunks({
    adminDB,
    article,
    spaceId,
    publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "",
  });
}

// -------------------------
// Smart Handoff: Offline Contact Capture
// -------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-+().]{7,20}$/;

export async function submitOfflineContact(args: {
  conversationId: string;
  contactMethod: 'email' | 'phone';
  contactValue: string;
  visitorName?: string;
}) {
  const { conversationId, contactMethod, contactValue, visitorName } = args;
  const trimmed = contactValue.trim();
  const trimmedName = visitorName?.trim() || '';

  // Validate
  if (contactMethod === 'email' && !EMAIL_RE.test(trimmed)) {
    return { success: false, error: 'Invalid email address.' };
  }
  if (contactMethod === 'phone' && !PHONE_RE.test(trimmed)) {
    return { success: false, error: 'Invalid phone number.' };
  }

  const convoRef = adminDB.collection('conversations').doc(conversationId);
  const convoSnap = await convoRef.get();
  if (!convoSnap.exists) {
    return { success: false, error: 'Conversation not found.' };
  }

  const convo = convoSnap.data()!;
  const now = new Date().toISOString();

  // Update conversation with offline followup data
  const patch: Record<string, any> = {
    status: 'offline_followup_pending',
    offlineFollowup: {
      requested: true,
      contactMethod,
      contactValue: trimmed,
      requestedAt: now,
    },
    updatedAt: now,
  };

  // Also enrich visitor contact fields
  if (contactMethod === 'email') {
    patch.visitorEmail = trimmed;
  } else {
    patch.visitorPhone = trimmed;
  }
  if (trimmedName) patch.visitorName = trimmedName;

  await convoRef.update(patch);

  // Update visitor record if exists
  if (convo.visitorId) {
    const visitorUpdate: Record<string, any> = {};
    if (contactMethod === 'email') visitorUpdate.email = trimmed;
    if (contactMethod === 'phone') visitorUpdate.phone = trimmed;
    if (trimmedName) visitorUpdate.name = trimmedName;
    visitorUpdate.updatedAt = now;
    await adminDB.collection('visitors').doc(convo.visitorId).update(visitorUpdate).catch(() => {});
  }

  // Write confirmation message
  const displayValue = contactMethod === 'email' ? trimmed : trimmed;
  await adminDB.collection('chat_messages').add({
    conversationId,
    authorId: 'system',
    type: 'message',
    senderType: 'bot',
    responderType: 'system',
    content: `Thanks! Our team isn't available right now, but we'll reach out to you at ${displayValue} as soon as we can.`,
    timestamp: now,
    meta: { type: 'offline_followup_confirmation' },
  });

  // Mark as escalated so it appears in the human inbox
  await convoRef.update({
    escalated: true,
    escalationReason: 'Offline followup requested',
  });

  return { success: true };
}
