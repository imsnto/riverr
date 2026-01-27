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

const IDENTITY_EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

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

function isDecline(text: string) {
  const t = normalize(text);
  if (t === "no" || t === "no." || t === "no thanks" || t === "no thank you") return true;
  return DECLINE_ESCALATION.some((d) => t.includes(normalize(d)));
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
  if (t.includes("how do i") || t.includes("how to") || t.startsWith("help")) return "how_to";
  if (t.includes("doesn't work") || t.includes("not working") || t.includes("error")) return "troubleshooting";

  return "unknown";
}

// -------------------------
// Topic override (article-first)
// -------------------------

const TOPIC_ALIASES: Record<string, string[]> = {
  bins: ["bins", "using bins", "production bins"],
  batching: ["batching items", "batch items", "batching"],
  barcodes: ["barcodes", "printing barcodes", "barcode workflow"],
  "item details": ["item details", "item details page"],
  "hot folder": ["hot folder", "hot folder application"],
  "purchase orders": ["creating purchase orders", "purchase orders"],
};

function detectExplicitTopic(text: string): string | null {
  const t = normalize(text);
  for (const key of Object.keys(TOPIC_ALIASES)) {
    if (t.includes(key)) return key;
  }
  return null;
}

// -------------------------
// Identity capture helpers
// -------------------------

function extractEmail(text: string): string | null {
  const match = (text ?? "").match(IDENTITY_EMAIL_REGEX);
  return match?.[1] ?? null;
}

