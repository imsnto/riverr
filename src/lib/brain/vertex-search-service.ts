
/**
 * @fileOverview Vertex AI Vector Search Service.
 * Implements the live production retrieval path for all knowledge corpora.
 */

import { generateQueryEmbedding } from './embed';
import { adminDB } from '../firebase-admin';
import admin from 'firebase-admin';

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

class VertexVectorSearchService {
  /**
   * Orchestrates semantic search via text-embedding-004 and Vertex AI Vector Search logic.
   * Standardizes on Firestore metadata hydration.
   */
  async search(params: SearchParams): Promise<VectorSearchResult[]> {
    const { query, sourceType, spaceId, hubId, libraryIds, visibility, limit = 10 } = params;

    console.log(`[VertexSearch] Searching ${sourceType} for query: "${query.substring(0, 40)}..."`);

    // 1. Generate Query Embedding
    const queryVector = await generateQueryEmbedding(query);
    if (!queryVector) {
      console.warn(`[VertexSearch] Failed to generate query embedding.`);
      return [];
    }

    try {
      /**
       * 🔥 PRODUCTION RULE: Vertex AI Vector Search is the backend.
       * We use Firestore's findNearest which is the SDK-native entry point for the integrated Vertex backend.
       */
      const collectionName = this.getCollectionName(sourceType);
      const collectionRef = adminDB.collection(collectionName);

      let q = (collectionRef as any).where('spaceId', '==', spaceId);

      // Apply metadata filters
      if (hubId) q = q.where('hubId', '==', hubId);
      if (visibility) q = q.where('visibility', '==', visibility);
      if (libraryIds && libraryIds.length > 0) {
        q = q.where('destinationLibraryId', 'in', libraryIds.slice(0, 10));
      }

      const vectorQuery = q.findNearest({
        vectorField: 'embedding',
        queryVector: admin.firestore.FieldValue.vector(queryVector),
        limit,
        distanceMeasure: 'COSINE',
      });

      const snap = await vectorQuery.get();
      
      console.log(`[VertexSearch] ${sourceType} search returned ${snap.docs.length} candidates.`);

      return snap.docs.map((doc: any) => ({
        id: doc.id,
        score: typeof doc.distance === 'number' ? 1 - doc.distance : 0.8,
        metadata: doc.data(),
      }));
    } catch (err) {
      console.error(`[VertexSearch] ${sourceType} search failed:`, err);
      return [];
    }
  }

  private getCollectionName(sourceType: VectorSourceType): string {
    switch (sourceType) {
      case 'article': return 'articles';
      case 'topic': return 'topics';
      case 'insight': return 'insights';
      case 'chunk': return 'source_chunks';
      default: throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }
}

export const vertexSearch = new VertexVectorSearchService();
