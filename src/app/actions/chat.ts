
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";

// ---- CONFIG YOU SHOULD SET ----
const PUBLIC_HELP_BASE_URL = "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev"; // change if your help domain differs
const ARTICLES_COLLECTION = "help_center_articles";

// Optional: lightweight in-memory cache to reduce reads per hub/helpCenterIds combo
const cache = new Map<string, { expiresAt: number; articles: any[] }>();
const CACHE_TTL_MS = 30_000;

// Your topic aliases (keep in sync with agent if you want)
const TOPIC_ALIASES: Record<string, string[]> = {
  bins: ["bins", "using bins", "production bins"],
  batching: ["batching", "batch items", "batching items"],
  barcodes: ["barcodes", "barcode workflow", "printing barcodes"],
  "hot folder": ["hot folder", "hot folder app", "hot folder application"],
  "item details": ["item details", "item details page"],
};

function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string) {
  return (html ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMillis(updatedAt: any): number {
  // Firestore Timestamp support
  if (!updatedAt) return 0;
  if (typeof updatedAt === "number") return updatedAt;
  if (updatedAt instanceof Date) return updatedAt.getTime();
  if (typeof updatedAt.toMillis === "function") return updatedAt.toMillis();
  const d = new Date(updatedAt);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function expandQuery(rawQuery: string): string[] {
  const q = normalize(rawQuery);
  if (!q) return [];
  // If user typed a known topic word, expand
  for (const key of Object.keys(TOPIC_ALIASES)) {
    if (q.includes(key)) return TOPIC_ALIASES[key].map(normalize);
  }
  // Otherwise, include the query itself + a couple basic variants
  return [q];
}

function tokenize(q: string): string[] {
  const tokens = normalize(q).split(" ").filter((t) => t.length >= 3);
  // cap tokens so “tell me about bins in production workflow please” doesn’t get weird
  return tokens.slice(0, 10);
}

function scoreArticle(args: {
  queryTokens: string[];
  title: string;
  plain: string;
}): number {
  const { queryTokens, title, plain } = args;

  const t = normalize(title);
  const p = normalize(plain);

  // Weighted hits: title counts more
  let titleHits = 0;
  let bodyHits = 0;

  for (const kw of queryTokens) {
    if (t.includes(kw)) titleHits += 1;
    if (p.includes(kw)) bodyHits += 1;
  }

  // Simple scoring: title hits matter a lot, body hits matter some
  // Normalize into 0..1 range-ish
  const raw = titleHits * 3 + bodyHits * 1;

  // Small boost if title starts with query token (often exact doc match)
  const startsBoost = queryTokens.some((kw) => t.startsWith(kw)) ? 2 : 0;

  const total = raw + startsBoost;

  // Convert to 0..1-ish; clamp
  const normalized = Math.min(1, total / Math.max(6, queryTokens.length * 3));
  return normalized;
}

function buildArticleUrl(article: any): string {
  // Prefer a stored canonical URL/slug if you have it
  if (article.publicUrl) {
    return article.publicUrl.startsWith("http") ? article.publicUrl : `${PUBLIC_HELP_BASE_URL}${article.publicUrl}`;
  }
  if (article.slug && article.helpCenterIds?.[0]) {
    return `${PUBLIC_HELP_BASE_URL}/en/${article.helpCenterIds[0]}/${article.slug}`;
  }

  // Fallback to your current pattern if that matches your frontend router
  const hc = article.helpCenterIds?.[0] ?? "hc";
  return `${PUBLIC_HELP_BASE_URL}/hc/${hc}/articles/${article.id}`;
}

function makeSearchHelpCenter(adminDB: Firestore) {
  return async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
    const { hubId, allowedHelpCenterIds, userId, query } = params;
    const topK = Math.max(1, Math.min(params.topK ?? 8, 20));

    if (!hubId || !allowedHelpCenterIds?.length) return { chunks: [] };

    const expandedQueries = expandQuery(query);
    if (!expandedQueries.length) return { chunks: [] };

    // Cache key per hub + allowed help centers (order-independent)
    const cacheKey = `${hubId}::${[...allowedHelpCenterIds].sort().join(",")}`;
    const now = Date.now();

    let articles: any[] | null = null;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      articles = cached.articles;
    }

    if (!articles) {
      const articlesRef = adminDB.collection(ARTICLES_COLLECTION);
      const qRef = articlesRef
        .where("hubId", "==", hubId)
        .where("status", "==", "published")
        .where("helpCenterIds", "array-contains-any", allowedHelpCenterIds);

      const snapshot = await qRef.get();
      if (snapshot.empty) return { chunks: [] };

      articles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, articles });
    }

    // Access control filtering
    const accessible = articles.filter((article) => {
      const isPublic = Boolean(article.isPublic);
      if (!userId) return isPublic;
      if (isPublic) return true;
      const allowed: string[] = Array.isArray(article.allowedUserIds) ? article.allowedUserIds : [];
      return allowed.includes(userId);
    });

    if (!accessible.length) return { chunks: [] };

    // Generic queries: return recent topK
    const qNorm = normalize(query);
    if (["help", "docs", "articles", "documentation", "guide", "guides"].includes(qNorm)) {
      const recent = [...accessible]
        .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt))
        .slice(0, topK)
        .map((article) => ({
          chunkText: stripHtml(article.content ?? ""),
          score: 0.35, // low-ish but nonzero since it's “browse”
          articleId: article.id,
          title: article.title ?? "Untitled",
          url: buildArticleUrl(article),
          helpCenterIds: article.helpCenterIds ?? [],
          updatedAt: article.updatedAt,
        }));
      return { chunks: recent };
    }

    // Score across expanded queries and take best score per article
    const scored = accessible
      .map((article) => {
        const title = article.title ?? "";
        const plain = stripHtml(article.content ?? "");
        let bestScore = 0;

        for (const eq of expandedQueries) {
          const tokens = tokenize(eq);
          if (!tokens.length) continue;
          const s = scoreArticle({ queryTokens: tokens, title, plain });
          if (s > bestScore) bestScore = s;
        }

        return {
          article,
          plain,
          bestScore,
        };
      })
      // keep only meaningful hits
      .filter((x) => x.bestScore >= 0.12)
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, topK);

    const chunks: HelpChunk[] = scored.map(({ article, plain, bestScore }) => ({
      chunkText: plain, // plain text, not raw HTML
      score: bestScore,
      articleId: article.id,
      title: article.title ?? "Untitled",
      url: buildArticleUrl(article),
      helpCenterIds: article.helpCenterIds ?? [],
      updatedAt: article.updatedAt,
    }));

    return { chunks };
  };
}

const searchHelpCenter = makeSearchHelpCenter(adminDB);


export async function invokeAgent(args: {
    bot: BotConfig;
    conversation: Conversation;
    message: IncomingMessage;
}) {
    const adapters: AgentAdapters = {
        searchHelpCenter,
        escalateToHuman: async ({ conversationId, hubId, reason }) => {
            await db.updateConversation(conversationId, {
                status: 'human',
                escalated: true,
                escalationReason: reason,
                state: 'human_assigned',
            });
        },
        persistAssistantMessage: async ({ conversationId, hubId, text, sources, meta }) => {
            await db.addChatMessage({
                conversationId,
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: text,
                timestamp: new Date().toISOString(),
            });
        },
        updateConversation: async ({ conversationId, hubId, patch }) => {
            await db.updateConversation(conversationId, patch);
        },
    };

    await handleIncomingMessage({ ...args, adapters });
}

export async function searchHelpCenterAction(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
  return searchHelpCenter(params);
}