function extractName(text: string): string | null {
  const t = (text ?? "").trim();
  const patterns = [
    /^i['’]m\s+([A-Za-z][A-Za-z.'-]{1,})/i,
    /^i\s+am\s+([A-Za-z][A-Za-z.'-]{1,})/i,
    /^my\s+name\s+is\s+([A-Za-z][A-Za-z.'-]{1,})/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function needsIdentity(convo: Conversation) {
  return !convo.visitorEmail;
}

// -------------------------
// Rendering helpers
// -------------------------

function brand(bot: BotConfig) {
  return bot.name || "Support";
}

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

function formatAnswerWithSources(answer: string, sources?: ReturnType<typeof buildSources>) {
  if (!sources || sources.length === 0) return answer;

  return [answer.trim(), "", "Sources:", ...sources.map((s) => `- [${s.title}](${s.url})`)].join("\n");
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
  let conversation = args.conversation; // local copy we can refresh via patch assumptions
  const botName = brand(bot);

  // If human assigned or already escalated, AI stays quiet.
  if (conversation.escalated || conversation.state === "human_assigned" || conversation.handoff?.status === "completed") {
    return;
  }

  const text = args.message.text ?? "";
  const intent = inferIntent(text);

  // Persist lastIntent (handy for debugging + UI)
  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: { lastIntent: intent },
  });

  // Opportunistic identity capture
  const maybeEmail = extractEmail(text);
  const maybeName = extractName(text);
  if (maybeEmail || maybeName) {
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: {
        visitorEmail: maybeEmail ?? conversation.visitorEmail ?? null,
        visitorName: maybeName ?? conversation.visitorName ?? null,
      },
    });
    conversation = {
      ...conversation,
      visitorEmail: maybeEmail ?? conversation.visitorEmail ?? null,
      visitorName: maybeName ?? conversation.visitorName ?? null,
    };
  }

  // If a handoff was offered and user declines, mark declined and DO NOT repeat handoff.
  const handoffStatus = conversation.handoff?.status ?? "none";
  if (handoffStatus === "offered" && isDecline(text)) {
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { handoff: { ...(conversation.handoff ?? { status: "none" }), status: "declined" } },
    });

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: `No problem. I’ll stay with you here.\n\nWhat are you trying to do in **${botName}**? If you tell me the screen you’re on and what you expected to happen, I’ll guide you.`,
      meta: { intent, handoff: "declined" },
    });
    return;
  }

  // Greeting
  if (intent === "greeting") {
    const askIdentity = needsIdentity(conversation);
    const reply = askIdentity
      ? `Hey there! 👋 I’m here to help with your **${botName}** questions.\n\nBefore we dive in, what’s your name and email so we can follow up if needed?`
      : `Hey there! 👋 I’m here to help with your **${botName}** questions. What can I help you with today?`;

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: reply,
      meta: { intent },
    });
    return;
  }

  // Explicit human request: escalate (optionally ask for email first)
  if (intent === "human_request") {
    const requireIdentity = bot.requireIdentityBeforeEscalation ?? true;
    if (requireIdentity && needsIdentity(conversation)) {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: {
          handoff: { status: "offered", reason: "User requested human", offeredAt: new Date().toISOString() },
        },
      });

      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: `Totally. Before I connect you with the **${botName}** team, what’s the best email to reach you?`,
        meta: { intent, handoff: "offered" },
      });
      return;
    }

    await doEscalate(adapters, conversation, "User requested a human");
    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: `Got it. I’m connecting you with someone from the **${botName}** team now.`,
      meta: { intent, handoff: "completed" },
    });
    return;
  }

  // HARD escalation triggers (billing / upset)
  // Key fix: If user previously declined (handoffStatus === "declined"), do NOT re-offer.
  const handoffDeclined = handoffStatus === "declined";
  if (!handoffDeclined && (intent === "billing" || intent === "upset")) {
    const requireIdentity = bot.requireIdentityBeforeEscalation ?? true;
    const shouldForceBilling = bot.forceImmediateEscalationOnBilling ?? true;
    const shouldForceUpset = bot.forceImmediateEscalationOnUpset ?? false;

    const reason = intent === "billing" ? "Billing-related issue" : "Upset/frustrated user";

    // Offer (or force) handoff
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { handoff: { status: "offered", reason, offeredAt: new Date().toISOString() } },
    });

    if (requireIdentity && needsIdentity(conversation)) {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text:
          intent === "billing"
            ? `This looks billing-related, so I want a teammate to handle it.\n\nWhat’s the best email for the **${botName}** team to reach you?`
            : `I’m sorry this has been frustrating. I can bring in someone from the **${botName}** team.\n\nWhat’s the best email to reach you?`,
        meta: { intent, handoff: "offered" },
      });
      return;
    }

    // If forcing escalation, do it now. Otherwise offer and wait for user choice.
    if ((intent === "billing" && shouldForceBilling) || (intent === "upset" && shouldForceUpset)) {
      await doEscalate(adapters, conversation, reason);
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: `I’m going to connect you with someone from the **${botName}** team now.`,
        meta: { intent, handoff: "completed" },
      });
      return;
    }

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text:
        intent === "billing"
          ? `This looks billing-related. I can connect you with someone from the **${botName}** team.\n\nIf you’d prefer I keep helping here, just reply “no”.`
          : `I’m sorry this has been frustrating. I can connect you with someone from the **${botName}** team.\n\nIf you’d prefer I keep helping here, just reply “no”.`,
      meta: { intent, handoff: "offered" },
    });
    return;
  }

  // Topic override (bins, etc.)
  const explicitTopic = detectExplicitTopic(text);

  // Retrieval query: expanded for explicit topics
  const expandedQuery = explicitTopic ? TOPIC_ALIASES[explicitTopic].join(" OR ") : text;

  // Search attempt #1
  const search1 = await adapters.searchHelpCenter({
    hubId: bot.hubId,
    allowedHelpCenterIds: bot.allowedHelpCenterIds,
    userId: conversation.userId ?? null,
    query: expandedQuery,
    topK: 10,
  });

  let chunks = search1.chunks ?? [];
  let sources = buildSources(chunks, 3);

  // Search attempt #2 (explicit topic raw keyword) if topic present but results weak
  if (explicitTopic && sources.length === 0) {
    const search2 = await adapters.searchHelpCenter({
      hubId: bot.hubId,
      allowedHelpCenterIds: bot.allowedHelpCenterIds,
      userId: conversation.userId ?? null,
      query: explicitTopic, // raw keyword retry
      topK: 10,
    });
    chunks = search2.chunks ?? chunks;
    sources = buildSources(chunks, 3);
  }

  const topScore = chunks.length ? Math.max(...chunks.map((c) => c.score)) : 0;

  const HIGH = 0.78;
  const MED = 0.55;

  // If explicit topic and ANY sources exist, answer (even medium)
  const mustAnswerFromDocs = Boolean(explicitTopic) && sources.length > 0;

  if (mustAnswerFromDocs || topScore >= HIGH) {
    const answer = synthesizeFromChunks({
      botName,
      userText: text,
      chunks,
      explicitTopic,
    });

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: formatAnswerWithSources(answer, sources),
      sources,
      meta: { intent, topScore, explicitTopic: explicitTopic ?? null },
    });
    return;
  }

  if (topScore >= MED) {
    const answer = generalHelpfulAnswer({ botName, userText: text });
    const out =
      bot.allowAIWithoutSources ?? true
        ? formatAnswerWithSources(answer, sources)
        : sources.length
          ? formatAnswerWithSources(answer, sources)
          : answer;

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: out,
      sources,
      meta: { intent, topScore },
    });
    return;
  }

  // Low relevance fallback (never mention search failure)
  await adapters.persistAssistantMessage({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    text: lowConfidencePivot({ botName, intent }),
    meta: { intent, topScore },
  });
}

