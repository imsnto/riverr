
import { searchArticles, searchTopics, searchInsights, VectorSearchResult } from './vector-search';
import { IntelligenceAccessLevel } from '@/lib/data';

export interface AgentKnowledgePolicy {
  agentId: string;
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
 * Policy-Aware Retrieval Orchestrator.
 * Given a question and policy, determines the best answer mode and candidates.
 */
export async function orchestrateRetrieval(args: {
  message: string;
  hubId: string;
  spaceId: string;
  policy: AgentKnowledgePolicy;
  userId?: string | null;
}): Promise<RetrievalDecision> {
  const { message, hubId, spaceId, policy, userId } = args;

  // 1. Parallel Multi-Index Search
  const searchPromises: Promise<any>[] = [
    searchArticles({ query: message, hubId, allowedHelpCenterIds: policy.allowedLibraryIds })
  ];

  if (policy.accessLevel !== 'none') {
    searchPromises.push(searchTopics({ query: message, spaceId }));
  }

  if (policy.accessLevel === 'insights_hidden_support' || policy.accessLevel === 'internal_full_access') {
    searchPromises.push(searchInsights({ query: message, hubId }));
  }

  const [articles, topics = [], insights = []] = await Promise.all(searchPromises);

  // 2. Filter & Weight Results
  const boostMap = policy.isCustomerFacing ? BOOSTS.PUBLIC : BOOSTS.INTERNAL;

  const scoredArticles = articles.map((a: VectorSearchResult) => ({ ...a, sourceType: 'article' as const, weightedScore: a.score * boostMap.article }));
  const scoredTopics = topics.map((t: VectorSearchResult) => ({ ...t, sourceType: 'topic' as const, weightedScore: t.score * boostMap.topic }));
  const scoredInsights = insights.map((i: VectorSearchResult) => ({ ...i, sourceType: 'insight' as const, weightedScore: i.score * boostMap.insight }));

  // 3. Selection Logic
  const bestArticle = scoredArticles.sort((a: any, b: any) => b.weightedScore - a.weightedScore)[0];
  const bestTopic = scoredTopics.sort((a: any, b: any) => b.weightedScore - a.weightedScore)[0];
  const bestInsight = scoredInsights.sort((a: any, b: any) => b.weightedScore - a.weightedScore)[0];

  // A. Article Grounded
  if (bestArticle && bestArticle.score >= CONFIDENCE_THRESHOLDS.ARTICLE) {
    return {
      answerMode: 'article_grounded',
      chosenCandidates: scoredArticles.slice(0, 3),
      confidence: bestArticle.score,
      rationale: "Strong article match found."
    };
  }

  // B. Topic Supported
  if (bestTopic && bestTopic.score >= CONFIDENCE_THRESHOLDS.TOPIC) {
    return {
      answerMode: 'topic_supported',
      chosenCandidates: [bestTopic],
      confidence: bestTopic.score,
      rationale: "No direct article, but strong recurring topic pattern detected."
    };
  }

  // C. Insight Supported (Hidden or Direct)
  if (bestInsight && bestInsight.score >= CONFIDENCE_THRESHOLDS.INSIGHT) {
    const mode = policy.isCustomerFacing ? 'insight_supported_hidden' : 'internal_evidence_only';
    return {
      answerMode: mode,
      chosenCandidates: [bestInsight],
      confidence: bestInsight.score,
      rationale: "Derived from internal support memories."
    };
  }

  // D. Fallback
  return {
    answerMode: 'escalate',
    chosenCandidates: [],
    confidence: 0,
    rationale: "No trusted sources met confidence threshold."
  };
}
