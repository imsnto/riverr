
/**
 * @fileOverview Policy-Aware Retrieval Orchestrator (Vertex-backed)
 */

import { searchArticles, searchTopics, searchInsights } from './vector-search';
import { adminDB } from '@/lib/firebase-admin';
import { rewriteQueryForRetrieval } from '@/ai/flows/rewrite-query';
import { rerankCandidates } from '@/ai/flows/rerank-candidates';

export interface AgentKnowledgePolicy {
  agentId?: string;
  isCustomerFacing: boolean;
  accessLevel:
    | 'none'
    | 'articles_only'
    | 'topics_allowed'
    | 'insights_hidden_support'
    | 'internal_full_access';
  allowedLibraryIds: string[];
}

export type AnswerMode =
  | 'article_grounded'
  | 'topic_supported'
  | 'insight_supported_hidden'
  | 'internal_evidence_only'
  | 'clarify'
  | 'escalate';

export interface RetrievalDecision {
  answerMode: AnswerMode;
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

const CONFIDENCE_THRESHOLDS = {
  ARTICLE: 0.78,
  TOPIC: 0.75,
  INSIGHT: 0.55,
};

const BOOSTS = {
  PUBLIC: { article: 1.0, topic: 0.8, insight: 0.5 },
  INTERNAL: { article: 1.0, topic: 0.9, insight: 0.85 },
};

export async function orchestrateRetrieval(args: {
  message: string;
  hubId: string;
  spaceId: string;
  policy: AgentKnowledgePolicy;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  botContext?: string;
}): Promise<RetrievalDecision> {
  const { message, hubId, spaceId, policy, history, botContext } = args;

  console.log('[orchestrateRetrieval] Policy:', { accessLevel: policy.accessLevel, isCustomerFacing: policy.isCustomerFacing, agentId: policy.agentId });
  console.log('[orchestrateRetrieval] Will search insights?', policy.accessLevel === 'insights_hidden_support' || policy.accessLevel === 'internal_full_access');

  const searchQuery = await rewriteQueryForRetrieval({ query: message, history, botContext });

  const boostMap = policy.isCustomerFacing ? BOOSTS.PUBLIC : BOOSTS.INTERNAL;

  // 🧠 PARALLEL SEARCHES
  const [articles, rawTopics, insights] = await Promise.all([
    searchArticles({
      query: searchQuery,
      hubId,
      spaceId,
      allowedHelpCenterIds: policy.allowedLibraryIds,
    }),

    

    policy.accessLevel !== 'none' && policy.accessLevel !== 'articles_only'
      ? searchTopics({
          query: searchQuery,
          spaceId,
          hubId,
        })
      : Promise.resolve([]),

    policy.accessLevel === 'insights_hidden_support' ||
    policy.accessLevel === 'internal_full_access'
      ? searchInsights({
          query: searchQuery,
          hubId,
          spaceId,
        })
      : Promise.resolve([]),
  ]);

  // Expand topics: fetch actual insight content from Firestore so LLM gets real resolution steps
  const topics = await expandTopicsWithInsights(rawTopics);

  // console.log('Search results:', { articles, topics, insights });

  // 🎯 APPLY WEIGHTS
  const scoredArticles = articles.map((a) => ({
    ...a,
    weightedScore: a.score * boostMap.article,
  }));

  const scoredTopics = topics.map((t) => ({
    ...t,
    weightedScore: t.score * boostMap.topic,
  }));

  const scoredInsights = insights.map((i) => ({
    ...i,
    weightedScore: i.score * boostMap.insight,
  }));

  // 🧮 SORT
  scoredArticles.sort((a, b) => b.weightedScore - a.weightedScore);
  scoredTopics.sort((a, b) => b.weightedScore - a.weightedScore);
  scoredInsights.sort((a, b) => b.weightedScore - a.weightedScore);

  const bestArticle = scoredArticles[0];
  const bestTopic = scoredTopics[0];
  const bestInsight = scoredInsights[0];

  const topArticles = scoredArticles
    .slice(0, 5)
    .map((a) => ({ ...a, sourceType: 'article' as const }));
  const topTopics = scoredTopics
    .slice(0, 5)
    .map((t) => ({ ...t, sourceType: 'topic' as const }));
  const topInsights = scoredInsights
    .slice(0, 5)
    .map((i) => ({ ...i, sourceType: 'insight' as const }));

  const rawCandidates = [...topArticles, ...topTopics, ...topInsights];

  // 🔁 LLM RERANKING — filter irrelevant candidates and reorder by relevance
  const relevantIds = await rerankCandidates({
    query: searchQuery,
    candidates: rawCandidates,
  });

  // Rebuild ordered list: relevant first (in reranked order), then any that LLM missed (fallback)
  const rerankedMap = new Map(rawCandidates.map((c) => [c.id, c]));
  const rerankedCandidates = relevantIds
    .map((id) => rerankedMap.get(id))
    .filter((c): c is (typeof rawCandidates)[number] => !!c);

  // Use reranked if we got results, otherwise fall back to raw
  const contextCandidates = rerankedCandidates.length > 0 ? rerankedCandidates : rawCandidates;

  console.log('Retrieval context payload:', {
    articleCount: topArticles.length,
    topicCount: topTopics.length,
    insightCount: topInsights.length,
    totalCount: contextCandidates.length,
    afterRerank: rerankedCandidates.length,
  });

  console.log('=== RETRIEVAL CANDIDATES (FULL) ===');
  contextCandidates.forEach((c, i) => {
    console.log(`[${i + 1}] [${c.sourceType.toUpperCase()}] score=${c.score.toFixed(4)} title="${c.title}"`);
    console.log(`    text (${c.text.length} chars): ${c.text.substring(0, 500)}${c.text.length > 500 ? '...' : ''}`);
  });
  console.log('=== END RETRIEVAL CANDIDATES ===');

  // ============================
  // 🥇 TIER 1: ARTICLE (Highest Trust)
  // ============================
  if (bestArticle && bestArticle.score >= CONFIDENCE_THRESHOLDS.ARTICLE) {
    return {
      answerMode: 'article_grounded',
      chosenCandidates: contextCandidates,
      confidence: bestArticle.score,
      rationale: 'Strong article match found.',
    };
  }

  // ============================
  // 🥈 TIER 2: TOPIC (Pattern-based)
  // ============================
  if (bestTopic && bestTopic.score >= CONFIDENCE_THRESHOLDS.TOPIC) {
    return {
      answerMode: 'topic_supported',
      chosenCandidates: contextCandidates,
      confidence: bestTopic.score,
      rationale: 'Recurring issue pattern matched (topic).',
    };
  }

  // ============================
  // 🥉 TIER 3: INSIGHTS (Support memory)
  // ============================
  if (bestInsight && bestInsight.score >= CONFIDENCE_THRESHOLDS.INSIGHT) {
    if (policy.isCustomerFacing) {
      return {
        answerMode: 'insight_supported_hidden',
        chosenCandidates: contextCandidates,
        confidence: bestInsight.score,
        rationale: 'Internal support knowledge used (hidden from user).',
      };
    }

    return {
      answerMode: 'internal_evidence_only',
      chosenCandidates: contextCandidates,
      confidence: bestInsight.score,
      rationale: 'Internal-only insight used directly.',
    };
  }

  // ============================
  // 🆘 FALLBACK
  // ============================
  const fallbackCandidates = [
    ...scoredArticles.slice(0, 1).map((a) => ({ ...a, sourceType: 'article' as const })),
    ...scoredTopics.slice(0, 1).map((t) => ({ ...t, sourceType: 'topic' as const })),
    ...scoredInsights.slice(0, 1).map((i) => ({ ...i, sourceType: 'insight' as const })),
  ]
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 2);

