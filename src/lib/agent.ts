/**
 * agent.ts (Hybrid Intelligence & Intent Routing Engine)
 *
 * Implements conversational AI reasoning + deterministic subflow execution.
 */

import type { Conversation as ImportedConversation, SupportIntentNode, ConversationStatus, ResponderType, AutomationNode, AutomationEdge, Bot } from "./data";

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  hubId: string;
  name: string;
  allowedHelpCenterIds: string[];
  aiEnabled?: boolean; 
  handoffKeywords?: string[];
  quickReplies?: string[];
  flow?: { nodes: AutomationNode[], edges: AutomationEdge[] };
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
  const edges = bot.flow!.edges || [];
  let currentStepId = conversation.meta?.currentFlowStepId;

  // 1. Initial State Resolution
  if (!currentStepId) {
    const startNode = nodes.find(n => n.type === 'start');
    currentStepId = startNode?.id;
  } else {
    // Handling interaction with existing state
    const currentNode = nodes.find(n => n.id === currentStepId);
    if (!currentNode) return;

    if (currentNode.type === 'quick_reply' || currentNode.type === 'ai_classifier') {
      const selectedButtonId = message.meta?.buttonId;
      
      // Look for explicit edge from this button/intent
      const targetEdge = edges.find(e => 
        e.source === currentStepId && 
        e.sourceHandle === `intent:${selectedButtonId}`
      );

      if (targetEdge) {
        currentStepId = targetEdge.target;
      } else if (currentNode.type === 'ai_classifier') {
        // AI INTENT CLASSIFICATION for free-text
        const intents = currentNode.data.intents || [];
        const classification = await classifyIntent(message.text, intents);
        
        const intentEdge = edges.find(e => 
          e.source === currentStepId && 
          e.sourceHandle === `intent:${classification}`
        );

        if (intentEdge) {
          currentStepId = intentEdge.target;
        } else {
          // Fallback path
          const fallbackEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === 'fallback');
          currentStepId = fallbackEdge?.target;
        }
      } else {
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      }
    } else if (currentNode.type === 'capture_input') {
      // Validate input based on type
      const inputType = currentNode.data.inputType || 'text';
      const isValid = validateInput(message.text, inputType);
      
      if (isValid) {
        // --- CRM SYNC LOGIC ---
        if (currentNode.data.saveToProfile) {
          const varName = currentNode.data.variableName?.toLowerCase();
          const patch: Partial<Conversation> = {};
          if (varName === 'email') patch.visitorEmail = message.text.trim().toLowerCase();
          if (varName === 'name') patch.visitorName = message.text.trim();
          
          if (Object.keys(patch).length > 0) {
            await adapters.updateConversation({
              conversationId: conversation.id,
              hubId: conversation.hubId,
              patch
            });
          }
        }

        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      } else {
        // Validation failed - stay on current node and retry
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: currentNode.data.validation?.errorMessage || `Please enter a valid ${inputType}.`,
          responderType: 'automation',
        });
        return;
      }
    } else if (currentNode.type === 'identity_form') {
      // The widget will handle the actual identity capture.
      // If we are already identified, handleInput should advance.
      if (conversation.visitorEmail || conversation.contactId) {
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      } else {
        // Form not yet submitted
        return;
      }
    } else if (currentNode.type === 'condition') {
        const field = currentNode.data.conditionField;
        const operator = currentNode.data.operator || 'exists';
        const comparisonValue = currentNode.data.conditionValue;
        
        let actualValue: any = null;
        if (field === 'email') actualValue = conversation.visitorEmail;
        if (field === 'name') actualValue = conversation.visitorName;
        if (field === 'identified') actualValue = !!conversation.contactId;
        
        const met = evaluateCondition(actualValue, operator, comparisonValue);
        const targetHandle = met ? 'true' : 'false';
        const branchEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === targetHandle);
        currentStepId = branchEdge?.target;
    } else {
      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      currentStepId = nextEdge?.target;
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
      return; // Wait for input
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
      // SKIP if already identified
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
      return; // The widget detects meta.type === 'identity_form' and shows the form
    }

    if (node.type === 'condition') {
      const field = node.data.conditionField;
      const operator = node.data.operator || 'exists';
      const comparisonValue = node.data.conditionValue;
      
      let actualValue: any = null;
      if (field === 'email') actualValue = conversation.visitorEmail;
      if (field === 'name') actualValue = conversation.visitorName;
      if (field === 'identified') actualValue = !!conversation.contactId;

      const met = evaluateCondition(actualValue, operator, comparisonValue);
      const targetHandle = met ? 'true' : 'false';
      const branchEdge = edges.find(e => e.source === currentStepId && e.sourceHandle === targetHandle);
      currentStepId = branchEdge?.target;
      continue;
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
      if (!currentStepId) return; // AI handled it or path ends
      continue;
    }

    if (node.type === 'handoff') {
      await escalateNow(adapters, conversation, "Handoff step triggered.", node.data.text);
      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      if (nextEdge) {
          currentStepId = nextEdge.target;
          continue;
      }
      return;
    }

    if (node.type === 'end') {
      const waitBehavior = node.data.waitBehavior || 'pause';
      
      if (waitBehavior === 'end') {
        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: { status: 'resolved', meta: { ...conversation.meta, currentFlowStepId: undefined } }
        });
        return;
      }

      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
      if (nextEdge) {
          // It's a "Wait for visitor" but with a path forward. 
          // Stop this turn and let the next interaction pick up from here.
          return;
      }
      return;
    }

    break;
  }
}