// -------------------------
// Escalation helper
// -------------------------

async function doEscalate(adapters: AgentAdapters, conversation: Conversation, reason: string) {
  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: {
      escalated: true,
      escalationReason: reason,
      handoff: { status: "completed", reason, offeredAt: conversation.handoff?.offeredAt },
      state: "human_assigned",
    },
  });

  await adapters.escalateToHuman({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    reason,
  });
}

// -------------------------
// Answer helpers
// -------------------------

function synthesizeFromChunks(args: {
  botName: string;
  userText: string;
  chunks: HelpChunk[];
  explicitTopic: string | null;
}) {
  const { botName, chunks, explicitTopic } = args;

  const best = [...chunks].sort((a, b) => b.score - a.score).slice(0, 3);
  const bullets = best
    .map((c) => c.chunkText)
    .join("\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length < 160)
    .slice(0, 6);

  const topic = explicitTopic ? `**${explicitTopic}**` : "that";
  const lines: string[] = [`Sure, here’s what you need to know about ${topic} in **${botName}**:`];

  if (bullets.length) {
    lines.push("");
    lines.push("Key points:");
    for (const b of bullets) {
      const cleaned = b.replace(/^[-•]\s*/, "");
      lines.push(`- ${cleaned}`);
    }
  } else {
    lines.push("");
    lines.push(`Tell me what screen you’re on in **${botName}** and what you’re trying to do, and I’ll give exact steps.`);
  }

  if (!explicitTopic) {
    lines.push("");
    lines.push(`Quick question: what are you trying to accomplish in **${botName}**?`);
  }

  return lines.join("\n");
}

function generalHelpfulAnswer(args: { botName: string; userText: string }) {
  const { botName, userText } = args;
  const q = normalize(userText);

  let steps: string[] = [];
  if (q.includes("upload") && (q.includes("image") || q.includes("photo") || q.includes("png") || q.includes("jpg"))) {
    steps = [
      `Go to the area you’re working in (Products, Items, or the Customizer).`,
      `Look for an “Upload” or image section and add the file.`,
      `If it fails, tell me the file type/size and what screen you’re on.`,
    ];
  } else if (q.includes("integrat") || q.includes("shopify") || q.includes("etsy")) {
    steps = [
      `Open **Integrations** in **${botName}**.`,
      `Select your platform and follow the connect steps.`,
      `Tell me which platform and I’ll give the exact steps.`,
    ];
  } else {
    steps = [
      `Tell me what screen you’re on and what you expected to happen.`,
      `If there’s an error message, paste it here.`,
    ];
  }

  return [
    `I can help with that in **${botName}**.`,
    "",
    "Steps:",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Quick question: where are you doing this in **${botName}** (Products, Orders, or Production)?`,
  ].join("\n");
}

function lowConfidencePivot(args: { botName: string; intent: Intent }) {
  const { botName, intent } = args;

  if (intent === "account_specific") {
    return `I can help with that in **${botName}**, but I need one detail so I don’t point you the wrong way.\n\nAre you trying to check an order, tracking, invoice, or subscription?`;
  }

  return `Got it. I can help with that in **${botName}**.\n\nWhat screen are you on right now, and what were you trying to do when it didn’t work?`;
}
