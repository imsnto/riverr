/**
 * agent.ts (DROP-IN)
 * Brand-aware support agent with:
 * - Greeting handling (never dumb refusal)
 * - Help center RAG (semantic search)
 * - Escalation state machine (offer once, respect "no")
 * - Billing + upset immediate escalation
 * - Article-topic override (e.g., "bins" MUST answer if docs exist)
 * - Optional identity capture (name/email) at chat start
 *
 * You wire this into your existing inbox pipeline:
 * - Call handleIncomingMessage(...) whenever a visitor sends a message
 * - Persist returned updates to your DB (conversation state, visitor info, messages)
 *
 * NOTE: This file intentionally has small "adapter" interfaces you implement:
 *   - searchHelpCenter(query, filters) -> returns chunks + article metadata
 *   - getArticleById(articleId) -> optional
 *   - escalateToHuman(...) -> assigns conversation to human queue
 *   - persistMessage(...) -> writes assistant messages
 */

import type { ConversationState as ImportedConversationState, Conversation as ImportedConversation } from './data';

export type ConversationState = ImportedConversationState;

export type MessageRole = "user" | "assistant" | "internal";

export interface BotConfig {
  id: string;
  hubId: string;
  name: string; // e.g., "Riverr Help" or "Joe's Pizza Help"
  allowedHelpCenterIds: string[];
  // optional tuning:
  requireIdentityBeforeEscalation?: boolean; // default true
  allowAIWithoutSources?: boolean; // default true
}

export type Conversation = ImportedConversation;


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
  /**
   * Semantic search over your indexed help center chunks.
   * MUST filter by hubId and allowedHelpCenterIds inside this function.
   */
  searchHelpCenter: (params: SearchHelpCenterParams) => Promise<SearchHelpCenterResult>;

  /**
   * Escalation hook to your inbox queue / ticketing system.
   * Should set assigned agent/queue, mark conversation as human_assigned in your DB, etc.
   */
  escalateToHuman: (args: {
    conversationId: string;
    hubId: string;
    reason: string;
    transcriptHint?: string;
  }) => Promise<void>;

  /**
   * Persist the assistant message to your DB/inbox.
   */
  persistAssistantMessage: (args: {
    conversationId: string;
    hubId: string;
    text: string;
    sources?: Array<{ title: string; url: string; articleId: string; score: number }>;
    meta?: Record<string, unknown>;
  }) => Promise<void>;

  /**
   * Persist any conversation updates (state, visitor identity).
   * Make this an atomic patch in your DB.
   */
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

const GREETINGS = [
  "hi",
  "hello",
  "hey",
  "yo",
  "hiya",
  "good morning",
  "good afternoon",
  "good evening",
];

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

const DECLINE_ESCALATION = [
  "no",
  "nope",
  "don't",
  "do not",
  "not yet",
  "stop",
  "just answer",
  "i said no",
  "answer me",
];

const IDENTITY_EMAIL_REGEX =
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

function normalize(s: string) {
  return s.trim().toLowerCase();
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
  // Treat directed profanity or high frustration as upset
  return upset || profanity;
}

function isDecline(text: string) {
  const t = normalize(text);
  // if user types only "no" or "no." or "no thanks", etc.
  if (t === "no" || t === "no." || t === "no thanks" || t === "no thank you") return true;
  return DECLINE_ESCALATION.some((d) => t.includes(normalize(d)));
}

function looksAccountSpecific(text: string) {
  // You can customize this list for your product.
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

  // Heuristic: "how do i", "help", "can't", etc.
  const t = normalize(text);
  if (t.includes("how do i") || t.includes("how to") || t.startsWith("help")) return "how_to";
  if (t.includes("doesn't work") || t.includes("not working") || t.includes("error")) return "troubleshooting";

  return "unknown";
}

// -------------------------
// Topic override (article-first)
// -------------------------

/**
 * Optional: known topic aliases -> query expansions
 * Add your product’s common nouns here.
 */
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
  const match = text.match(IDENTITY_EMAIL_REGEX);
  return match?.[1] ?? null;
}

/**
 * Very light name guess: if user says "I'm Brad" / "I am Brad" / "My name is Brad"
 */
function extractName(text: string): string | null {
  const t = text.trim();
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
  return !convo.visitorEmail; // email is the key for follow-up
}

// -------------------------
// Response rendering helpers
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

  const lines = [
    answer.trim(),
    "",
    "Sources:",
    ...sources.map((s) => `- ${s.title} — ${s.url}`),
  ];
  return lines.join("\n");
}

// -------------------------
// Main handler
// -------------------------

