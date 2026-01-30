
'use server';

import { adminDB } from '@/lib/firebase-admin';
import { handleIncomingMessage, AgentAdapters, BotConfig, Conversation, IncomingMessage, SearchHelpCenterParams, SearchHelpCenterResult, HelpChunk } from '@/lib/agent';
import * as db from '@/lib/db';
import type { Firestore } from "firebase-admin/firestore";

// ---- CONFIG YOU SHOULD SET ----
// This is no longer used here, but keeping it as a reference for the indexer.
const PUBLIC_HELP_BASE_URL = "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev";
const CHUNKS_COLLECTION = "help_center_chunks";

// Optional: lightweight in-memory cache to reduce reads per hub/helpCenterIds combo
const cache = new Map<string, { expiresAt: number; chunks: HelpChunk[] }>();
const CACHE_TTL_MS = 30_000;

// Your topic aliases
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

function scoreChunk(args: {
  chunk: HelpChunk;
  queryTokens: string[];
}): number {
  const { chunk, queryTokens } = args;

  const title = normalize(chunk.title);
  const path = normalize(chunk.headingPath.join(" "));
  const text = normalize(chunk.chunkText);

  let titleHits = 0;
  let pathHits = 0;
  let textHits = 0;

  for (const kw of queryTokens) {
    if (title.includes(kw)) titleHits++;
    if (path.includes(kw)) pathHits++;
    if (text.includes(kw)) textHits++;
  }

  // Boosts for more specific matches
  const titleExactBoost = queryTokens.some(kw => title === kw) ? 5 : 0;
  const pathExactBoost = queryTokens.some(kw => path.includes(kw)) ? 2 : 0;

  // Weighted scoring: title and path hits matter a lot more
  const rawScore = (titleHits * 5) + (pathHits * 3) + (textHits * 1);
  const total = rawScore + titleExactBoost + pathExactBoost;

  // Normalize score to a 0..1-ish range
  const normalized = Math.min(1, total / Math.max(10, queryTokens.length * 5));
  return normalized;
}

function makeSearchHelpCenter(adminDB: Firestore) {
  return async function searchHelpCenter(params: SearchHelpCenterParams): Promise<SearchHelpCenterResult> {
    const { hubId, allowedHelpCenterIds, userId, query } = params;
    const topK = Math.max(1, Math.min(params.topK ?? 10, 20));

    if (!hubId || !allowedHelpCenterIds?.length) return { chunks: [] };

    const expandedQueries = expandQuery(query);
    if (!expandedQueries.length) return { chunks: [] };

    // --- NEW LOGIC: QUERY CHUNKS DIRECTLY ---
    const cacheKey = `${hubId}::${[...allowedHelpCenterIds].sort().join(",")}`;
    const now = Date.now();
    let hubChunks: HelpChunk[] | null = null;
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      hubChunks = cached.articles as HelpChunk[];
    }
    
    if (!hubChunks) {
        const chunksRef = adminDB.collection(CHUNKS_COLLECTION);
        const qRef = chunksRef
            .where("hubId", "==", hubId)
            .where("helpCenterIds", "array-contains-any", allowedHelpCenterIds);

        const snapshot = await qRef.get();
        if (snapshot.empty) return { chunks: [] };

        hubChunks = snapshot.docs.map((doc) => doc.data() as HelpChunk);
        cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, chunks: hubChunks });
    }
    
    // Access control filtering
    const accessibleChunks = hubChunks.filter((chunk) => {
      if (chunk.isPublic) return true;
      if (!userId) return false; // Must be logged in for private content
      return chunk.allowedUserIds?.includes(userId);
    });
    
    if (!accessibleChunks.length) return { chunks: [] };

    // Generic queries: return recent topK
    const qNorm = normalize(query);
    if (["help", "docs", "articles", "documentation", "guide", "guides"].includes(qNorm)) {
      const recentChunks = accessibleChunks
        .sort((a, b) => new Date(b.articleUpdatedAt).getTime() - new Date(a.articleUpdatedAt).getTime())
        .map(chunk => ({...chunk, score: 0.35 }));

      return { chunks: recentChunks.slice(0, topK) };
    }

    // --- Scoring logic ---
    const scoredChunks = accessibleChunks
      .map((chunk) => {
        let bestScore = 0;
        for (const eq of expandedQueries) {
          const tokens = tokenize(eq);
          if (!tokens.length) continue;
          const s = scoreChunk({ chunk, queryTokens: tokens });
          if (s > bestScore) bestScore = s;
        }
        return { ...chunk, score: bestScore };
      })
      .filter((x) => x.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return { chunks: scoredChunks };
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
