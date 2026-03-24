/**
 * agent.ts (Hybrid Intelligence & Intent Routing Engine)
 *
 * Implements conversational AI reasoning + deterministic subflow execution.
 */

import type { Conversation as ImportedConversation, SupportIntentNode, ConversationStatus, ResponderType, AutomationNode, AutomationEdge, Bot, IntelligenceAccessLevel } from "./data";

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  type: 'agent' | 'widget'; // REQUIRED PLUMBING
  hubId: string;
  name: string;
  webAgentName?: string;
  allowedHelpCenterIds: string[];
  intelligenceAccessLevel?: IntelligenceAccessLevel;
  aiEnabled?: boolean; 
  handoffKeywords?: string[];
  quickReplies?: string[];
  flow?: { nodes: AutomationNode[], edges: AutomationEdge[] };
  conversationGoal?: string;
  identityCapture?: {
    timing: 'before' | 'after';
    fields: { name: boolean; email: boolean; phone: boolean };
  };
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
    activePlaybook?: any;
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

export interface RetrievalDecision {
  answerMode: 'article_grounded' | 'topic_supported' | 'insight_supported_hidden' | 'internal_evidence_only' | 'clarify' | 'escalate';
  chosenCandidates: Array<{
    sourceType: 'article' | 'topic' | 'insight' | 'chunk';
    id: string;
    text: string;
    title?: string;
    url?: string;
    score: number;
  }>;
  confidence: number;
  rationale: string;
}

export interface AgentAdapters {
  retrieveContext: (args: {
    message: string;
    hubId: string;
    spaceId: string;
    policy: {
      isCustomerFacing: boolean;
      accessLevel: IntelligenceAccessLevel;
      allowedLibraryIds: string[];
    };
  }) => Promise<RetrievalDecision>;

  generateAnswer: (args: {
    query: string;
    botName: string;
    context: Array<{ title: string; text: string; url?: string }>;
    greetingScript?: string;
  }) => Promise<string>;

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
  const text = (args.message.text ?? "").trim();

  // ---- 1. ESCALATION GUARD ----
  if (conversation.status === 'waiting_human' || conversation.status === 'resolved') {
    return;
  }

  // ---- 2. GLOBAL HANDOFF TRIGGERS ----
  const defaultHandoffKeywords = ['human', 'agent', 'person', 'representative', 'support'];
  const handoffKeywords = bot.handoffKeywords?.length ? bot.handoffKeywords : defaultHandoffKeywords;
  
  if (containsAny(text, handoffKeywords)) {
      await escalateNow(adapters, conversation, "Requested by user via keyword.");
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
      text: `I'm not quite sure how to help. Would you like to speak with a human agent?`,
      responderType: 'automation',
      meta: {
        buttons: [{ id: 'handoff', label: 'Talk to Human' }]
      }
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
  const edges = bot.flow!.edges || [];
  let currentStepId = conversation.meta?.currentFlowStepId;

  if (!currentStepId) {
    const startNode = nodes.find(n => n.type === 'start');
    currentStepId = startNode?.id;
  } else {
    const currentNode = nodes.find(n => n.id === currentStepId);
    if (!currentNode) return;

    if (currentNode.type === 'quick_reply' || currentNode.type === 'ai_classifier') {
      const selectedButtonId = message.meta?.buttonId;
      const targetEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === `intent:${selectedButtonId}`);

      if (targetEdge) {
        currentStepId = targetEdge.target;
      } else {
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      }
    } else if (currentNode.type === 'capture_input') {
      const inputType = currentNode.data.inputType || 'text';
      const isValid = validateInput(message.text, inputType);
      
      if (isValid) {
        if (currentNode.data.saveToProfile) {
          const varName = currentNode.data.variableName?.toLowerCase();
          const patch: Partial<Conversation> = {};
          if (varName === 'email') patch.visitorEmail = message.text.trim().toLowerCase();
          if (varName === 'name') patch.visitorName = message.text.trim();
          if (Object.keys(patch).length > 0) {
            await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch });
          }
        }
        const nextEdge = edges.find(e => e.source === currentFlowStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      } else {
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: currentNode.data.validation?.errorMessage || `Please enter a valid ${inputType}.`,
          responderType: 'automation',
        });
        return;
      }
    } else if (currentNode.type === 'identity_form') {
      if (conversation.visitorEmail || conversation.contactId) {
        const nextEdge = edges.find(e => e.source === currentFlowStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      } else {
        return;
      }
    } else {
      const nextEdge = edges.find(e => e.source === currentFlowStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      currentStepId = nextEdge?.target;
    }
  }

  let safetyLimit = 15;
  while (currentStepId && safetyLimit-- > 0) {
    const node = nodes.find(n => n.id === currentStepId);
    if (!node) break;

    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { meta: { ...conversation.meta, currentFlowStepId: currentStepId } }
    });

    if (node.type === 'start') {
      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      currentStepId = nextEdge?.target;
      continue;
    }

    if (node.type === 'message') {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || "",
        responderType: 'automation',
      });
      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      currentStepId = nextEdge?.target;
      continue;
    }

    if (node.type === 'quick_reply' || node.type === 'ai_classifier') {
      const buttons = node.type === 'quick_reply' ? node.data.buttons : node.data.intents;
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.text || node.data.prompt || "How can I help you?",
        responderType: 'automation',
        meta: { buttons }
      });
      return;
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

    if (node.type === 'identity_form') {
      if (conversation.visitorEmail || conversation.contactId) {
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
        continue;
      }
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: node.data.prompt || "Before we continue, could I get your name and email?",
        responderType: 'automation',
        meta: { type: 'identity_form' }
      });
      return;
    }

    if (node.type === 'ai_step') {
      const resolved = await executeAiPhase(args);
      if (resolved) {
        const resolvedEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === 'resolved');
        currentStepId = resolvedEdge?.target;
      } else {
        const unresolvedEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === 'unresolved');
        currentStepId = unresolvedEdge?.target;
      }
      if (!currentStepId) return;
      continue;
    }

    if (node.type === 'handoff') {
      await escalateNow(adapters, conversation, "Handoff step triggered.", node.data.text);
      return;
    }

    if (node.type === 'end') {
      return;
    }

    break;
  }
}

