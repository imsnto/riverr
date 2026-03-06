/**
 * agent.ts (Hybrid Intelligence & Intent Routing Engine)
 *
 * Implements conversational AI reasoning + deterministic subflow execution.
 */

import type { Conversation as ImportedConversation, SupportIntentNode, ConversationStatus, ResponderType, AutomationNode, Bot } from "./data";

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  hubId: string;
  name: string;
  allowedHelpCenterIds: string[];
  aiEnabled?: boolean; 
  handoffKeywords?: string[];
  quickReplies?: string[];
  flow?: { nodes: AutomationNode[] };
}

export type Conversation = ImportedConversation & {
  status: ConversationStatus;
  lastResponderType?: ResponderType;
  aiAttempted?: boolean;
  aiResolved?: boolean;
  customerIdentified?: boolean;

  visitorName?: string | null;
  visitorEmail?: string | null;
  userId?: string | null;

  handoff?: {
    status: "none" | "offered" | "declined" | "completed";
    reason?: string;
    offeredAt?: string; // ISO
  } | null;
  meta?: {
    attemptCount?: number;
    intentHistory?: string[];
    activePlaybook?: ActivePlaybookInfo;
    currentFlowStepId?: string; // Tracks position in hybrid flow
    [key: string]: any;
  };
};

export interface IncomingMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string; // ISO
  meta?: {
    buttonId?: string; // If message was triggered by a specific button mapping
  };
}

export interface HelpChunk {
  chunkText: string;
  score: number;
  articleId: string;
  title: string;
  url: string;
  helpCenterIds: string[];
  updatedAt?: string;
  articleType: 'article' | 'playbook' | 'snippet' | 'pdf';
  articleContent: string | null;
}

export interface SearchHelpCenterParams {
  hubId: string;
  allowedHelpCenterIds: string[];
  userId?: string | null;
  query: string;
  topK?: number;
}

export interface SearchHelpCenterResult {
  chunks: HelpChunk[];
}

export interface SearchSupportParams {
  hubId: string;
  userId?: string | null;
  query: string;
  topK?: number;
}

export type SearchableSupportIntentNode = SupportIntentNode & { _searchScore?: number };

export interface SearchSupportResult {
  intents: SearchableSupportIntentNode[];
}


export interface AgentAdapters {
  searchHelpCenter: (params: SearchHelpCenterParams) => Promise<SearchHelpCenterResult>;
  searchSupport: (params: SearchSupportParams) => Promise<SearchSupportResult>;
  escalateToHuman: (args: {
    conversationId: string;
    hubId: string;
    reason: string;
    transcriptHint?: string;
  }) => Promise<void>;

  persistAssistantMessage: (args: {
    conversationId: string;
    hubId: string;
    text: string;
    responderType: ResponderType;
    sources?: Array<{ title: string; url: string; articleId: string; score: number }>;
    meta?: Record<string, unknown>;
  }) => Promise<void>;

  updateConversation: (args: {
    conversationId: string;
    hubId: string;
    patch: Partial<Conversation>;
  }) => Promise<void>;
}

// -------------------------
// Standard Hybrid Pipeline
// -------------------------

export async function handleIncomingMessage(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}) {
  const { bot, adapters } = args;
  let conversation = args.conversation;
  const text = args.message.text ?? "";
  const botName = bot.name || "Support";

  // ---- 1. ESCALATION GUARD ----
  if (conversation.status === 'waiting_human' || conversation.status === 'resolved') {
    return;
  }

  // ---- 2. GLOBAL HANDOFF TRIGGERS ----
  if (bot.handoffKeywords?.length && containsAny(text, bot.handoffKeywords)) {
      await escalateNow(adapters, conversation, "Requested via global trigger.");
      return;
  }

  // ---- 3. HYBRID FLOW EXECUTION ----
  if (bot.flow?.nodes?.length) {
    await executeHybridFlow(args);
    return;
  }

  // ---- 4. LEGACY AI FALLBACK ----
  if (bot.aiEnabled !== false) {
    await executeAiPhase(args);
    return;
  }

  // ---- 5. DEFAULT CLARIFICATION ----
  await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: `I'm not quite sure how to help. Could you tell me more about what you're looking for in **${botName}**?`,
      responderType: 'automation'
  });
}

// -------------------------
// Hybrid Flow Logic
// -------------------------

