/**
 * agent.ts (CLEANUP UPGRADE)
 *
 * Standardizes the response pipeline: Automation -> AI -> Human
 */

import type { Conversation as ImportedConversation, SupportIntentNode, ConversationStatus, ResponderType } from "./data";

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  hubId: string;
  name: string;
  allowedHelpCenterIds: string[];
  aiEnabled?: boolean; // New: Master toggle for AI phase
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
    [key: string]: any;
  };
};

export interface IncomingMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string; // ISO
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

  // ---- 2. AUTOMATION CHECK: HANDOFF RESPONSE ----
  if (conversation.handoff?.status === "offered") {
    const isAffirmative = containsAny(text, ["yes", "ok", "please", "sure", "that would be great", "yep", "alright"]);
    const isNegative = containsAny(text, ["no", "nope", "not yet", "stop", "just answer", "i said no", "answer me", "it's ok", "that's ok", "im good", "i'm good"]);

    if (isAffirmative) {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: { status: 'waiting_human', lastResponderType: 'system' }
      });
      await adapters.escalateToHuman({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        reason: "User accepted handoff offer.",
      });
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: `A support ticket has been created. Our team will respond shortly.`,
        responderType: 'automation',
        meta: { handoff: "completed" },
      });
      return;
    }

    if (isNegative) {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: {
          handoff: { status: "declined", reason: conversation.handoff.reason },
          status: 'automated'
        },
      });
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: `Ok, sounds good. How else can I help?`,
        responderType: 'automation',
        meta: { handoff: "declined" },
      });
      return;
    }
  }

  // ---- 3. AUTOMATION CHECK: PLAYBOOKS ----
  const activePlaybookInfo = conversation.meta?.activePlaybook;
  if (activePlaybookInfo?.content) {
    const playbookContent = activePlaybookInfo.content;
    const currentStepIndex = activePlaybookInfo.currentStep;
    const userMessage = (text ?? "").trim().toLowerCase();
    const confirmationKeywords = ['ok', 'done', 'next', 'yes', 'yep', 'alright'];

    if (confirmationKeywords.includes(userMessage)) {
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < playbookContent.steps.length) {
        const nextStep = playbookContent.steps[nextStepIndex];
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: `Great. The next step is: ${nextStep.description}`,
          responderType: 'automation',
          meta: { playbook: playbookContent.intent, step: nextStepIndex, fromPlaybook: true }
        });

        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: {
            status: 'automated',
            meta: {
              ...conversation.meta,
              activePlaybook: { ...activePlaybookInfo, currentStep: nextStepIndex },
            }
          }
        });
        return;
      } else {
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: `Awesome! You've completed all the steps. Is there anything else I can help with?`,
          responderType: 'automation',
          meta: { playbook: playbookContent.intent, step: 'completed' }
        });

        const newMeta = { ...conversation.meta };
        delete newMeta.activePlaybook;
        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: { meta: newMeta, status: 'automated' }
        });
        return;
      }
    }
  }

  // ---- 4. AI HANDLING (IF ENABLED) ----
  if (bot.aiEnabled !== false) {
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
            text += "\nSteps:\n";
            steps.forEach((s, i) => { text += `${i + 1}. ${s}\n`; });
        } else {
            text += "\nSummary:\n";
            best.forEach(c => { text += `- ${c.chunkText.slice(0, 140)}...\n`; });
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
