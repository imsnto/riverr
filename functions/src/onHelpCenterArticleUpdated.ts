import * as admin from 'firebase-admin';
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Trigger: When a help center article is updated.
 * Auto-indexes the article when:
 * 1. Status changes to 'published'
 * 2. Content changes on an already published article
 */
export const onHelpCenterArticleUpdated = onDocumentUpdated(
  {
    document: 'help_center_articles/{articleId}',
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

    const hubId = after.hubId;
    const spaceId = after.spaceId;

    if (!hubId || !spaceId) {
      logger.warn(`[Article:${articleId}] Missing hubId or spaceId`);
      return;
    }

    // Case 1: Status changed to 'published'
    const becamePublished = before.status !== 'published' && after.status === 'published';
    
    // Case 2: Content changed on published article
    const contentChangedOnPublished = 
      after.status === 'published' && 
      (before.content !== after.content || before.title !== after.title);

    if (!becamePublished && !contentChangedOnPublished) {
      logger.info(`[Article:${articleId}] No indexing needed`);
      return;
    }

    logger.info(`[Article:${articleId}] Triggering reindex - becamePublished:${becamePublished}, contentChanged:${contentChangedOnPublished}`);

    try {
      // 1. Delete existing chunks for this article
      const existingChunks = await db
        .collection('brain_chunks')
        .where('sourceId', '==', articleId)
        .get();
      
      if (!existingChunks.empty) {
        const batch = db.batch();
        existingChunks.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        logger.info(`[Article:${articleId}] Deleted ${existingChunks.size} existing chunks`);
      }

      // 2. Enqueue Vertex AI indexing job if published
      if (after.status === 'published') {
        const jobData: any = {
          type: 'process_vector_indexing',
          status: 'pending',
          params: {
            sourceType: 'help_center_article',
            sourceId: articleId,
            spaceId: spaceId,
            hubId: hubId,
            text: `${after.title}\n\n${after.content || ''}`,
            title: after.title,
          },
          createdAt: new Date().toISOString(),
        };
        
        // Only add url if slug exists (Firestore doesn't accept undefined)
        if (after.slug) {
          jobData.params.url = `${process.env.PUBLIC_HELP_BASE_URL || ''}/hc/${after.slug}`;
        }
        
        await db.collection('brain_jobs').add(jobData);
        
        logger.info(`[Article:${articleId}] Enqueued Vertex AI indexing job`);
      }

      // 3. Update article metadata
      await event.data!.after.ref.update({
        lastIndexedAt: new Date().toISOString(),
        indexedBy: 'auto-indexer-v3',
      });

    } catch (error: any) {
      logger.error(`[Article:${articleId}] Indexing failed`, error);
      
      // Update article with error status
      await event.data!.after.ref.update({
        indexError: error?.message || 'Unknown error',
        lastIndexAttempt: new Date().toISOString(),
      });
    }
  }
);

/**
 * Trigger: When a help center article is deleted.
 * Cleans up all associated brain_chunks.
 */
export const onHelpCenterArticleDeleted = onDocumentDeleted(
  {
    document: 'help_center_articles/{articleId}',
    memory: '512MiB',
  },
  async (event) => {
    const articleId = event.params.articleId;
    
    logger.info(`[Article:${articleId}] Article deleted, cleaning up chunks`);

    try {
      const chunksSnapshot = await db
        .collection('brain_chunks')
        .where('sourceId', '==', articleId)
        .get();

      if (chunksSnapshot.empty) {
        logger.info(`[Article:${articleId}] No chunks to delete`);
        return;
      }

      const batch = db.batch();
      chunksSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      logger.info(`[Article:${articleId}] Deleted ${chunksSnapshot.size} chunks`);
    } catch (error: any) {
      logger.error(`[Article:${articleId}] Failed to delete chunks`, error);
    }
  }
);
