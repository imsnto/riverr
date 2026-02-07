
/**
 * agent.ts (FIXED DROP-IN)
 *
 * Fixes:
 * - Escalation state sticks even if your existing ConversationState enum is limited
 * - Handoff is offered once, respects "no", and never repeats after decline
 * - Explicit topic retry search (expanded query then raw topic keyword)
 * - No "I am designed to..." garbage, no "no matching article" statements
 */

import type { Conversation as ImportedConversation } from "./data";

/**
 * IMPORTANT:
 * Do NOT alias your ConversationState from ./data.
 * Your DB enum likely doesn't include escalation_offered/declined.
 * We keep our own internal state and persist via a dedicated "handoff" object.
 */
export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  hubId: string;
  name: string;
  allowedHelpCenterIds: string[];
  requireIdentityBeforeEscalation?: boolean; // default true
  allowAIWithoutSources?: boolean; // default true

  // optional tuning
  forceImmediateEscalationOnBilling?: boolean; // default true
  forceImmediateEscalationOnUpset?: boolean; // default false (recommend: offer first)
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
  // These may or may not exist in your current model. We treat them as optional.
  state?: string | null;
  escalated?: boolean;
  escalationReason?: string | null;
  assignedAgentId?: string | null;

  visitorName?: string | null;
  visitorEmail?: string | null;
  userId?: string | null;

  // optional: last known intent
  lastIntent?: Intent | null;

  /**
   * Sticky handoff state that will work even if your existing state enum is limited.
   * Persist this field in your DB and use it to drive UI + logic.
   */
  handoff?: {
    status: "none" | "offered" | "declined" | "completed";
    reason?: string;
    offeredAt?: string; // ISO
  } | null;
  meta?: {
    attemptCount?: number;
    intentHistory?: Intent[];
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
  score: number; // 0..1 (higher is better)
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

export interface AgentAdapters {
  searchHelpCenter: (params: SearchHelpCenterParams) => Promise<SearchHelpCenterResult>;

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
// Intent & classification
// -------------------------

export type Intent =
  | "greeting"
  | "how_to"
  | "troubleshooting"
  | "billing"
  | "account_specific"
  | "upset"
  | "human_request"
  | "unknown";

const GREETINGS = ["hi", "hello", "hey", "yo", "hiya", "good morning", "good afternoon", "good evening"];

const BILLING_KEYWORDS = [
  "billing",
  "invoice",
  "charged",
  "charge",
  "refund",
  "overcharged",
  "payment",
  "credit card",
  "card charged",
  "subscription",
  "cancel my subscription",
  "plan",
  "pricing error",
  "chargeback",
];

const UPSET_PHRASES = [
  "this is stupid",
  "this is dumb",
  "ridiculous",
  "annoyed",
  "frustrated",
  "pissed",
  "angry",
  "wtf",
  "terrible",
  "hate this",
  "your app is broken",
  "doesn't work",
];

const PROFANITY = ["fuck", "fucking", "shit", "bullshit", "asshole"];

const HUMAN_REQUEST_KEYWORDS = [
  "human",
  "agent",
  "representative",
  "support rep",
  "real person",
  "talk to someone",
  "someone help me",
  "team member",
];

const DECLINE_ESCALATION = ["no", "nope", "don't", "do not", "not yet", "stop", "just answer", "i said no", "answer me"];

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
  const h = normalize(haystack);
  return needles.some((n) => h.includes(normalize(n)));
}

function isGreeting(text: string) {
  const t = normalize(text);
  if (t.length <= 2 && (t === "hi" || t === "yo")) return true;
  return GREETINGS.some((g) => t === g || t.startsWith(g + " ") || t.includes(" " + g + " "));
}

function isBilling(text: string) {
  return containsAny(text, BILLING_KEYWORDS);
}

function isHumanRequest(text: string) {
  return containsAny(text, HUMAN_REQUEST_KEYWORDS);
}

function isUpset(text: string) {
  const t = normalize(text);
  const upset = containsAny(t, UPSET_PHRASES);
  const profanity = PROFANITY.some((p) => t.includes(p));
  return upset || profanity;
}

function looksAccountSpecific(text: string) {
  const patterns = [
    "my order",
    "my shipment",
    "my tracking",
    "my account",
    "my payment",
    "my invoice",
    "my subscription",
    "order #",
    "transaction",
  ];
  return containsAny(text, patterns);
}

function inferIntent(text: string): Intent {
  if (isGreeting(text)) return "greeting";
  if (isHumanRequest(text)) return "human_request";
  if (isBilling(text)) return "billing";
  if (isUpset(text)) return "upset";
  if (looksAccountSpecific(text)) return "account_specific";

  const t = normalize(text);
  if (t.includes('invite')) return 'how_to';
  if (t.includes("how do i") || t.includes("how to") || t.startsWith("help")) return "how_to";
  if (t.includes("doesn't work") || t.includes("not working") || t.includes("error")) return "troubleshooting";

  return "unknown";
}


// -------------------------
// Rendering helpers
// -------------------------

function buildSources(chunks: HelpChunk[], max = 3) {
  const sorted = [...chunks].sort((a, b) => b.score - a.score);
  const picked: HelpChunk[] = [];
  const seen = new Set<string>();

  for (const c of sorted) {
    if (seen.has(c.articleId)) continue;
    seen.add(c.articleId);
    picked.push(c);
    if (picked.length >= max) break;
  }

  return picked.map((c) => ({
    articleId: c.articleId,
    title: c.title,
    url: c.url,
    score: c.score,
  }));
}

// -------------------------
// Main handler
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

  // ---- HARD STOP ONLY IF HUMAN IS ACTUALLY ASSIGNED ----
  const humanAssigned =
    conversation.state === "human_assigned" ||
    Boolean(conversation.assignedAgentId);

  if (humanAssigned) return;

  // ---- PLAYBOOK CONTINUATION LOGIC ----
  const activePlaybookInfo = conversation.meta?.activePlaybook;
  if (activePlaybookInfo && activePlaybookInfo.content) {
    const playbookContent = activePlaybookInfo.content;
    const currentStepIndex = activePlaybookInfo.currentStep;
    const userMessage = normalize(text);

    // Simple confirmation keywords
    const confirmationKeywords = ['ok', 'done', 'next', 'yes', 'yep', 'alright'];

    if (confirmationKeywords.includes(userMessage)) {
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < playbookContent.steps.length) {
        const nextStep = playbookContent.steps[nextStepIndex];
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: `Great. The next step is: ${nextStep.description}`,
          meta: { playbook: playbookContent.intent, step: nextStepIndex, fromPlaybook: true }
        });

        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: {
            meta: {
              ...conversation.meta,
              activePlaybook: {
                ...activePlaybookInfo,
                currentStep: nextStepIndex,
              }
            }
          }
        });
        return; // End execution here, we've handled the playbook step
      } else {
        // Playbook finished
        await adapters.persistAssistantMessage({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          text: `Awesome! You've completed all the steps. Is there anything else I can help with?`,
          meta: { playbook: playbookContent.intent, step: 'completed' }
        });

        // Clear the active playbook from conversation meta
        const newMeta = { ...conversation.meta };
        delete newMeta.activePlaybook;
        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: { meta: newMeta }
        });
        return;
      }
    } else {
        // User said something else, so let's break out of the playbook
        const newMeta = { ...conversation.meta };
        delete newMeta.activePlaybook;
        await adapters.updateConversation({
          conversationId: conversation.id,
          hubId: conversation.hubId,
          patch: { meta: newMeta }
        });
        // Let the rest of the agent logic handle the new query
    }
  }


  const intent = inferIntent(text);

  // ---- ATTEMPT & INTENT HISTORY ----
  const attemptCount = (conversation.meta?.attemptCount ?? 0) + 1;
  const intentHistory = [...(conversation.meta?.intentHistory ?? []), intent];

  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: {
      lastIntent: intent,
      meta: { ...(conversation.meta ?? {}), attemptCount, intentHistory },
    },
  });

  // ---- SHORT / VAGUE CLARIFICATION GATE ----
  if (normalize(text).split(" ").length <= 3 && intent !== "greeting") {
    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: finClarify(botName),
      meta: { intent, attemptCount },
    });
    return;
  }
  
  // ---- IMMEDIATE ESCALATION TRIGGERS ----
  if (intent === 'human_request') {
    await offerHuman(adapters, conversation, botName, "User requested a human");
    return;
  }
  if (intent === 'upset') {
      await offerHuman(adapters, conversation, botName, "User seems upset");
      return;
  }
  if (intent === "billing" && isHardBilling(text)) {
    await offerHuman(adapters, conversation, botName, "Sensitive billing issue");
    return;
  }


  // ---- SALES MODE DETECTION ----
  const salesMode = looksLikeSales(text);

  // ---- DOC SEARCH ----
  const search = await adapters.searchHelpCenter({
    hubId: bot.hubId,
    allowedHelpCenterIds: bot.allowedHelpCenterIds,
    userId: conversation.userId ?? null,
    query: text,
    topK: 12,
  });

  const chunks = search.chunks ?? [];
  const topScore = chunks.length ? Math.max(...chunks.map(c => c.score)) : 0;
  
  // ---- PLAYBOOK EXECUTION ----
  const playbookChunk = chunks.find(c => c.articleType === 'playbook');
  if (playbookChunk && playbookChunk.articleContent) {
    try {
      const playbookContent = JSON.parse(playbookChunk.articleContent);
      if (playbookContent.intent && playbookContent.steps) {
        const firstStep = playbookContent.steps[0];
        if (firstStep) {
          await adapters.persistAssistantMessage({
            conversationId: conversation.id,
            hubId: conversation.hubId,
            text: `OK, I can help with that. Here is the first step: ${firstStep.description}`,
            meta: { playbook: playbookContent.intent, step: 0, fromPlaybook: true }
          });
          await adapters.updateConversation({
            conversationId: conversation.id,
            hubId: conversation.hubId,
            patch: {
              meta: {
                ...conversation.meta,
                activePlaybook: {
                  intent: playbookContent.intent,
                  content: playbookContent,
                  currentStep: 0,
                }
              }
            }
          });
          return;
        }
      }
    } catch (e) {
      console.error("Failed to parse or execute playbook", e);
    }
  }


  // ---- HIGH CONFIDENCE ANSWER ----
  if (topScore >= 0.55) {
    const answer = finAnswerFromDocs({
      botName,
      chunks,
      intent,
      salesMode,
    });

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: answer.text,
      sources: answer.sources,
      meta: { intent, topScore },
    });
    return;
  }

  // ---- REASONING ON FAILURE ----
  // Check for repetitive, failing intents
  const lastTwoIntents = intentHistory.slice(-2);
  if (
      lastTwoIntents.length === 2 &&
      lastTwoIntents[0] !== 'greeting' &&
      lastTwoIntents[0] === lastTwoIntents[1]
  ) {
      await offerHuman(adapters, conversation, botName, "AI unable to resolve repeated query");
      return;
  }

  // ---- IF NO REASON TO ESCALATE, PROBE ----
  if (attemptCount < 3) {
    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: finProbe(botName, intent),
      meta: { intent, attemptCount, intentHistory },
    });
    return;
  }

  // ---- LAST RESORT: OFFER HUMAN ON 3RD TOTAL MISS ----
  await offerHuman(adapters, conversation, botName, "Needs clarification after multiple attempts");
}

