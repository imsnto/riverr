
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
  visibility?: string;
  allowedUserIds?: string[];
  intentKey?: string;
  description?: string;
};

/**
 * Searches the curated Help Center Articles index.
 * Tier 1: Highest Trust
 * Updated to fix cross-hub grounding issues by relaxing hubId filter
 * when specific libraries are targeted.
 */
export async function searchArticles(args: {
  query: string;
  hubId: string;
  spaceId: string;
  allowedHelpCenterIds?: string[];
  limit?: number;
}): Promise<VectorSearchResult[]> {
  const { query, hubId, spaceId, allowedHelpCenterIds, limit = 8 } = args;
  
  // PLUMBING: If a whitelist is provided but is empty, the agent has no grounded articles.
  if (allowedHelpCenterIds && allowedHelpCenterIds.length === 0) {
    return [];
  }

  const embedding = await generateQueryEmbedding(query);
  if (!embedding) return [];

  try {
    const coll = adminDB.collection('brain_chunks');
    
    // Base filters
    let q = (coll as any)
      .where('spaceId', '==', spaceId) // Essential for multi-tenant security
      .where('sourceType', '==', 'help_center_article')
      .where('status', '==', 'active');

    // Filter by specifically authorized help centers
    if (allowedHelpCenterIds && allowedHelpCenterIds.length > 0) {
      // FIX: If library IDs are provided, we search those specific libraries regardless of their hub.
      // This allows an Agent from Hub A to answer from its libraries when assigned to a Widget in Hub B.
      q = q.where('helpCenterId', 'in', allowedHelpCenterIds.slice(0, 10));
    } else {
      // If no explicit whitelist, default to searching the current hub's knowledge.
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
        text: data.text,
        title: data.title,
        url: data.url,
        sourceId: data.sourceId,
        sourceType: 'article',
        helpCenterId: data.helpCenterId,
        visibility: data.visibility || 'public',
        allowedUserIds: data.allowedUserIds || [],
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.8,
      };
    });
  } catch (err) {
    console.error('searchArticles failed:', err);
    return [];
  }
}

/**
 * Searches the semantic Topics index (recurring patterns).
 * Tier 2: Medium Trust
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
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.75,
      };
    });
  } catch (err) {
    console.error('searchTopics failed:', err);
    return [];
  }
}

/**
 * Searches the raw Insights index (learned memories).
 * Tier 3: Lower Trust / Internal Learning
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
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.7,
      };
    });
  } catch (err) {
    console.error('searchInsights failed:', err);
    return [];
  }
}
