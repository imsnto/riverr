/**
 * @fileOverview Production Retrieval Wrappers
 * Canonical wrappers over Vertex AI Vector Search + Firestore hydration.
 */

import { vertexSearch, VectorSearchResult } from './vertex-search-service';

/**
 * Tier 1: Curated Articles
 * Highest-trust retrieval source.
 */
export async function searchArticles(args: {
  query: string;
  hubId: string;
  spaceId: string;
  allowedHelpCenterIds?: string[];
  limit?: number;
}): Promise<Array<{
  id: string;
  text: string;
  title?: string;
  sourceType: 'article';
  libraryId?: string;
  visibility: 'public' | 'private';
  url?: string;
  score: number;
}>> {
  const {
    query,
    hubId,
    spaceId,
    allowedHelpCenterIds,
    limit = 8,
  } = args;

  // If article access is explicitly restricted to no libraries, return nothing.
  if (Array.isArray(allowedHelpCenterIds) && allowedHelpCenterIds.length === 0) {
    return [];
  }

  const results: VectorSearchResult[] = await vertexSearch.search({
    query,
    sourceType: 'article',
    spaceId,
    hubId,
    libraryIds: allowedHelpCenterIds,
    limit,
  });

  return results.map((r) => ({
    id: r.id,
    text:
      r.metadata.content ||
      r.metadata.body ||
      r.metadata.summary ||
      r.metadata.subtitle ||
      r.metadata.title ||
      '',
    title: r.metadata.title,
    sourceType: 'article' as const,
    libraryId: r.metadata.libraryId || r.metadata.destinationLibraryId || r.metadata.helpCenterId,
    visibility: (r.metadata.visibility || 'public') as 'public' | 'private',
    url:
      r.metadata.url ||
      r.metadata.slug ||
      (r.metadata.helpCenterId ? `/hc/${r.metadata.helpCenterId}/articles/${r.id}` : undefined),
    score: r.score,
  }));
}

/**
 * Tier 2: Topics
 * Recurring grouped patterns derived from Insights.
 */
export async function searchTopics(args: {
  query: string;
  spaceId: string;
  hubId?: string | null;
  limit?: number;
}): Promise<Array<{
  id: string;
  text: string;
  title?: string;
  sourceType: 'topic';
  signalLevel?: 'low' | 'medium' | 'high';
  insightCount?: number;
  score: number;
}>> {
  const {
    query,
    spaceId,
    hubId,
    limit = 5,
  } = args;

  const results: VectorSearchResult[] = await vertexSearch.search({
    query,
    sourceType: 'topic',
    spaceId,
    hubId,
    limit,
  });

  return results.map((r) => ({
    id: r.id,
    title: r.metadata.title,
    text: r.metadata.summary || r.metadata.title || '',
    sourceType: 'topic' as const,
    signalLevel: r.metadata.signalLevel as 'low' | 'medium' | 'high' | undefined,
    insightCount: typeof r.metadata.insightCount === 'number' ? r.metadata.insightCount : undefined,
    score: r.score,
  }));
}

/**
 * Tier 3: Insights
 * Internal support learnings. These are lower-trust than Articles and Topics.
 */
export async function searchInsights(args: {
  query: string;
  hubId: string;
  spaceId: string;
  limit?: number;
}): Promise<Array<{
  id: string;
  text: string;
  title?: string;
  sourceType: 'insight';
  visibility: 'private' | 'public';
  signalLevel?: 'low' | 'medium' | 'high';
  origin?: 'automatic' | 'manual' | 'imported';
  score: number;
}>> {
  const {
    query,
    hubId,
    spaceId,
    limit = 5,
  } = args;

  const results: VectorSearchResult[] = await vertexSearch.search({
    query,
    sourceType: 'insight',
    spaceId,
    hubId,
    visibility: 'private',
    limit,
  });

  return results.map((r) => ({
    id: r.id,
    title: r.metadata.title,
    text: r.metadata.content || r.metadata.summary || r.metadata.title || '',
    sourceType: 'insight' as const,
    visibility: (r.metadata.visibility || 'private') as 'private' | 'public',
    signalLevel: r.metadata.signalLevel as 'low' | 'medium' | 'high' | undefined,
    origin: r.metadata.origin as 'automatic' | 'manual' | 'imported' | undefined,
    score: r.score,
  }));
}