export async function handleIncomingMessage(args: {
  bot: BotConfig;
  conversation: Conversation;
  message: IncomingMessage; // user message
  adapters: AgentAdapters;
}) {
  const { bot, conversation, message, adapters } = args;
  const botName = brand(bot);

  // If human already assigned, do nothing (AI must be quiet)
  if (conversation.state === "human_assigned" || conversation.escalated) {
    return;
  }

  const text = message.text ?? "";
  const intent = inferIntent(text);
  await adapters.updateConversation({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    patch: { lastIntent: intent },
  });

  // If user declined escalation recently, lock it out unless they explicitly request a human
  const escalationLocked =
    conversation.state === "escalation_declined" && intent !== "human_request";

  // Capture identity opportunistically (user might paste email in any message)
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
  }

  // 1) Greetings should NEVER escalate and NEVER search-refuse
  if (intent === "greeting") {
    const askIdentity = needsIdentity(conversation);
    const reply = askIdentity
      ? `Hey there! 👋 I’m here to help with your **${botName}** questions.\n\nBefore we dive in, what’s your name and email so we can follow up if needed?`
      : `Hey there! 👋 I’m here to help with your **${botName}** questions. What can I help you with today?`;

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: reply,
    });
    return;
  }

  // 2) If user explicitly requests a human, escalate (unless you want identity first)
  if (intent === "human_request") {
    // optional: identity gate before escalation
    const requireIdentity = bot.requireIdentityBeforeEscalation ?? true;
    const convoNeedsIdentity = needsIdentity(conversation);
    if (requireIdentity && convoNeedsIdentity) {
      await adapters.persistAssistantMessage({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        text: `Totally. Before I connect you with the **${botName}** team, what’s the best email to reach you?`,
      });
      // Offer escalation but wait for email
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: { state: "escalation_offered" },
      });
      return;
    }

    await doEscalate(adapters, conversation, `User requested a human`);
    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: `Got it. I’m connecting you with someone from the **${botName}** team now.`,
    });
    return;
  }

  // 3) If escalation was offered and user says "no", lock escalation and try to help
  if (conversation.state === "escalation_offered" && isDecline(text)) {
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { state: "escalation_declined" },
    });

    // Immediately pivot to help (no repeats)
    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: `No problem. I’ll stay with you here.\n\nWhat are you trying to do in **${botName}**? If you tell me the screen you’re on or what you expected to happen, I can guide you.`,
    });
    return;
  }

  // 4) Hard escalation triggers (billing/upset) — but respect escalation lock if user said no
  if (!escalationLocked && (intent === "billing" || intent === "upset")) {
    // Offer escalation ONCE (don’t force)
    await adapters.updateConversation({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      patch: { state: "escalation_offered" },
    });

    const askIdentityFirst =
      (bot.requireIdentityBeforeEscalation ?? true) && needsIdentity(conversation);

    const msg = intent === "billing"
      ? (askIdentityFirst
          ? `This looks billing-related, so I want a teammate to handle it.\n\nWhat’s your email so the **${botName}** team can reach you?`
          : `This looks billing-related, so I’m going to connect you with someone from the **${botName}** team. If you’d rather I keep trying here, just say “no”.`)
      : (askIdentityFirst
          ? `I’m sorry this has been frustrating. Let me bring in someone from the **${botName}** team.\n\nWhat’s your email so we can follow up?`
          : `I’m sorry this has been frustrating. I can connect you with someone from the **${botName}** team. If you’d rather I keep trying here, just say “no”.`);

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: msg,
    });

    // Only auto-escalate if you want; recommended: wait for confirmation OR email.
    // If you DO want immediate escalation for billing/upset, uncomment:
    // await doEscalate(adapters, conversation, intent === "billing" ? "Billing issue" : "Upset user");
    return;
  }

  // 5) Topic override: if user mentions known topic (e.g., bins), force doc search + answer
  const explicitTopic = detectExplicitTopic(text);
  const query = explicitTopic
    ? TOPIC_ALIASES[explicitTopic].join(" OR ")
    : text;

  // 6) Retrieve help chunks (semantic)
  const search = await adapters.searchHelpCenter({
    hubId: bot.hubId,
    allowedHelpCenterIds: bot.allowedHelpCenterIds,
    userId: conversation.userId ?? null,
    query,
    topK: 8,
  });

  const chunks = search.chunks ?? [];
  const topScore = chunks.length ? Math.max(...chunks.map((c) => c.score)) : 0;

  const sources = buildSources(chunks, 3);

  // 7) Decide answer strategy
  // Confidence thresholds
  const HIGH = 0.78;
  const MED = 0.55;

  // If explicit topic and we have ANY relevant doc, answer even if score is medium
  const mustAnswerFromDocs = Boolean(explicitTopic) && sources.length > 0;

  // If we found strong docs, answer with doc-grounded summary
  if (mustAnswerFromDocs || topScore >= HIGH) {
    const answer = synthesizeFromChunks({
      botName,
      userText: text,
      chunks,
      sources,
      explicitTopic,
    });

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: formatAnswerWithSources(answer, sources),
      sources,
      meta: { intent, topScore, explicitTopic: explicitTopic ?? null },
    });

    // If we were in escalation_offered state and user pivoted to a doc topic, clear it
    if (conversation.state === "escalation_offered") {
      await adapters.updateConversation({
        conversationId: conversation.id,
        hubId: conversation.hubId,
        patch: { state: "ai_active" },
      });
    }
    return;
  }

  // If medium relevance: provide helpful general guidance + 1 clarification question + optional sources
  if (topScore >= MED) {
    const answer = generalHelpfulAnswer({
      botName,
      userText: text,
      sources,
    });

    const withSources =
      bot.allowAIWithoutSources ?? true
        ? formatAnswerWithSources(answer, sources)
        : (sources.length ? formatAnswerWithSources(answer, sources) : answer);

    await adapters.persistAssistantMessage({
      conversationId: conversation.id,
      hubId: conversation.hubId,
      text: withSources,
      sources,
      meta: { intent, topScore },
    });
    return;
  }

  // Low relevance: DO NOT say "no article found".
  // Give best-effort guidance + ask one clarifying question.
  const fallback = lowConfidencePivot({
    botName,
    userText: text,
    intent,
  });

  await adapters.persistAssistantMessage({
    conversationId: conversation.id,
    hubId: conversation.hubId,
    text: fallback,
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
// Answer synthesis helpers
// -------------------------

function synthesizeFromChunks(args: {
  botName: string;
  userText: string;
  chunks: HelpChunk[];
  sources: Array<{ title: string; url: string; articleId: string; score: number }>;
  explicitTopic: string | null;
}) {
  const { botName, userText, chunks, explicitTopic } = args;

  // Keep it short and helpful. Don’t paste huge chunks. Summarize.
  // This is deliberately heuristic so it works without an LLM.
  // If you want, replace this with a real LLM call using chunks as context.

  const best = [...chunks].sort((a, b) => b.score - a.score).slice(0, 3);
  const bullets = best
    .map((c) => c.chunkText)
    .join("\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length < 140)
    .slice(0, 5);

  const topic = explicitTopic ? `**${explicitTopic}**` : "this";
  const intro = `Sure, here’s what you need to know about ${topic} in **${botName}**:`;

  const answerLines = [intro];

  if (bullets.length) {
    answerLines.push("");
    answerLines.push("Key points:");
    for (const b of bullets) {
      // normalize bullet formatting
      const cleaned = b.replace(/^[-•]\s*/, "");
      answerLines.push(`- ${cleaned}`);
    }
  } else {
    answerLines.push("");
    answerLines.push(
      `Tell me what screen you’re on and what you’re trying to do, and I’ll give you the exact steps.`
    );
  }

  // Ask a clarifier at the end (only if needed)
  if (!explicitTopic) {
    answerLines.push("");
    answerLines.push(`Quick question: are you trying to accomplish in **${botName}**?`);
  }

  return answerLines.join("\n");
}

function generalHelpfulAnswer(args: {
  botName: string;
  userText: string;
  sources: Array<{ title: string; url: string; articleId: string; score: number }>;
}) {
  const { botName, userText, sources } = args;

  const intro = `I can help with that in **${botName}**.`;
  const hint = sources.length
    ? `I found a couple related guides. Here’s the quickest path based on what you said:`
    : `Here’s the quickest path based on what you said:`;

  const q = normalize(userText);

  // A few generic “helpful” patterns you can expand over time:
  let steps: string[] = [];
  if (q.includes("upload") && (q.includes("image") || q.includes("photo") || q.includes("png") || q.includes("jpg"))) {
    steps = [
      `Go to the area you’re working in (Products, Items, or the Customizer).`,
      `Look for an “Upload” or image section and add the file.`,
      `If it fails, tell me the file type/size and what screen you’re on.`,
    ];
  } else if (q.includes("integrat") || q.includes("shopify") || q.includes("etsy")) {
    steps = [
      `Open **Integrations** in ${botName}.`,
      `Select your platform and follow the connect steps.`,
      `If you tell me which platform, I’ll give exact instructions.`,
    ];
  } else {
    steps = [
      `Tell me what screen you’re on and what you expected to happen.`,
      `If there’s an error message, paste it here.`,
    ];
  }

  const lines = [intro, "", hint, "", "Steps:"];
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  lines.push("");
  lines.push(`Quick question: are you doing this inside Products, Orders, or the Production workflow?`);

  return lines.join("\n");
}

function lowConfidencePivot(args: { botName: string; userText: string; intent: Intent }) {
  const { botName, userText, intent } = args;

  // Never mention search failure.
  // Try to be useful and ask 1 clarifying question.

  if (intent === "account_specific") {
    return `I can help, but I’ll need one detail so I don’t point you the wrong way.\n\nWhat exactly are you trying to check in **${botName}** (order status, tracking, invoice, or something else)?`;
  }

  // Default
  return `Got it. I can help with that in **${botName}**.\n\nTo make sure I give the right steps: what screen are you on right now, and what were you trying to do when it didn’t work?`;
}
