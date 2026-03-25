import { MatchServiceClient } from '@google-cloud/aiplatform';
import { adminDB } from '../firebase-admin';
import { generateQueryEmbedding } from './embed';
import { db as firestore } from 'firebase-admin';

export type VectorSourceType = 'article' | 'topic' | 'insight' | 'chunk';

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export interface SearchParams {
  query: string;
  sourceType: VectorSourceType;
  spaceId: string;
  hubId?: string | null;
  libraryIds?: string[];
  visibility?: 'public' | 'private';
  limit?: number;
}

const INDEX_ENDPOINT_RESOURCE_NAME = process.env.VERTEX_VECTOR_INDEX_ENDPOINT_RESOURCE_NAME || '';
const DEPLOYED_INDEX_ID = process.env.VERTEX_VECTOR_DEPLOYED_INDEX_ID || '';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_VECTOR_PUBLIC_ENDPOINT_DOMAIN || '';

function getCollectionName(sourceType: VectorSourceType): string {
  switch (sourceType) {
    case 'article': return 'articles';
    case 'topic': return 'topics';
    case 'insight': return 'insights';
    case 'chunk': return 'source_chunks';
    default: throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

function buildQueryRestricts(params: SearchParams) {
  const restricts: Array<{ namespace: string; allowList: string[] }> = [
    { namespace: 'sourceType', allowList: [params.sourceType] },
    { namespace: 'spaceId', allowList: [params.spaceId] },
  ];

  if (params.hubId) restricts.push({ namespace: 'hubId', allowList: [params.hubId] });
  if (params.visibility) restricts.push({ namespace: 'visibility', allowList: [params.visibility] });
  if (params.libraryIds && params.libraryIds.length > 0) {
    restricts.push({ namespace: 'libraryId', allowList: params.libraryIds.slice(0, 10) });
  }

  return restricts;
}

class VertexVectorSearchService {
  private matchClient: MatchServiceClient;

  constructor() {
    this.matchClient = new MatchServiceClient({
      apiEndpoint: PUBLIC_ENDPOINT_DOMAIN || 'us-central1-aiplatform.googleapis.com',
    });
  }

  /**
   * Real Vertex AI Vector Search:
   * 1. Query deployed index endpoint
   * 2. Get candidate datapoints
   * 3. Hydrate canonical Firestore docs by ID
   */
  async search(params: SearchParams): Promise<VectorSearchResult[]> {
    const { query, sourceType, spaceId, limit = 10 } = params;

    if (!INDEX_ENDPOINT_RESOURCE_NAME || !DEPLOYED_INDEX_ID || !PUBLIC_ENDPOINT_DOMAIN) {
      console.warn('[VertexSearch] Infrastructure not fully configured. Falling back to empty results.');
      return [];
    }

    const queryVector = await generateQueryEmbedding(query);
    if (!queryVector || queryVector.length === 0) return [];

    const restricts = buildQueryRestricts(params);

    try {
      const [response] = await this.matchClient.findNeighbors({
        indexEndpoint: INDEX_ENDPOINT_RESOURCE_NAME,
        deployedIndexId: DEPLOYED_INDEX_ID,
        queries: [
          {
            datapoint: {
              datapointId: 'query',
              featureVector: queryVector,
            },
            neighborCount: limit,
            restricts,
          },
        ],
      });

      const nearest = response.nearestNeighbors?.[0]?.neighbors ?? [];
      if (nearest.length === 0) return [];

      const ids = nearest
        .map((n: any) => {
          const dpId = n.datapoint?.datapointId as string | undefined;
          if (!dpId) return null;
          const parts = dpId.split(':');
          return parts.length >= 2 ? parts.slice(1).join(':') : null;
        })
        .filter(Boolean) as string[];

      if (ids.length === 0) return [];

      const collectionName = getCollectionName(sourceType);
      const hydrated = new Map<string, any>();

      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const snap = await adminDB.collection(collectionName)
          .where('__name__', 'in', batch)
          .get();
        snap.docs.forEach(doc => hydrated.set(doc.id, doc.data()));
      }

      const results: VectorSearchResult[] = [];
      for (const neighbor of nearest) {
        const dpId = neighbor.datapoint?.datapointId as string | undefined;
        if (!dpId) continue;
        const docId = dpId.split(':').slice(1).join(':');
        const data = hydrated.get(docId);
        if (data && data.spaceId === spaceId) {
          results.push({
            id: docId,
            score: typeof neighbor.distance === 'number' ? 1 - neighbor.distance : 0.8,
            metadata: data,
          });
        }
      }

      return results;
    } catch (err) {
      console.error('[VertexSearch] Search failed:', err);
      return [];
    }
  }
}

export const vertexSearch = new VertexVectorSearchService();