async function executeHybridFlow(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}) {
  const { bot, conversation, message, adapters } = args;
  const nodes = bot.flow!.nodes;
  let currentStepId = conversation.meta?.currentFlowStepId;

  // 1. Initial State Resolution
  if (!currentStepId) {
    const startNode = nodes.find(n => n.type === 'start');
    currentStepId = startNode?.nextStepId;
  } else {
    // Handling interaction with existing state
    const currentNode = nodes.find(n => n.id === currentStepId);
    
    if (currentNode?.type === 'quick_reply' || currentNode?.type === 'intent_router') {
      const selectedButtonId = message.meta?.buttonId;
      const buttons = currentNode.type === 'quick_reply' ? currentNode.data.buttons : currentNode.data.intents;
      const button = buttons?.find(b => b.id === selectedButtonId);
      
      if (button?.nextStepId) {
        currentStepId = button.nextStepId;
      } else if (currentNode.type === 'intent_router') {
        // AI INTENT CLASSIFICATION for Intent Router free-text
        const classification = await classifyIntent(message.text, buttons || []);
        if (classification) {
            currentStepId = classification;
        } else {
            currentStepId = currentNode.data.fallbackNextStepId || currentNode.nextStepId;
        }
      } else {
        currentStepId = currentNode.data.defaultNextStepId || currentNode.nextStepId;
      }
    } else if (currentNode?.type === 'capture_input') {
      currentStepId = currentNode.nextStepId;
    } else {
      currentStepId = currentNode?.nextStepId;
    }
  }

  // 2. Traversal Loop
  let safetyLimit = 15;
  while (currentStepId && safetyLimit-- > 0) {
    const node = nodes.find(n => n.id === currentStepId);
    if (!node) break;

    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { meta: { ...conversation.meta, currentFlowStepId: currentStepId } }
    });

    if (node.type === 'message') {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || "",
        responderType: 'automation',
      });
      currentStepId = node.nextStepId;
      continue;
    }

    if (node.type === 'quick_reply' || node.type === 'intent_router') {
      const buttons = node.type === 'quick_reply' ? node.data.buttons : node.data.intents;
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || "How can I help you?",
        responderType: 'automation',
        meta: { buttons }
      });
      return; // Wait for user choice (button or free-text for router)
    }

    if (node.type === 'capture_input') {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.prompt || "Please enter details:",
        responderType: 'automation',
      });
      return; 
    }

    if (node.type === 'condition') {
      const field = node.data.conditionField;
      let valExists = false;
      if (field === 'email') valExists = !!(conversation.visitorEmail || conversation.meta?.email);
      if (field === 'name') valExists = !!(conversation.visitorName || conversation.meta?.name);
      if (field === 'identified') valExists = !!conversation.contactId;

      currentStepId = valExists ? node.data.matchNextStepId : node.data.fallbackNextStepId;
      continue;
    }

    if (node.type === 'ai_step') {
      const resolved = await executeAiPhase(args);
      if (!resolved && node.data.fallbackNextStepId) {
        currentStepId = node.data.fallbackNextStepId;
        continue;
      }
      return; // AI handles the rest conversationally or waits
    }

    if (node.type === 'handoff') {
      await escalateNow(adapters, conversation, "Handoff step triggered.", node.data.text);
      return;
    }

    if (node.type === 'end') {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: { status: 'resolved', meta: { ...conversation.meta, currentFlowStepId: undefined } }
      });
      return;
    }

    break;
  }
}

/**
 * Conversational Reasoning logic.
 * AI attempts to answer using knowledge, clarifies if info is missing, or falls back.
 */
async function executeAiPhase(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}): Promise<boolean> {
  const { bot, adapters, conversation, message } = args;
  const text = message.text || "";
  const botName = bot.name || "Support";

  await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { aiAttempted: true, status: 'ai_active' }
  });

  // Intent-based Knowledge Lookup
  const supportSearchResults = await adapters.searchSupport({
      hubId: bot.hubId,
      userId: conversation.userId ?? null,
      query: text,
      topK: 1
  });

  if (supportSearchResults.intents?.[0]?._searchScore! > 0.6) {
      const intent = supportSearchResults.intents[0];
      
      // Auto-clarification: check for required context keys
      if (intent.requiredContext?.length) {
          const missing = intent.requiredContext.filter(c => !conversation.meta?.[c.key]);
          if (missing.length > 0) {
              await adapters.persistAssistantMessage({
                  conversationId: conversation.id,
                  hubId: conversation.hubId,
                  text: missing[0].question,
                  responderType: 'automation',
                  meta: { pendingIntent: intent.intentKey, missingKey: missing[0].key }
              });
              return true; // Wait for clarification
          }
      }

      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: intent.answerVariants[0]?.template || "I found an answer for you.",
          responderType: 'ai',
          meta: { intent: intent.intentKey, from: 'SupportIntent' },
      });
      await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch: { aiResolved: true } });
      return true;
  }

  // Knowledge Base Search
  const search = await adapters.searchHelpCenter({
      hubId: bot.hubId,
      allowedHelpCenterIds: bot.allowedHelpCenterIds,
      userId: conversation.userId ?? null,
      query: text,
      topK: 5,
  });

  const chunks = search.chunks ?? [];
  const topScore = chunks.length ? Math.max(...chunks.map(c => c.score)) : 0;

  if (topScore >= 0.55) {
      const best = [...chunks].sort((a, b) => b.score - a.score).slice(0, 3);
      let answerText = `I found some information in **${botName}** knowledge base:\n\n`;
      best.forEach(c => { answerText += `- ${c.chunkText.slice(0, 180)}...\n`; });

      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: answerText,
          responderType: 'ai',
          sources: best.map(c => ({ articleId: c.articleId, title: c.title, url: c.url, score: c.score })),
      });
      await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch: { aiResolved: true } });
      return true;
  }

  return false; // Fallback to automation path
}

// -------------------------
// Helpers
// -------------------------

/**
 * Categorize free-text input against defined intent paths.
 */
async function classifyIntent(text: string, intentPaths: { id: string; label: string; nextStepId?: string }[]): Promise<string | null> {
    if (!text || intentPaths.length === 0) return null;
    
    // Phase 1: Simple fuzzy matching
    const normalizedText = text.toLowerCase();
    for (const path of intentPaths) {
        if (normalizedText.includes(path.label.toLowerCase())) {
            return path.nextStepId || null;
        }
    }
    
    // In production, this would invoke a lightweight LLM classifier
    return null;
}

function containsAny(haystack: string, needles: string[]) {
  const h = (haystack ?? "").toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

async function escalateNow(adapters: AgentAdapters, conversation: Conversation, reason: string, customMessage?: string) {
  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: {
      status: 'waiting_human',
      lastResponderType: 'system',
      handoff: { status: "completed", reason, offeredAt: new Date().toISOString() },
    },
  });

  await adapters.escalateToHuman({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    reason,
  });

  await adapters.persistAssistantMessage({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    text: customMessage || `Connecting you to our team. They will reply here shortly.`,
    responderType: 'automation',
  });
}