/**
 * Conversational Reasoning logic using Tiered Intelligence Orchestrator.
 */
async function executeAiPhase(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage;
  adapters: AgentAdapters;
}): Promise<boolean> {
  const { bot, adapters, conversation, message } = args;
  const text = message.text || "";
  const botName = bot.webAgentName || bot.name || "Support";

  await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { aiAttempted: true, status: 'open' }
  });

  // 1. Policy-Aware Retrieval Decision (PLUMBING: derive isCustomerFacing from bot type)
  const isCustomerFacing = bot.type === 'widget';

  const decision = await adapters.retrieveContext({
    message: text,
    hubId: bot.hubId,
    spaceId: conversation.spaceId,
    policy: {
      isCustomerFacing,
      accessLevel: bot.intelligenceAccessLevel || 'topics_only',
      allowedLibraryIds: bot.allowedHelpCenterIds || []
    }
  });

  // 2. Adaptive System Instruction
  let systemInstruction = `You are ${botName}, a helpful AI assistant. Be conversational, warm, and accurate.`;
  
  if (decision.answerMode === 'insight_supported_hidden') {
    systemInstruction += `\n\nCRITICAL POLICY: Your answer is based on internal support signals. DO NOT cite sources. DO NOT reveal internal language or customer names. Keep the tone helpful but cautious.`;
  } else if (decision.answerMode === 'topic_supported') {
    systemInstruction += `\n\nPOLICY: This information is based on recurring patterns. Avoid presenting it as absolute official policy if it sounds like a guarantee.`;
  }

  if (bot.conversationGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${bot.conversationGoal}`;
  }

  // 3. Generate Answer
  const context = decision.chosenCandidates.map(c => ({ title: c.title || 'Source', text: c.text, url: c.url }));
  const answer = await adapters.generateAnswer({
      query: text,
      botName: botName,
      context,
      greetingScript: systemInstruction
  });

  if (!answer || answer.trim() === "") {
      if (decision.answerMode === 'escalate') {
        await escalateNow(adapters, conversation, "No trusted knowledge sources found.");
        return true;
      }
      return false;
  }

  // 4. Persist result with tiered sources
  await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: answer,
      responderType: 'ai',
      sources: decision.chosenCandidates
        .filter(c => c.sourceType === 'article') // Only expose curated sources to UI
        .map(c => ({ title: c.title || 'Untitled', url: c.url || '', articleId: c.id, score: c.score })),
  });

  await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch: { aiResolved: true } });
  return true;
}

// -------------------------
// Helpers
// -------------------------

function validateInput(text: string, type: string): boolean {
  if (!text) return false;
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
    case 'phone':
      return /^\+?[\d\s\-()]{7,}$/.test(text.trim());
    default:
      return text.length > 0;
  }
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