  if (fallbackCandidates.length > 0) {
    return {
      answerMode: 'clarify',
      chosenCandidates: contextCandidates,
      confidence: fallbackCandidates[0].score,
      rationale: 'Only low-confidence matches found; clarify while using best available context.',
    };
  }

  return {
    answerMode: policy.isCustomerFacing ? 'clarify' : 'escalate',
    chosenCandidates: [],
    confidence: 0,
    rationale: 'No high-confidence knowledge found.',
  };
}

type TopicResult = Awaited<ReturnType<typeof searchTopics>>[number];

/**
 * For each topic, fetch its grouped insights from Firestore and append their
 * content to the topic's text so the LLM receives actual resolution steps.
 */
async function expandTopicsWithInsights(topics: TopicResult[]): Promise<TopicResult[]> {
  if (topics.length === 0) return topics;

  return Promise.all(
    topics.map(async (topic) => {
      try {
        // Simple single-field query — no composite index needed
        const snap = await adminDB
          .collection('insights')
          .where('topicId', '==', topic.id)
          .limit(5)
          .get();

        console.log(`[expandTopics] topic="${topic.title}" → ${snap.size} insights found`);

        if (snap.empty) return topic;

        const insightTexts = snap.docs
          .map((d) => d.data().content as string | undefined)
          .filter((c): c is string => !!c && c.trim().length > 0);

        console.log(`[expandTopics] insightTexts count=${insightTexts.length}, total expanded chars=${insightTexts.reduce((s, t) => s + t.length, 0)}`);

        if (insightTexts.length === 0) return topic;

        return {
          ...topic,
          text: [topic.text, ...insightTexts].join('\n\n---\n\n'),
        };
      } catch (err) {
        console.error(`[expandTopics] Failed for topic ${topic.id}:`, err);
        return topic;
      }
    })
  );
}
