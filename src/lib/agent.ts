/**
 * agent.ts (Hybrid Intelligence & Intent Routing Engine)
 *
 * Implements conversational AI reasoning + deterministic subflow execution.
 */

import type { Conversation as ImportedConversation, ConversationStatus, ResponderType, AutomationNode, AutomationEdge, Bot, IntelligenceAccessLevel } from "./data";

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  type: 'agent' | 'widget';
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
  
  // Intelligence Posture
  behavior?: Bot['behavior'];
  confidenceHandling?: Bot['confidenceHandling'];
  escalation: Bot['escalation'];
  identityCapture: Bot['identityCapture'];
  channelConfig: Bot['channelConfig'];
  tone?: Bot['tone'];
  responseLength?: Bot['responseLength'];
  voiceNotes?: Bot['voiceNotes'];
  primaryGoal?: Bot['primaryGoal'];
  secondaryGoal?: Bot['secondaryGoal'];
  roleTitle?: Bot['roleTitle'];

  // Knowledge
  businessContext?: Bot['businessContext'];
  products?: Bot['products'];
  faqs?: Bot['faqs'];
  objections?: Bot['objections'];
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
    context: Array<{
      sourceId: string;
      sourceType: 'article' | 'topic' | 'insight' | 'chunk';
      title: string;
      text: string;
      url?: string;
    }>;
    greetingScript?: string;
  }) => Promise<{ answer: string; showSources: boolean; selectedSourceIds: string[]; requestsHumanHandoff?: boolean }>;

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

function normalizeSourceUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = (process.env.PUBLIC_HELP_BASE_URL || '').replace(/\/$/, '');
  if (base && trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }

  return trimmed;
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
  console.log("[handleIncomingMessage] Starting...", { botId: args.bot.id, convoStatus: args.conversation.status, aiEnabled: args.bot.aiEnabled });
  
  const { bot, adapters } = args;
  let conversation = args.conversation;
  const text = (args.message.text ?? "").trim();

  // ---- 1. ESCALATION GUARD ----
  if (conversation.status === 'waiting_human') {
    console.log("[handleIncomingMessage] Early return - conversation status: waiting_human");
    return;
  }

  // Auto-reopen resolved/closed conversations when customer sends a new message
  if (conversation.status === 'resolved' || conversation.status === 'closed') {
    console.log("[handleIncomingMessage] Auto-reopening conversation from status:", conversation.status);
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: {
        status: 'ai_active',
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        reopenCount: ((conversation as any).reopenCount ?? 0) + 1,
      } as any,
    });
    conversation = { ...conversation, status: 'ai_active' };
  }

  // ---- 2. GLOBAL HANDOFF TRIGGERS ----
  const defaultHandoffKeywords = ['human', 'agent', 'person', 'representative', 'support'];
  const handoffKeywords = bot.handoffKeywords?.length ? bot.handoffKeywords : defaultHandoffKeywords;
  
  if (containsAny(text, handoffKeywords)) {
      console.log("[handleIncomingMessage] Handoff keyword detected");
      await escalateNow(adapters, conversation, "Requested by user via keyword.");
      return;
  }

  // FORCE TRIGGERS from operator cockpit
  const forceTriggers = bot.escalation?.forceTriggers || [];
  if (forceTriggers.length > 0) {
    const triggerMap: Record<string, string[]> = {
      'billing': ['billing', 'invoice', 'payment', 'charge', 'subscription'],
      'refunds': ['refund', 'money back'],
      'angry_customer': ['upset', 'angry', 'terrible', 'awful', 'frustrated'],
      'legal': ['legal', 'lawsuit', 'lawyer'],
      'custom_quote': ['quote', 'pricing', 'enterprise']
    };
    for (const t of forceTriggers) {
      if (containsAny(text, triggerMap[t] || [])) {
        console.log("[handleIncomingMessage] Force trigger detected:", t);
        await escalateNow(adapters, conversation, `Sensitive topic detected: ${t}`);
        return;
      }
    }
  }

  // ---- 3. HYBRID FLOW EXECUTION ----
  if (bot.flow?.nodes?.length) {
    console.log("[handleIncomingMessage] Executing hybrid flow");
    await executeHybridFlow(args);
    return;
  }

  // ---- 4. LEGACY AI FALLBACK ----
  if (bot.aiEnabled !== false) {
    console.log("[handleIncomingMessage] Executing AI phase");
    await executeAiPhase(args);
    return;
  }

  // ---- 5. DEFAULT CLARIFICATION ----
  console.log("[handleIncomingMessage] Default clarification - aiEnabled is false");
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
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
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
        const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
        currentStepId = nextEdge?.target;
      } else {
        return;
      }
    } else {
      const nextEdge = edges.find(e => e.source === currentStepId && (!e.sourceHandle || e.sourceHandle === 'next'));
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

  // 1. Policy-Aware Retrieval Decision
  const isCustomerFacing = bot.type === 'widget';

  const decision = await adapters.retrieveContext({
    message: text,
    hubId: bot.hubId,
    spaceId: conversation.spaceId,
    policy: {
      isCustomerFacing,
      accessLevel: bot.intelligenceAccessLevel || 'topics_allowed',
      allowedLibraryIds: bot.allowedHelpCenterIds || []
    }
  });

  console.log("[executeAiPhase] retrieveContext decision:", {
    confidence: decision.confidence,
    answerMode: decision.answerMode,
    candidatesCount: decision.chosenCandidates?.length,
    candidates: decision.chosenCandidates?.map(c => ({
      title: c.title,
      score: c.score,
      hasUrl: typeof c.url === 'string' && c.url.trim().length > 0,
      url: c.url || null,
    }))
  });

  // 1.5 Apply Confidence Handling Strategy
  const score = decision.confidence;
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  const strategy = bot.confidenceHandling?.[level] || (level === 'low' ? 'clarify' : 'answer');

  if (strategy === 'escalate') {
    await escalateNow(adapters, conversation, "Auto-escalated: match confidence below threshold for direct answer.");
    return true;
  }

  // 2. Adaptive System Instruction
  let systemInstruction = `You are ${botName}, a helpful AI assistant. Be conversational, warm, and accurate.`;
  
  if (decision.answerMode === 'insight_supported_hidden') {
    systemInstruction += `\n\nCRITICAL POLICY: Your answer is based on internal support signals. DO NOT cite sources. Keep the tone helpful but cautious.`;
  } else if (decision.answerMode === 'topic_supported') {
    systemInstruction += `\n\nPOLICY: This information is based on recurring patterns. Avoid presenting it as absolute official policy.`;
  }

  if (strategy === 'answer_softly') {
    systemInstruction += "\n\nCRITICAL: Answer cautiously but confidently. If you aren't fully certain, offer to connect to a human. Do NOT use phrases like 'Based on our documentation' or 'It appears'.";
  }
  
  if (bot.behavior?.revealUncertainty && level !== 'high') {
    systemInstruction += "\n\nPOLITE DISCLOSURE: Be open about your level of certainty if the documentation isn't perfectly clear.";
  }

  if (bot.behavior?.mode === 'sales') {
    systemInstruction += "\n\nSALES POSTURE: Be consultative and focused on value. Move the user towards a meeting or quote.";
  } else if (bot.behavior?.mode === 'support') {
    systemInstruction += "\n\nSUPPORT POSTURE: Be helpful, troubleshooting-focused, and thorough.";
  }

  if (bot.conversationGoal) {
    systemInstruction += `\n\nCONVERSATION GOAL:\n${bot.conversationGoal}`;
  }

  // Business context
  if (bot.businessContext) {
    const bc = bot.businessContext;
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
  if (bot.products?.length) {
    const productLines = bot.products.map((p, i) => {
      let line = `${i + 1}. ${p.name}`;
      if (p.price) line += ` — ${p.price}`;
      if (p.description) line += `\n   Description: ${p.description}`;
      if (p.triggers) line += `\n   Recommend when: ${p.triggers}`;
      return line;
    });
    systemInstruction += `\n\nPRODUCTS & SERVICES:\n${productLines.join('\n')}`;
  }

  // FAQs
  if (bot.faqs?.length) {
    const faqLines = bot.faqs.map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`);
    systemInstruction += `\n\nFREQUENTLY ASKED QUESTIONS:\n${faqLines.join('\n')}`;
  }

  // Objections
  if (bot.objections?.length) {
    const objLines = bot.objections.map((o, i) => `${i + 1}. Objection: ${o.objection}\n   Response: ${o.response}`);
    systemInstruction += `\n\nHOW TO HANDLE OBJECTIONS:\n${objLines.join('\n')}`;
  }

  // Handle empty knowledge case - brief general reply + offer human handoff
  if (decision.chosenCandidates.length === 0) {
    systemInstruction += "\n\nOFF-TOPIC INSTRUCTIONS: The knowledge base has no relevant information for this question. Do the following:\n1. Give a brief, helpful 1-2 sentence reply using general knowledge about the topic.\n2. Then on a new line, add exactly: \"If you'd like, I can connect you with our team!\"\nDo NOT say you don't have information. Do NOT redirect to support scope. Just answer briefly then offer the team connection.";
  }

  // 3. Generate Answer
  const context = decision.chosenCandidates.map(c => ({
    sourceId: c.id,
    sourceType: c.sourceType,
    title: c.title || 'Source',
    text: c.text,
    url: c.url,
  }));
  const aiResult = await adapters.generateAnswer({
      query: text,
      botName: botName,
      context,
      greetingScript: systemInstruction
  });

  const answer = aiResult?.answer || '';

  // AI decided user wants human handoff
  if (aiResult?.requestsHumanHandoff) {
    await escalateNow(adapters, conversation, "User requested human handoff (detected by AI).");
    return true;
  }

  if (!answer || answer.trim() === "") {
      if (decision.answerMode === 'escalate') {
        await escalateNow(adapters, conversation, "No trusted knowledge sources found.");
        return true;
      }
      return false;
  }

  // 4. Persist result with tiered sources
  const selectedSourceIds = new Set(
    (aiResult?.selectedSourceIds || [])
      .map((id) => String(id || '').trim())
      .filter((id) => id.length > 0)
  );

  const persistedSources = aiResult?.showSources
    ? decision.chosenCandidates
        .filter((c) => c.sourceType === 'article' && selectedSourceIds.has(c.id))
        .map((c) => ({ title: c.title || 'Untitled', url: normalizeSourceUrl(c.url), articleId: c.id, score: c.score }))
        .filter((s) => s.url.length > 0)
        .filter((s, index, arr) => arr.findIndex((v) => v.articleId === s.articleId) === index)
        .slice(0, 3)
    : [];

  console.log('[executeAiPhase] persisting sources:', {
    totalCandidates: decision.chosenCandidates.length,
    aiShowSources: !!aiResult?.showSources,
    aiSelectedSourceIds: Array.from(selectedSourceIds),
    persistedSourcesCount: persistedSources.length,
    persistedSourceUrls: persistedSources.map(s => s.url),
  });

  await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: answer,
      responderType: 'ai',
      sources: persistedSources,
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