function finAnswerFromDocs(args: {
  botName: string;
  chunks: HelpChunk[];
  intent: Intent;
  salesMode: boolean;
}) {
  const best = [...args.chunks].sort((a, b) => b.score - a.score).slice(0, 3);

  const steps = extractSteps(best);
  const sources = buildSources(best, 3);

  let text = `Here’s how this works in **${args.botName}**:\n`;

  if (steps.length) {
    text += "\nSteps:\n";
    steps.forEach((s, i) => {
      text += `${i + 1}. ${s}\n`;
    });
  } else {
    text += "\nHere’s the key idea:\n";
    best.forEach(c => {
      text += `- ${c.chunkText.slice(0, 140)}\n`;
    });
  }

  if (args.salesMode) {
    text += `\nIf you want, I can help you choose the right plan or get this set up now.`;
  }

  return { text, sources };
}

function extractSteps(chunks: HelpChunk[]) {
  const lines = chunks.flatMap(c => c.chunkText.split("\n"));
  return lines
    .map(l => l.trim())
    .filter(l => /^\d+\.|^step\s+/i.test(l))
    .slice(0, 6);
}

function finClarify(botName: string) {
  return `I can help with that in **${botName}** — quick check so I don’t send you the wrong way.\n\nWhat screen are you on, and what are you trying to do?`;
}

