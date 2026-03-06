/**
 * agent.ts (Standardized Automation Flow execution)
 *
 * Handles logic for structured automation flows before/during AI and human phases.
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

interface PlaybookStep {
  step: string;
  description: string;
}

interface PlaybookContent {
  intent: string;
  description: string;
  steps: PlaybookStep[];
}

interface ActivePlaybookInfo {
  intent: string;
  content: PlaybookContent;
  currentStep: number;
}

export type Conversation = ImportedConversation & {
  // standardized metadata from PRD
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
    currentFlowStepId?: string; // New: Tracks position in structured flow
    [key: string]: any;
  };
};

export interface IncomingMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string; // ISO
  meta?: {
    buttonId?: string; // If message was triggered by a button click
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
// Standard Pipeline
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

  // ---- 1. HARD STOP: HUMAN ASSIGNED ----
  if (conversation.status === 'waiting_human' || conversation.status === 'resolved') {
    return;
  }

  // ---- 2. AUTOMATION CHECK: KEYWORD TRIGGER ----
  if (bot.handoffKeywords?.length && containsAny(text, bot.handoffKeywords)) {
      await offerHuman(adapters, conversation, botName, "User requested agent via keyword.");
      return;
  }

  // ---- 3. STRUCTURED FLOW EXECUTION ----
  if (bot.flow?.nodes?.length) {
    await executeFlow(args);
    return;
  }

  // ---- 4. AI HANDLING (IF ENABLED) - FALLBACK FOR LEGACY WITHOUT FLOW ----
  if (bot.aiEnabled !== false) {
    await executeAiPhase(args);
    return;
  }

  // ---- 5. HUMAN ESCALATION FALLBACK ----
  const attemptCount = (conversation.meta?.attemptCount ?? 0) + 1;
  if (attemptCount >= 2) {
      await offerHuman(adapters, conversation, botName, "AI unable to resolve request");
  } else {
      await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: { meta: { ...conversation.meta, attemptCount } }
      });
      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: `I'm not quite sure I follow. Could you rephrase your question or describe what you're trying to achieve in **${botName}**?`,
          responderType: 'automation'
      });
  }
}

// -------------------------
// Flow Logic
// -------------------------

async function executeFlow(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}) {
  const { bot, conversation, message, adapters } = args;
  const nodes = bot.flow!.nodes;
  let currentStepId = conversation.meta?.currentFlowStepId;

  // 1. Resolve current node based on input or start
  if (!currentStepId) {
    const startNode = nodes.find(n => n.type === 'start');
    currentStepId = startNode?.nextStepId;
  } else {
    // We are responding to an active interactive node
    const currentNode = nodes.find(n => n.id === currentStepId);
    if (currentNode?.type === 'quick_reply') {
      const selectedButtonId = message.meta?.buttonId;
      const button = currentNode.data.buttons?.find(b => b.id === selectedButtonId);
      if (button?.nextStepId) {
        currentStepId = button.nextStepId;
      } else {
        // Fallback or specific phrase match
        currentStepId = currentNode.nextStepId;
      }
    } else {
      // Default: move to next step
      currentStepId = currentNode?.nextStepId;
    }
  }

  // 2. Step through non-blocking nodes
  let limit = 10;
  while (currentStepId && limit-- > 0) {
    const node = nodes.find(n => n.id === currentStepId);
    if (!node) break;

    // Persist position
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

    if (node.type === 'quick_reply') {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || "Choose an option:",
        responderType: 'automation',
        meta: { buttons: node.data.buttons }
      });
      return; // Stop and wait for click
    }

    if (node.type === 'ai_step') {
      await executeAiPhase(args);
      return; // AI phase handles its own next steps or terminal state
    }

    if (node.type === 'handoff') {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: { status: 'waiting_human', lastResponderType: 'system' }
      });
      await adapters.escalateToHuman({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        reason: "Escalated by flow step.",
      });
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || `A support ticket has been created. Our team will respond shortly.`,
        responderType: 'automation',
      });
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

async function executeAiPhase(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}) {
  const { bot, adapters, conversation, message } = args;
  const text = message.text || "";
  const botName = bot.name || "Support";

  await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { aiAttempted: true, status: 'ai_active' }
  });

  // A. Support Intent Lookup
  const supportSearchResults = await adapters.searchSupport({
      hubId: bot.hubId,
      userId: conversation.userId ?? null,
      query: text,
      topK: 1
  });

  if (supportSearchResults.intents?.[0]?._searchScore! > 0.55) {
      const intent = supportSearchResults.intents[0];
      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: intent.answerVariants[0]?.template || "I found something.",
          responderType: 'ai',
          meta: { intent: intent.intentKey, from: 'SupportIntentNode' },
      });
      return;
  }

  // B. Help Center Search
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
      const steps = extractSteps(best);
      let answerText = `I found some information in **${botName}** knowledge base:\n`;
      if (steps.length) {
          answerText += "\nSteps:\n";
          steps.forEach((s, i) => { answerText += `${i + 1}. ${s}\n`; });
      } else {
          answerText += "\nSummary:\n";
          best.forEach(c => { answerText += `- ${c.chunkText.slice(0, 140)}...\n`; });
      }

      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: answerText,
          responderType: 'ai',
          sources: best.map(c => ({ articleId: c.articleId, title: c.title, url: c.url, score: c.score })),
          meta: { topScore },
      });
      return;
  }

  // If AI fails, offer human
  await offerHuman(adapters, conversation, botName, "AI unable to resolve request");
}

// -------------------------
// Helpers
// -------------------------

function containsAny(haystack: string, needles: string[]) {
  const h = (haystack ?? "").toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function extractSteps(chunks: HelpChunk[]) {
  const lines = chunks.flatMap(c => c.chunkText.split("\n"));
  return lines.map(l => l.trim()).filter(l => /^\d+\.|^step\s+/i.test(l)).slice(0, 6);
}

async function offerHuman(adapters: AgentAdapters, conversation: Conversation, botName: string, reason: string) {
  if (conversation.handoff?.status === "declined") return;

  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: {
      status: 'waiting_human',
      handoff: { status: "offered", reason, offeredAt: new Date().toISOString() },
    },
  });

  await adapters.persistAssistantMessage({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    text: `I’m sorry I couldn’t be more helpful. Would you like to talk to a member of the **${botName}** team?`,
    responderType: 'automation',
    meta: { handoff: "offered" },
  });
}
