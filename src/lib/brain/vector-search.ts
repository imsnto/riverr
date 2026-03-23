import { adminDB } from '@/lib/firebase-admin';
import { generateQueryEmbedding } from '@/lib/brain/embed';
import admin from 'firebase-admin';

export type VectorSearchResult = {
  id: string;
  text: string;
  title?: string;
  url?: string;
  score: number;
  sourceId?: string;
  helpCenterId?: string | null;
  visibility?: string;
  allowedUserIds?: string[];
};

/**
 * Firestore-native vector search
 * STRICTLY scoped to hubId for multi-tenant isolation.
 */
export async function searchBrainChunks(args: {
  query: string;
  hubId: string;
  limit?: number;
}): Promise<VectorSearchResult[]> {
  const { query, hubId, limit = 8 } = args;

  if (!query?.trim()) return [];

  // 1. Generate query embedding (normalized 2048-dim)
  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    // 2. Firestore vector search using findNearest
    const coll = adminDB.collection('brain_chunks');
    const vectorQuery = (coll as any)
      .where('hubId', '==', hubId)
      .where('status', '==', 'active')
      .findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(embedding),
        limit: Math.min(limit * 3, 30), // Fetch more for post-filtering if needed
        distanceMeasure: 'COSINE',
      });

    const snap = await vectorQuery.get();

    return snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text,
        title: data.title,
        url: data.url,
        sourceId: data.sourceId,
        helpCenterId: data.helpCenterId,
        visibility: data.visibility || 'public',
        allowedUserIds: data.allowedUserIds || [],
        // distance is returned in search metadata
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.7,
      };
    });
  } catch (error) {
    console.error('Firestore vector search failed:', error);
    return [];
  }
}

/**
 * Searches the distilled support QAs memory.
 */
export async function searchSupportMemory(args: {
  query: string;
  hubId: string;
  limit?: number;
}) {
  const { query, hubId, limit = 5 } = args;
  if (!query?.trim()) return [];

  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    const coll = adminDB.collection('brain_distilled_qas');
    const vectorQuery = (coll as any)
      .where('hubId', '==', hubId)
      .where('status', '==', 'approved')
      .findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(embedding),
        limit,
        distanceMeasure: 'COSINE',
      });

    const snap = await vectorQuery.get();

    return snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        intentKey: data.intentKey || doc.id,
        title: data.question,
        description: data.answer,
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.8,
      };
    });
  } catch (error) {
    console.error('Support memory search failed:', error);
    return [];
  }
}