/**
 * Conversational Reasoning logic.
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
      patch: { aiAttempted: true, status: 'open' }
  });

  // 1. Check Distilled Support Intents (Learned Intelligence)
  const supportSearch = await adapters.searchSupport({
      hubId: bot.hubId,
      userId: conversation.userId ?? null,
      query: text,
      topK: 3,
  });

  const topIntent = supportSearch.intents?.[0];
  if (topIntent && topIntent._searchScore && topIntent._searchScore > 0.7) {
      // Direct hit on learned knowledge
      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: topIntent.description,
          responderType: 'ai',
      });
      await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch: { aiResolved: true } });
      return true;
  }

  // 2. Search Documentation (RAG)
  const docSearch = await adapters.searchHelpCenter({
      hubId: bot.hubId,
      allowedHelpCenterIds: bot.allowedHelpCenterIds,
      userId: conversation.userId ?? null,
      query: text,
      topK: 5,
  });

  const chunks = docSearch.chunks ?? [];
  const topScore = chunks.length ? Math.max(...chunks.map(c => c.score)) : 0;

  if (topScore >= 0.5) {
      const context = chunks.map(c => ({ title: c.title, text: c.chunkText, url: c.url }));
      
      // Use Genkit to generate a natural, grounded answer
      const answer = await adapters.generateAnswer({
          query: text,
          botName,
          context,
      });

      await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: answer,
          responderType: 'ai',
          sources: chunks.slice(0, 3).map(c => ({ articleId: c.articleId, title: c.title, url: c.url, score: c.score })),
      });
      await adapters.updateConversation({ conversationId: conversation.id, hubId: conversation.hubId, patch: { aiResolved: true } });
      return true;
  }

  return false;
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
    case 'number':
      return !isNaN(parseFloat(text)) && isFinite(Number(text));
    case 'url':
      try { new URL(text); return true; } catch { return false; }
    case 'text':
    default:
      return text.length > 0;
  }
}

function evaluateCondition(value: any, operator: string, comparison: any): boolean {
  switch (operator) {
    case 'exists':
      return value !== null && value !== undefined && value !== '';
    case 'equals':
      return String(value) === String(comparison);
    case 'not_equals':
      return String(value) !== String(comparison);
    case 'contains':
      return String(value).toLowerCase().includes(String(comparison).toLowerCase());
    case 'gt':
      return Number(value) > Number(comparison);
    case 'lt':
      return Number(value) < Number(comparison);
    default:
      return !!value;
  }
}

/**
 * Categorize free-text input against defined intent paths.
 */
async function classifyIntent(text: string, intentPaths: { id: string; label: string; description?: string }[]): Promise<string | null> {
    if (!text || intentPaths.length === 0) return null;
    
    const normalizedText = text.toLowerCase();
    for (const path of intentPaths) {
        if (normalizedText.includes(path.label.toLowerCase())) {
            return path.id;
        }
    }
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
