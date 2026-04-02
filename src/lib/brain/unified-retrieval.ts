import { vertexSearch, VectorSearchResult, SearchParams } from './vertex-search-service';
import { generateQueryEmbedding } from './embed';

export type SourceType = 'article' | 'topic' | 'insight';

export interface RetrievalCandidate {
  id: string;
  score: number;
  sourceType: SourceType;
  metadata: Record<string, any>;
  title?: string;
  content?: string;
}

export interface UnifiedRetrievalParams {
  query: string;
  spaceId: string;
  hubId?: string;
  sourceTypes: SourceType[];
  limit?: number;
  visibility?: 'public' | 'private';
}

export interface RetrievalDecision {
  answerMode: 'article_grounded' | 'topic_supported' | 'insight_supported' | 'clarify' | 'escalate';
  chosenCandidates: RetrievalCandidate[];
  confidence: number;
  rationale: string;
}

/**
 * Unified retrieval function for AI Agent.
 * Queries Vertex AI Vector Search for all specified source types.
 */
export async function retrieveContextUnified(
  params: UnifiedRetrievalParams
): Promise<RetrievalDecision> {
  const { query, spaceId, hubId, sourceTypes, limit = 5, visibility } = params;

  try {
    // 1. Generate query embedding
    const queryVector = await generateQueryEmbedding(query);
    if (!queryVector || queryVector.length === 0) {
      return {
        answerMode: 'clarify',
        chosenCandidates: [],
        confidence: 0,
        rationale: 'Failed to generate query embedding'
      };
    }

    // 2. Query Vertex AI for each sourceType
    const allResults: RetrievalCandidate[] = [];
    
    for (const sourceType of sourceTypes) {
      const searchParams: SearchParams = {
        query,
        sourceType: sourceType as any,
        spaceId,
        hubId,
        limit: Math.ceil(limit / sourceTypes.length), // Distribute limit across types
        visibility
      };

      const results = await vertexSearch.search(searchParams);
      
      // Map to unified format
      const mapped = results.map(r => ({
        id: r.id,
        score: r.score,
        sourceType,
        metadata: r.metadata,
        title: r.metadata.name || r.metadata.title,
        content: r.metadata.content || r.metadata.summary
      }));
      
      allResults.push(...mapped);
    }

    // 3. Sort by score (descending) and take top N
    allResults.sort((a, b) => b.score - a.score);
    const topCandidates = allResults.slice(0, limit);

    // 4. Determine answer mode based on scores
    const maxScore = topCandidates.length > 0 ? topCandidates[0].score : 0;
    let answerMode: RetrievalDecision['answerMode'];
    let confidence = maxScore;
    let rationale: string;

    if (maxScore >= 0.8) {
      answerMode = 'article_grounded';
      rationale = `High confidence match (${maxScore.toFixed(2)}) from ${topCandidates[0].sourceType}`;
    } else if (maxScore >= 0.5) {
      answerMode = topCandidates[0]?.sourceType === 'topic' ? 'topic_supported' : 'insight_supported';
      rationale = `Medium confidence match (${maxScore.toFixed(2)}) - proceed with caution`;
    } else if (maxScore >= 0.3) {
      answerMode = 'clarify';
      rationale = `Low confidence match (${maxScore.toFixed(2)}) - request clarification`;
    } else {
      answerMode = 'escalate';
      rationale = `No relevant matches found (max score: ${maxScore.toFixed(2)})`;
    }

    return {
      answerMode,
      chosenCandidates: topCandidates,
      confidence,
      rationale
    };

  } catch (error: any) {
    console.error('[UnifiedRetrieval] Failed:', error);
    return {
      answerMode: 'escalate',
      chosenCandidates: [],
      confidence: 0,
      rationale: `Retrieval error: ${error.message}`
    };
  }
}

/**
 * Simple convenience function for article-only retrieval
 */
export async function retrieveArticles(
  query: string,
  spaceId: string,
  hubId?: string,
  limit = 5
): Promise<RetrievalDecision> {
  return retrieveContextUnified({
    query,
    spaceId,
    hubId,
    sourceTypes: ['article'],
    limit
  });
}

/**
 * Convenience function for support scenarios (articles + insights)
 */
export async function retrieveSupportContext(
  query: string,
  spaceId: string,
  hubId?: string,
  limit = 5
): Promise<RetrievalDecision> {
  return retrieveContextUnified({
    query,
    spaceId,
    hubId,
    sourceTypes: ['article', 'insight'],
    limit
  });
}
