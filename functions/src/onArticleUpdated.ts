import * as admin from 'firebase-admin';
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Trigger: When a Document (Article) is updated.
 * Auto-indexes to Vertex AI when:
 * 1. Status changes to 'published'
 * 2. Content changes on an already published article
 */
export const onArticleUpdated = onDocumentUpdated(
  {
    document: 'documents/{articleId}',
    memory: '512MiB',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const articleId = event.params.articleId;

    if (!before || !after) {
      logger.warn(`[Article:${articleId}] Missing before/after data`);
      return;
    }

    const spaceId = after.spaceId;
    const hubId = after.hubId;

    if (!spaceId || !hubId) {
      logger.warn(`[Article:${articleId}] Missing spaceId or hubId`);
      return;
    }

    // Case 1: Status changed to 'published'
    const becamePublished = before.isPublic !== true && after.isPublic === true;
    
    // Case 2: Content changed on published article
    const contentChangedOnPublished = 
      after.isPublic === true && 
      (before.content !== after.content || before.name !== after.name);

    if (!becamePublished && !contentChangedOnPublished) {
      logger.info(`[Article:${articleId}] No indexing needed`);
      return;
    }

    logger.info(`[Article:${articleId}] Triggering Vertex AI reindex - becamePublished:${becamePublished}, contentChanged:${contentChangedOnPublished}`);

    try {
      // Enqueue Vertex AI indexing job
      await db.collection('brain_jobs').add({
        type: 'process_vector_indexing',
        status: 'pending',
        params: {
          sourceType: 'article',
          sourceId: articleId,
          spaceId: spaceId,
          hubId: hubId,
          text: `${after.name}\n\n${after.content || ''}`,  // Full text for embedding
          visibility: after.isPublic ? 'public' : 'private'
        },
        createdAt: new Date().toISOString()
      });

      logger.info(`[Article:${articleId}] Enqueued Vertex AI indexing job`);

      // 3. Update article metadata
      await event.data!.after.ref.update({
        lastIndexedAt: new Date().toISOString(),
        indexedBy: 'vertex-ai-auto-indexer-v3',
      });

    } catch (error: any) {
      logger.error(`[Article:${articleId}] Failed to enqueue indexing job`, error);
      
      // Update article with error status
      await event.data!.after.ref.update({
        indexError: error?.message || 'Unknown error',
        lastIndexAttempt: new Date().toISOString(),
      });
    }
  }
);

/**
 * Trigger: When a Document (Article) is deleted.
 * Note: Actual Vertex AI deletion should be handled by a separate cleanup job
 * or when the brain_job processes and detects the source is gone.
 */
export const onArticleDeleted = onDocumentDeleted(
  {
    document: 'documents/{articleId}',
    memory: '512MiB',
  },
  async (event) => {
    const articleId = event.params.articleId;
    
    logger.info(`[Article:${articleId}] Article deleted, enqueueing cleanup job`);

    try {
      // Enqueue a cleanup job for Vertex AI
      await db.collection('brain_jobs').add({
        type: 'process_vector_deletion',
        status: 'pending',
        params: {
          sourceType: 'article',
          sourceId: articleId,
        },
        createdAt: new Date().toISOString()
      });

      logger.info(`[Article:${articleId}] Enqueued Vertex AI cleanup job`);
    } catch (error: any) {
      logger.error(`[Article:${articleId}] Failed to enqueue cleanup job`, error);
    }
  }
);
