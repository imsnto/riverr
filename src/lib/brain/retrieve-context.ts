/**
 * @fileOverview Policy-Aware Retrieval Orchestrator (Vertex-backed)
 */

import { searchArticles, searchTopics, searchInsights } from './vector-search';

// Telemetry Logger per client specification
const Telemetry = {
  log: (event: string, payload: Record<string, any>) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      component: 'RetrieveContext',
      event,
      timestamp: new Date().toISOString(),
      ...payload
    }));
  }
};

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
  Telemetry.log('vertex_query_started', { message, spaceId, hubId, accessLevel: policy.accessLevel });
  
  const [articles, topics, insights] = await Promise.all([
    searchArticles({
      query: message,
      hubId,
      spaceId,
      allowedHelpCenterIds: policy.allowedLibraryIds,
      visibility: policy.isCustomerFacing ? 'public' : undefined,
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

  Telemetry.log('vertex_query_completed', { 
    articleCount: articles.length, 
    topicCount: topics.length, 
    insightCount: insights.length,
    bestArticleScore: bestArticle?.score || 0,
    bestTopicScore: bestTopic?.score || 0,
    bestInsightScore: bestInsight?.score || 0,
  });

  // ============================
  // 🥇 TIER 1: ARTICLE (Highest Trust)
  // ============================
  if (bestArticle && bestArticle.score >= CONFIDENCE_THRESHOLDS.ARTICLE) {
    Telemetry.log('answer_mode_selected', { 
      answerMode: 'article_grounded', 
      confidence: bestArticle.score,
      candidateIds: scoredArticles.slice(0, 3).map(a => a.id)
    });
    return {
      answerMode: 'article_grounded',
      chosenCandidates: scoredArticles.slice(0, 3).map(a => ({...a, sourceType: 'article'})),
      confidence: bestArticle.score,
      rationale: 'Strong article match found.',
    };
  }

  // ============================
  // 🥈 TIER 2: TOPIC (Pattern-based)
  // ============================
  if (bestTopic && bestTopic.score >= CONFIDENCE_THRESHOLDS.TOPIC) {
    Telemetry.log('answer_mode_selected', { 
      answerMode: 'topic_supported', 
      confidence: bestTopic.score,
      candidateId: bestTopic.id
    });
    return {
      answerMode: 'topic_supported',
      chosenCandidates: [bestTopic].map(t => ({...t, sourceType: 'topic'})),
      confidence: bestTopic.score,
      rationale: 'Recurring issue pattern matched (topic).',
    };
  }

  // ============================
  // 🥉 TIER 3: INSIGHTS (Support memory)
  // ============================
  if (bestInsight && bestInsight.score >= CONFIDENCE_THRESHOLDS.INSIGHT) {
    const answerMode = policy.isCustomerFacing ? 'insight_supported_hidden' : 'internal_evidence_only';
    Telemetry.log('answer_mode_selected', { 
      answerMode, 
      confidence: bestInsight.score,
      candidateId: bestInsight.id,
      isCustomerFacing: policy.isCustomerFacing
    });
    if (policy.isCustomerFacing) {
      return {
        answerMode: 'insight_supported_hidden',
        chosenCandidates: [bestInsight].map(i => ({...i, sourceType: 'insight'})),
        confidence: bestInsight.score,
        rationale: 'Internal support knowledge used (hidden from user).',
      };
    }

    return {
      answerMode: 'internal_evidence_only',
      chosenCandidates: [bestInsight].map(i => ({...i, sourceType: 'insight'})),
      confidence: bestInsight.score,
      rationale: 'Internal-only insight used directly.',
    };
  }

  // ============================
  // 🆘 FALLBACK
  // ============================
  const fallbackMode = policy.isCustomerFacing ? 'clarify' : 'escalate';
  Telemetry.log('fallback_escalation_triggered', { 
    answerMode: fallbackMode, 
    reason: 'No high-confidence knowledge found',
    isCustomerFacing: policy.isCustomerFacing,
    bestArticleScore: bestArticle?.score || 0,
    bestTopicScore: bestTopic?.score || 0,
    bestInsightScore: bestInsight?.score || 0,
  });
  return {
    answerMode: fallbackMode,
    chosenCandidates: [],
    confidence: 0,
    rationale: 'No high-confidence knowledge found.',
  };
}
