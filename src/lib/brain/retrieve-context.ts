
/**
 * @fileOverview Policy-Aware Retrieval Orchestrator (Vertex-Backed).
 * Implements the tiered trust model: Articles > Topics > Insights.
 */

import { vertexSearch, SearchParams, VectorSearchResult } from './vertex-search-service';
import { IntelligenceAccessLevel } from '@/lib/data';

export interface AgentKnowledgePolicy {
  agentId?: string;
  isCustomerFacing: boolean;
  accessLevel: IntelligenceAccessLevel;
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
  TOPIC: 0.80,
  INSIGHT: 0.84,
};

const BOOSTS = {
  PUBLIC: { article: 1.0, topic: 0.75, insight: 0.45 },
  INTERNAL: { article: 1.0, topic: 0.9, insight: 0.8 }
};

/**
 * TIERED RETRIEVAL ORCHESTRATOR
 * 1. Articles (Canonical Docs)
 * 2. Topics (Recurring Patterns)
 * 3. Insights (Internal Memories)
 */
export async function orchestrateRetrieval(args: {
  message: string;
  hubId: string;
  spaceId: string;
  policy: AgentKnowledgePolicy;
}): Promise<RetrievalDecision> {
  const { message, hubId, spaceId, policy } = args;

  console.log(`[Orchestrator] Running tiered retrieval for policy: ${policy.isCustomerFacing ? 'Public' : 'Internal'} (${policy.accessLevel})`);

  // 1. Parallel Multi-Corpus Search via Vertex
  const searchPromises: Promise<VectorSearchResult[]>[] = [
    vertexSearch.search({
      query: message,
      sourceType: 'article',
      spaceId,
      libraryIds: policy.allowedLibraryIds,
      limit: 5
    })
  ];

  if (policy.accessLevel !== 'none') {
    searchPromises.push(vertexSearch.search({
      query: message,
      sourceType: 'topic',
      spaceId,
      limit: 3
    }));
  }

  const shouldSearchInsights = policy.accessLevel === 'insights_hidden_support' || policy.accessLevel === 'internal_full_access';
  if (shouldSearchInsights) {
    searchPromises.push(vertexSearch.search({
      query: message,
      sourceType: 'insight',
      spaceId,
      limit: 3
    }));
  }

  const [articleRes = [], topicRes = [], insightRes = []] = await Promise.all(searchPromises);

  // 2. Score Normalization & Weighing
  const boostMap = policy.isCustomerFacing ? BOOSTS.PUBLIC : BOOSTS.INTERNAL;

  const scoredArticles = articleRes.map(r => ({ ...r, sourceType: 'article' as const, text: r.metadata.body, title: r.metadata.title, weightedScore: r.score * boostMap.article }));
  const scoredTopics = topicRes.map(r => ({ ...r, sourceType: 'topic' as const, text: r.metadata.summary || r.metadata.title, title: r.metadata.title, weightedScore: r.score * boostMap.topic }));
  const scoredInsights = insightRes.map(r => ({ ...r, sourceType: 'insight' as const, text: r.metadata.content, title: r.metadata.title, weightedScore: r.score * boostMap.insight }));

  // 3. Selection Hierarchy
  const bestArticle = scoredArticles.sort((a, b) => b.weightedScore - a.weightedScore)[0];
  const bestTopic = scoredTopics.sort((a, b) => b.weightedScore - a.weightedScore)[0];
  const bestInsight = scoredInsights.sort((a, b) => b.weightedScore - a.weightedScore)[0];

  // TIER 1: Curated Knowledge (Article)
  if (bestArticle && bestArticle.score >= CONFIDENCE_THRESHOLDS.ARTICLE) {
    console.log(`[Orchestrator] Selection: article_grounded (Score: ${bestArticle.score.toFixed(3)})`);
    return {
      answerMode: 'article_grounded',
      chosenCandidates: [bestArticle],
      confidence: bestArticle.score,
      rationale: `Strong match in library: ${bestArticle.title}`
    };
  }

  // TIER 2: Pattern Supported (Topic)
  if (bestTopic && bestTopic.score >= CONFIDENCE_THRESHOLDS.TOPIC) {
    console.log(`[Orchestrator] Selection: topic_supported (Score: ${bestTopic.score.toFixed(3)})`);
    return {
      answerMode: 'topic_supported',
      chosenCandidates: [bestTopic],
      confidence: bestTopic.score,
      rationale: `Pattern detected: ${bestTopic.title}`
    };
  }

  // TIER 3: Intelligence Memory (Insight)
  if (bestInsight && bestInsight.score >= CONFIDENCE_THRESHOLDS.INSIGHT) {
    const mode = policy.isCustomerFacing ? 'insight_supported_hidden' : 'internal_evidence_only';
    console.log(`[Orchestrator] Selection: ${mode} (Score: ${bestInsight.score.toFixed(3)})`);
    return {
      answerMode: mode,
      chosenCandidates: [bestInsight],
      confidence: bestInsight.score,
      rationale: `Internal intelligence found: ${bestInsight.title}`
    };
  }

  // FALLBACK
  console.log(`[Orchestrator] Selection: escalate (No high-confidence sources found)`);
  return {
    answerMode: 'escalate',
    chosenCandidates: [],
    confidence: 0,
    rationale: "No curated articles or intelligence patterns met confidence threshold."
  };
}
