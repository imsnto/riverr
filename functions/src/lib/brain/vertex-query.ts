import { MatchServiceClient, protos } from '@google-cloud/aiplatform';

const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const ENDPOINT_RESOURCE_NAME = process.env.VERTEX_VECTOR_INDEX_ENDPOINT_RESOURCE_NAME || '';
const DEPLOYED_INDEX_ID = process.env.VERTEX_VECTOR_DEPLOYED_INDEX_ID || '';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_VECTOR_PUBLIC_ENDPOINT_DOMAIN || '';

export interface VertexNeighbor {
  datapointId: string;
  score: number;
}

export interface VertexQueryParams {
  queryVector: number[];
  sourceType: 'insight' | 'topic' | 'article' | 'help_center_article' | 'chunk';
  spaceId: string;
  hubId?: string | null;
  signalLevels?: Array<'low' | 'medium' | 'high'>;
  limit?: number;
}

let matchClientInstance: MatchServiceClient | null = null;

function getMatchClient(): MatchServiceClient {
  if (!matchClientInstance) {
    matchClientInstance = new MatchServiceClient({
      apiEndpoint: PUBLIC_ENDPOINT_DOMAIN || `${location}-aiplatform.googleapis.com`,
    });
  }
  return matchClientInstance;
}

export async function queryVertexNeighbors(params: VertexQueryParams): Promise<VertexNeighbor[]> {
  if (!ENDPOINT_RESOURCE_NAME || !DEPLOYED_INDEX_ID || !PUBLIC_ENDPOINT_DOMAIN) {
    console.warn('[vertex-query] Missing endpoint env vars — skipping Vertex query');
    return [];
  }

  try {
    const restricts: protos.google.cloud.aiplatform.v1.IndexDatapoint.IRestriction[] = [
      { namespace: 'sourceType', allowList: [params.sourceType] },
      { namespace: 'spaceId', allowList: [params.spaceId] },
    ];

    if (params.hubId) {
      restricts.push({ namespace: 'hubId', allowList: [params.hubId] });
    }

    if (params.signalLevels && params.signalLevels.length > 0) {
      restricts.push({ namespace: 'signalLevel', allowList: params.signalLevels });
    }

    const query = new protos.google.cloud.aiplatform.v1.FindNeighborsRequest.Query({
      datapoint: new protos.google.cloud.aiplatform.v1.IndexDatapoint({
        datapointId: 'query',
        featureVector: params.queryVector,
        restricts: restricts.map(
          (r) =>
            new protos.google.cloud.aiplatform.v1.IndexDatapoint.Restriction({
              namespace: r.namespace,
              allowList: r.allowList,
            })
        ),
      }),
      neighborCount: params.limit ?? 10,
    });

    const client = getMatchClient();
    const [response] = await client.findNeighbors({
      indexEndpoint: ENDPOINT_RESOURCE_NAME,
      deployedIndexId: DEPLOYED_INDEX_ID,
      queries: [query],
      returnFullDatapoint: false,
    });

    const nearestNeighbors = response.nearestNeighbors?.[0]?.neighbors ?? [];

    return nearestNeighbors
      .map((n) => ({
        datapointId: n.datapoint?.datapointId ?? '',
        score: 1 - (n.distance ?? 1),
      }))
      .filter((n) => n.datapointId !== '');
  } catch (err) {
    console.error('[vertex-query] findNeighbors failed:', err);
    return [];
  }
}
