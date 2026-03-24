
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
  sourceType?: string;
  helpCenterId?: string | null;
  libraryId?: string | null;
  visibility?: string;
  allowedUserIds?: string[];
  intentKey?: string;
  description?: string;
};

/**
 * Searches the canonical curated Articles index.
 * Tier 1: Highest Trust (Promoted Documentation)
 */
export async function searchArticles(args: {
  query: string;
  hubId: string;
  spaceId: string;
  allowedLibraryIds?: string[];
  limit?: number;
}): Promise<VectorSearchResult[]> {
  const { query, hubId, spaceId, allowedLibraryIds, limit = 8 } = args;
  
  if (allowedLibraryIds && allowedLibraryIds.length === 0) {
    return [];
  }

  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    // Search the canonical articles collection
    const coll = adminDB.collection('articles');
    
    let q = (coll as any)
      .where('spaceId', '==', spaceId)
      .where('status', '==', 'published');

    if (allowedLibraryIds && allowedLibraryIds.length > 0) {
      q = q.where('destinationLibraryId', 'in', allowedLibraryIds.slice(0, 10));
    } else {
      q = q.where('hubId', '==', hubId);
    }

    const vectorQuery = q.findNearest({
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
        text: data.body,
        title: data.title,
        sourceType: 'article',
        libraryId: data.destinationLibraryId,
        visibility: data.visibility || 'public',
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.85,
      };
    });
  } catch (err) {
    console.error('searchArticles failed:', err);
    return [];
  }
}

/**
 * Searches the semantic Topics index.
 * Tier 2: Medium Trust (Grouped Intelligence)
 */
export async function searchTopics(args: {
  query: string;
  spaceId: string;
  limit?: number;
}): Promise<VectorSearchResult[]> {
  const { query, spaceId, limit = 5 } = args;
  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    const coll = adminDB.collection('topics');
    const vectorQuery = (coll as any)
      .where('spaceId', '==', spaceId)
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
        title: data.title,
        text: data.summary || data.title,
        sourceType: 'topic',
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.8,
      };
    });
  } catch (err) {
    console.error('searchTopics failed:', err);
    return [];
  }
}

/**
 * Searches individual Insights.
 * Tier 3: Supporting Internal Signal
 */
export async function searchInsights(args: {
  query: string;
  hubId: string;
  limit?: number;
}): Promise<VectorSearchResult[]> {
  const { query, hubId, limit = 5 } = args;
  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    const coll = adminDB.collection('insights');
    const vectorQuery = (coll as any)
      .where('hubId', '==', hubId)
      .where('processingStatus', '==', 'completed')
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
        title: data.title,
        text: data.content,
        sourceType: 'insight',
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.75,
      };
    });
  } catch (err) {
    console.error('searchInsights failed:', err);
    return [];
  }
}