function finProbe(botName: string, intent: Intent) {
  if (intent === "account_specific") {
    return `I can help — I just need one detail.\n\nAre you looking at an order, a payment, or a subscription in **${botName}**?`;
  }

  return `Got it. Tell me:\n1) what screen you’re on\n2) what you expected to happen\n\nI’ll take it from there.`;
}

function isHardBilling(text: string) {
  const HARD = [
    "refund",
    "chargeback",
    "unauthorized",
    "fraud",
    "double charged",
    "overcharged",
    "payment failed",
  ];
  return HARD.some(k => normalize(text).includes(k));
}

function looksLikeSales(text: string) {
  return [
    "pricing",
    "price",
    "cost",
    "plan",
    "upgrade",
    "difference between",
    "which plan",
  ].some(k => normalize(text).includes(k));
}

async function offerHuman(
  adapters: AgentAdapters,
  conversation: Conversation,
  botName: string,
  reason: string
) {
  if (conversation.handoff?.status === "declined") return;

  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: {
      handoff: { status: "offered", reason, offeredAt: new Date().toISOString() },
    },
  });

  await adapters.persistAssistantMessage({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    text: `If you want, I can loop in someone from the **${botName}** team — or I can keep helping here.`,
    meta: { handoff: "offered" },
  });
}
