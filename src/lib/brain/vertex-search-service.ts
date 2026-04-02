import { MatchServiceClient } from '@google-cloud/aiplatform';
import { adminDB } from '../firebase-admin';
import { generateQueryEmbedding } from './embed';

export type VectorSourceType = 'article' | 'help_center_article' | 'topic' | 'insight' | 'chunk';

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
const DEBUG_COMPARE_WITHOUT_RESTRICTS = process.env.VERTEX_SEARCH_DEBUG_COMPARE_WITHOUT_RESTRICTS === 'true';

function getCollectionName(sourceType: VectorSourceType): string {
  switch (sourceType) {
    case 'article': return 'documents';
    case 'help_center_article': return 'help_center_articles';
    case 'topic': return 'topics';
    case 'insight': return 'insights';
    case 'chunk': return 'source_chunks';
    default: throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

function parseDatapointId(datapointId: string): { sourceType: VectorSourceType | null; docId: string | null } {
  const parts = datapointId.split(':');
  if (parts.length < 2) return { sourceType: null, docId: null };

  const sourceType = parts[0] as VectorSourceType;
  const docId = parts.slice(1).join(':');

  return {
    sourceType,
    docId: docId || null,
  };
}

function isCompatibleSourceType(requested: VectorSourceType, actual: VectorSourceType): boolean {
  // Backward-compatibility: public help-center content can be represented as article/help_center_article.
  if (requested === 'article') {
    return actual === 'article' || actual === 'help_center_article';
  }
  return requested === actual;
}

function buildQueryRestricts(params: SearchParams) {
  const sourceTypeAllowList =
    params.sourceType === 'article'
      ? ['article', 'help_center_article']
      : [params.sourceType];

  const restricts: Array<{ namespace: string; allowList: string[] }> = [
    { namespace: 'sourceType', allowList: sourceTypeAllowList },
    { namespace: 'spaceId', allowList: [params.spaceId] },
  ];

  if (params.hubId) restricts.push({ namespace: 'hubId', allowList: [params.hubId] });
  if (params.visibility) restricts.push({ namespace: 'visibility', allowList: [params.visibility] });
  if (params.libraryIds && params.libraryIds.length > 0) {
    restricts.push({ namespace: 'libraryId', allowList: params.libraryIds.slice(0, 10) });
  }

  return restricts;
}

function matchesAllowedLibraries(data: Record<string, any>, allowedIds: string[]): boolean {
  if (allowedIds.length === 0) return true;

  const candidateIds = [
    data.helpCenterId,
    data.libraryId,
    data.destinationLibraryId,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  return candidateIds.some((id) => allowedIds.includes(id));
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
    if (!queryVector || queryVector.length === 0) {
      console.log('[VertexSearch] No query vector generated');
      return [];
    }

    const restricts = buildQueryRestricts(params);
    console.log('[VertexSearch] Searching with restricts:', JSON.stringify(restricts));

    const runNeighborSearch = async (
      requestRestricts: Array<{ namespace: string; allowList: string[] }>
    ): Promise<any[]> => {
      const responseTuple = await this.matchClient.findNeighbors({
        indexEndpoint: INDEX_ENDPOINT_RESOURCE_NAME,
        deployedIndexId: DEPLOYED_INDEX_ID,
        queries: [
          {
            datapoint: {
              datapointId: 'query',
              featureVector: queryVector,
              restricts: requestRestricts,
            },
            neighborCount: limit,
          },
        ],
      } as any);

      const response = responseTuple[0] as any;
      return response.nearestNeighbors?.[0]?.neighbors ?? [];
    };

    if (DEBUG_COMPARE_WITHOUT_RESTRICTS) {
      console.log('[VertexSearch] Also testing without restricts...');
      try {
        const testResponseTuple = await this.matchClient.findNeighbors({
          indexEndpoint: INDEX_ENDPOINT_RESOURCE_NAME,
          deployedIndexId: DEPLOYED_INDEX_ID,
          queries: [
            {
              datapoint: {
                datapointId: 'query',
                featureVector: queryVector,
              },
              neighborCount: limit,
            },
          ],
        } as any);
        const testResponse = testResponseTuple[0] as any;
        const testNearest = testResponse.nearestNeighbors?.[0]?.neighbors ?? [];
        console.log(`[VertexSearch] WITHOUT RESTRICTS: Found ${testNearest.length} neighbors`);
        if (testNearest.length > 0) {
          console.log('[VertexSearch] WITHOUT RESTRICTS sample datapointId:', testNearest[0].datapoint?.datapointId);
          console.log('[VertexSearch] WITHOUT RESTRICTS sample distance:', testNearest[0].distance);
        }
      } catch (e) {
        console.log('[VertexSearch] Test without restricts failed:', e);
      }
    }

    try {
      let nearest = await runNeighborSearch(restricts);
      let usedLibraryFallback = false;
      const requestedLibraryIds = params.libraryIds?.slice(0, 10) ?? [];

      if (
        nearest.length === 0 &&
        requestedLibraryIds.length > 0 &&
        (sourceType === 'article' || sourceType === 'help_center_article')
      ) {
        const relaxedRestricts = buildQueryRestricts({ ...params, libraryIds: undefined });
        console.log(
          '[VertexSearch] WITH RESTRICTS found 0 neighbors. Retrying without libraryId restrict and applying post-hydration library filter.'
        );
        nearest = await runNeighborSearch(relaxedRestricts);
        usedLibraryFallback = true;
      }

      console.log(`[VertexSearch] WITH RESTRICTS: Found ${nearest.length} neighbors`);
      if (nearest.length === 0) return [];

      const parsedNeighbors = nearest
        .map((n: any) => {
          const dpId = n.datapoint?.datapointId as string | undefined;
          if (!dpId) return null;
          const parsed = parseDatapointId(dpId);
          if (!parsed.sourceType || !parsed.docId) return null;
          return {
            datapointId: dpId,
            sourceType: parsed.sourceType,
            docId: parsed.docId,
          };
        })
        .filter(Boolean) as Array<{ datapointId: string; sourceType: VectorSourceType; docId: string }>;

      console.log(
        `[VertexSearch] Extracted ${parsedNeighbors.length} datapoints:`,
        parsedNeighbors.slice(0, 5).map(p => ({ sourceType: p.sourceType, docId: p.docId }))
      );

      if (parsedNeighbors.length === 0) return [];

      const idsByCollection = new Map<string, Set<string>>();
      for (const item of parsedNeighbors) {
        if (!isCompatibleSourceType(sourceType, item.sourceType)) continue;
        const collectionName = getCollectionName(item.sourceType);
        if (!idsByCollection.has(collectionName)) {
          idsByCollection.set(collectionName, new Set<string>());
        }
        idsByCollection.get(collectionName)!.add(item.docId);
      }

      const hydrated = new Map<string, any>();

      for (const [collectionName, idSet] of idsByCollection.entries()) {
        const ids = Array.from(idSet);
        for (let i = 0; i < ids.length; i += 10) {
          const batch = ids.slice(i, i + 10);
          const snap = await adminDB.collection(collectionName)
            .where('__name__', 'in', batch)
            .get();
          snap.docs.forEach(doc => hydrated.set(`${collectionName}:${doc.id}`, doc.data()));
        }
      }

      const results: VectorSearchResult[] = [];
      let missingDocCount = 0;
      let spaceMismatchCount = 0;
      let sourceTypeMismatchCount = 0;
      let libraryFilterDropCount = 0;
      for (const neighbor of nearest) {
        const dpId = neighbor.datapoint?.datapointId as string | undefined;
        if (!dpId) continue;
        const parsed = parseDatapointId(dpId);
        if (!parsed.sourceType || !parsed.docId) {
          missingDocCount += 1;
          continue;
        }

        if (!isCompatibleSourceType(sourceType, parsed.sourceType)) {
          sourceTypeMismatchCount += 1;
          continue;
        }

        const collectionName = getCollectionName(parsed.sourceType);
        const data = hydrated.get(`${collectionName}:${parsed.docId}`);
        if (!data) {
          missingDocCount += 1;
          continue;
        }
        if (data.spaceId !== spaceId) {
          spaceMismatchCount += 1;
          continue;
        }

        if (usedLibraryFallback && !matchesAllowedLibraries(data, requestedLibraryIds)) {
          libraryFilterDropCount += 1;
          continue;
        }

        results.push({
          id: parsed.docId,
          score: typeof neighbor.distance === 'number' ? 1 - neighbor.distance : 0.8,
          metadata: data,
        });
      }

      console.log('[VertexSearch] Hydration diagnostics:', {
        requestedSourceType: sourceType,
        nearestCount: nearest.length,
        hydratedDocCount: hydrated.size,
        missingDocCount,
        spaceMismatchCount,
        sourceTypeMismatchCount,
        usedLibraryFallback,
        requestedLibraryIdsCount: requestedLibraryIds.length,
        libraryFilterDropCount,
      });
      console.log(`[VertexSearch] Returning ${results.length} hydrated results`);
      return results;
    } catch (err) {
      console.error('[VertexSearch] Search failed:', err);
      return [];
    }
  }
}

export const vertexSearch = new VertexVectorSearchService();