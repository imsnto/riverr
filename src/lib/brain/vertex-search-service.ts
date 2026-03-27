import { MatchServiceClient } from '@google-cloud/aiplatform';
import { adminDB } from '../firebase-admin';
import { generateQueryEmbedding } from './embed';
import { validateVertexEnv } from './env-validation';

// Validate environment at module load
const envValidation = validateVertexEnv();
if (!envValidation.valid) {
  console.warn('[VertexSearchService] Missing environment variables:', envValidation.missing);
}

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

const PROJECT    = process.env.GOOGLE_CLOUD_PROJECT || 'timeflow-6i3eo';
const LOCATION   = process.env.VERTEX_API_LOCATION  || 'us-central1';
const INDEX_ID   = process.env.VERTEX_AI_INDEX_ID   || '';
const ENDPOINT_ID = process.env.VERTEX_AI_INDEX_ENDPOINT_ID || '';
const DEPLOYED_INDEX_ID  = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'manowar_v2_deployed';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '';

const INDEX_ENDPOINT_RESOURCE_NAME = ENDPOINT_ID 
  ? `projects/${PROJECT}/locations/${LOCATION}/indexEndpoints/${ENDPOINT_ID}`
  : '';

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
  const restricts: Array<{ name: string; allowTokens: string[] }> = [
    { name: 'sourceType', allowTokens: [params.sourceType] },
    { name: 'spaceId', allowTokens: [params.spaceId] },
  ];

  if (params.hubId) restricts.push({ name: 'hubId', allowTokens: [params.hubId] });
  if (params.visibility) restricts.push({ name: 'visibility', allowTokens: [params.visibility] });
  if (params.libraryIds && params.libraryIds.length > 0) {
    restricts.push({ name: 'libraryId', allowTokens: params.libraryIds.slice(0, 10) });
  }

  return restricts;
}

// Spec-required Telemetry Logger
const Telemetry = {
  log: (event: string, payload: Record<string, any>) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      component: 'VertexSearchService',
      event,
      timestamp: new Date().toISOString(),
      ...payload
    }));
  }
};

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

    if (!ENDPOINT_ID || !DEPLOYED_INDEX_ID || !PUBLIC_ENDPOINT_DOMAIN) {
      console.warn('[VertexSearch] Infrastructure not fully configured. Falling back to empty results.');
      return [];
    }

    const queryVector = await generateQueryEmbedding(query);
    if (!queryVector || queryVector.length === 0) return [];

    Telemetry.log('vectorQuery_generated', { 
      queryText: query, 
      dimension: queryVector.length 
    });

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
            // @ts-ignore - The types locally in v3.31.0 of the SDK are mismatched with the actual JS API 
            restricts: restricts,
          },
        ],
      }) as unknown as [any, any, any];

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

      Telemetry.log('retrievedCandidateIds', { 
        count: ids.length, 
        candidates: ids.slice(0, 5) // top 5
      });

      const collectionName = getCollectionName(sourceType);
      const hydrated = new Map<string, any>();

      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const snap = await adminDB.collection(collectionName)
          .where('__name__', 'in', batch)
          .get();
        snap.docs.forEach(doc => hydrated.set(doc.id, doc.data()));
      }

      Telemetry.log('FirestoreHydration_completed', {
        requested: ids.length,
        hydrated: hydrated.size,
        collection: collectionName
      });

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