
/**
 * @fileOverview Production Retrieval Entry Points (Vertex-Backed).
 * Standardizes all corpus search on Vertex AI Vector Search.
 */

import { vertexSearch, VectorSearchResult } from './vertex-search-service';

/**
 * Searches the canonical curated Articles index.
 * Tier 1: Highest Trust (Promoted Documentation)
 */
export async function searchArticles(args: {
  query: string;
  hubId: string;
  spaceId: string;
  allowedHelpCenterIds?: string[];
  limit?: number;
}): Promise<any[]> {
  const { query, hubId, spaceId, allowedHelpCenterIds, limit = 8 } = args;
  
  if (allowedHelpCenterIds && allowedHelpCenterIds.length === 0) {
    return [];
  }

  const results = await vertexSearch.search({
    query,
    sourceType: 'article',
    spaceId,
    libraryIds: allowedHelpCenterIds,
    limit,
  });

  return results.map(r => ({
    id: r.id,
    text: r.metadata.body,
    title: r.metadata.title,
    sourceType: 'article',
    libraryId: r.metadata.destinationLibraryId,
    visibility: r.metadata.visibility || 'public',
    score: r.score,
  }));
}

/**
 * Searches the semantic Topics index.
 * Tier 2: Medium Trust (Grouped Intelligence)
 */
export async function searchTopics(args: {
  query: string;
  spaceId: string;
  limit?: number;
}): Promise<any[]> {
  const { query, spaceId, limit = 5 } = args;

  const results = await vertexSearch.search({
    query,
    sourceType: 'topic',
    spaceId,
    limit,
  });

  return results.map(r => ({
    id: r.id,
    title: r.metadata.title,
    text: r.metadata.summary || r.metadata.title,
    sourceType: 'topic',
    score: r.score,
  }));
}

/**
 * Searches individual Insights.
 * Tier 3: Supporting Internal Signal
 */
export async function searchInsights(args: {
  query: string;
  hubId: string;
  spaceId: string;
  limit?: number;
}): Promise<any[]> {
  const { query, hubId, spaceId, limit = 5 } = args;

  const results = await vertexSearch.search({
    query,
    sourceType: 'insight',
    spaceId,
    hubId,
    limit,
  });

  return results.map(r => ({
    id: r.id,
    title: r.metadata.title,
    text: r.metadata.content,
    sourceType: 'insight',
    score: r.score,
  }));
}
