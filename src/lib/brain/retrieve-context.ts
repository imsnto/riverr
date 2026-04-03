
/**
 * @fileOverview Policy-Aware Retrieval Orchestrator (Vertex-backed)
 */

import { searchArticles, searchTopics, searchInsights } from './vector-search';

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
  INSIGHT: 0.70,
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
}): Promise<RetrievalDecision> {
  const { message, hubId, spaceId, policy } = args;

  const boostMap = policy.isCustomerFacing ? BOOSTS.PUBLIC : BOOSTS.INTERNAL;

  // 🧠 PARALLEL SEARCHES
  const [articles, topics, insights] = await Promise.all([
    searchArticles({
      query: message,
      hubId,
      spaceId,
      allowedHelpCenterIds: policy.allowedLibraryIds,
    }),

    

    policy.accessLevel !== 'none' && policy.accessLevel !== 'articles_only'
      ? searchTopics({
          query: message,
          spaceId,
          hubId,
        })
      : Promise.resolve([]),

    policy.accessLevel === 'insights_hidden_support' ||
    policy.accessLevel === 'internal_full_access'
      ? searchInsights({
          query: message,
          hubId,
          spaceId,
        })
      : Promise.resolve([]),
  ]);

  console.log('Search results:', { articles, topics, insights });

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
    .slice(0, 3)
    .map((a) => ({ ...a, sourceType: 'article' as const }));
  const topTopics = scoredTopics
    .slice(0, 3)
    .map((t) => ({ ...t, sourceType: 'topic' as const }));
  const topInsights = scoredInsights
    .slice(0, 3)
    .map((i) => ({ ...i, sourceType: 'insight' as const }));

  const contextCandidates = [...topArticles, ...topTopics, ...topInsights];

  console.log('Retrieval context payload:', {
    articleCount: topArticles.length,
    topicCount: topTopics.length,
    insightCount: topInsights.length,
    totalCount: contextCandidates.length,
  });

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
