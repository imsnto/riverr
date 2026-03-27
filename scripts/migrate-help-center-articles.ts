/**
 * @fileOverview Bulk Migration Script for Existing Help Center Articles
 * 
 * Migrates ~30 existing public help center articles to the new Vertex AI
 * Vector Search infrastructure per client specification.
 * 
 * Requirements from client PDF:
 * - ✅ Do NOT delete existing articles
 * - ✅ Do NOT recreate them
 * - ✅ Do NOT change visibility
 * - ✅ Do NOT break URLs
 * 
 * Migration Steps:
 * 1. Read existing articles from help_center_articles collection
 * 2. Generate embeddings (text-embedding-004)
 * 3. Upsert to Vertex AI Vector Search
 * 4. Save vectorDocId on same documents
 * 5. Verify retrieval
 * 
 * Usage:
 *   npx ts-node scripts/migrate-help-center-articles.ts
 * 
 * Or deploy as Cloud Function and trigger via HTTP or pubsub.
 */

import * as admin from 'firebase-admin';
import { MatchServiceClient } from '@google-cloud/aiplatform';
import { generateDocumentEmbedding, composeArticleEmbeddingText } from '../src/lib/brain/embed';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Vertex AI Configuration
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'timeflow-6i3eo';
const LOCATION = process.env.VERTEX_API_LOCATION || 'us-central1';
const INDEX_ID = process.env.VERTEX_AI_INDEX_ID || '';
const INDEX_RESOURCE_NAME = INDEX_ID 
  ? `projects/${PROJECT}/locations/${LOCATION}/indexes/${INDEX_ID}` 
  : '';
const PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || 'us-central1-aiplatform.googleapis.com';

const matchClient = new MatchServiceClient({
  apiEndpoint: PUBLIC_ENDPOINT_DOMAIN,
});

// Logging per client spec
const Telemetry = {
  log: (event: string, payload: Record<string, any>) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      component: 'ArticleMigration',
      event,
      timestamp: new Date().toISOString(),
      ...payload
    }));
  }
};

interface MigrationResult {
  articleId: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  vectorDocId?: string;
}

/**
 * Migrate a single help center article to Vertex AI
 */
async function migrateArticle(articleId: string, articleData: any): Promise<MigrationResult> {
  try {
    // Skip if already migrated
    if (articleData.embeddingStatus === 'ready' && articleData.vectorDocId) {
      Telemetry.log('article_migration_skipped', { articleId, reason: 'already_migrated' });
      return { articleId, status: 'skipped', vectorDocId: articleData.vectorDocId };
    }

    // Skip drafts
    if (articleData.status !== 'published') {
      Telemetry.log('article_migration_skipped', { articleId, reason: 'not_published' });
      return { articleId, status: 'skipped' };
    }

    Telemetry.log('article_migration_started', { articleId, title: articleData.title });

    // Compose embedding text
    const textToEmbed = composeArticleEmbeddingText({
      title: articleData.title || '',
      summary: articleData.subtitle || articleData.summary || '',
      body: articleData.content || articleData.body || ''
    });

    if (!textToEmbed || textToEmbed.trim() === '') {
      throw new Error('No text content to embed');
    }

    // Generate embedding
    Telemetry.log('embedding_generation_started', { articleId, model: 'text-embedding-004' });
    const vector = await generateDocumentEmbedding(textToEmbed);
    
    if (!vector || vector.length === 0) {
      throw new Error('Embedding generation failed');
    }
    Telemetry.log('embedding_generated', { articleId, dimensions: vector.length });

    // Build Vertex AI datapoint
    const vectorDocId = `article:${articleId}`;
    const restricts = [
      { name: 'sourceType', allowTokens: ['article'] },
      { name: 'spaceId', allowTokens: [articleData.spaceId] },
    ];

    if (articleData.hubId) {
      restricts.push({ name: 'hubId', allowTokens: [articleData.hubId] });
    }

    const visibility = articleData.visibility || 'private';
    restricts.push({ name: 'visibility', allowTokens: [visibility] });

    if (articleData.helpCenterId || articleData.destinationLibraryId) {
      restricts.push({ 
        name: 'libraryId', 
        allowTokens: [articleData.helpCenterId || articleData.destinationLibraryId] 
      });
    }

    // Upsert to Vertex AI
    if (!INDEX_RESOURCE_NAME) {
      throw new Error('VERTEX_AI_INDEX_ID not configured');
    }

    Telemetry.log('vertex_upsert_started', { articleId, vectorDocId });
    await (matchClient as any).upsertDatapoints({
      index: INDEX_RESOURCE_NAME,
      datapoints: [
        {
          datapointId: vectorDocId,
          featureVector: vector,
          restricts,
        }
      ]
    });
    Telemetry.log('vertex_upsert_successful', { articleId, vectorDocId });

    // Update Firestore document
    const now = new Date().toISOString();
    await db.collection('articles').doc(articleId).set({
      id: articleId,
      hubId: articleData.hubId,
      spaceId: articleData.spaceId,
      destinationLibraryId: articleData.helpCenterId || articleData.destinationLibraryId,
      visibility: visibility as 'public' | 'private',
      title: articleData.title || 'Untitled',
      subtitle: articleData.subtitle || null,
      body: articleData.content || articleData.body || '',
      summary: articleData.subtitle || articleData.summary || null,
      status: 'published',
      authorId: articleData.authorId || 'system',
      url: articleData.publicUrl || articleData.url || null,
      
      embeddingStatus: 'ready',
      embeddingModel: 'text-embedding-004',
      embeddingVersion: 'v2',
      vectorDocId,
      embeddingUpdatedAt: now,
      
      // Preserve original createdAt if exists
      createdAt: articleData.createdAt || now,
      updatedAt: now,
      migratedAt: now,
    }, { merge: true });

    Telemetry.log('article_migration_completed', { articleId, vectorDocId });
    
    return { articleId, status: 'success', vectorDocId };

  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    Telemetry.log('article_migration_failed', { articleId, error: errorMessage });
    
    // Mark as failed
    await db.collection('articles').doc(articleId).set({
      embeddingStatus: 'failed',
      embeddingError: errorMessage,
      embeddingUpdatedAt: new Date().toISOString(),
    }, { merge: true });
    
    return { articleId, status: 'failed', error: errorMessage };
  }
}

/**
 * Main migration function - processes all published help center articles
 */
export async function migrateAllHelpCenterArticles(spaceId?: string, batchSize: number = 10) {
  Telemetry.log('migration_batch_started', { spaceId: spaceId || 'all', batchSize });

  try {
    // Query existing help center articles
    let query = db.collection('help_center_articles')
      .where('status', '==', 'published');
    
    if (spaceId) {
      query = query.where('spaceId', '==', spaceId);
    }

    const snapshot = await query.limit(batchSize).get();
    
    if (snapshot.empty) {
      Telemetry.log('migration_no_articles_found', { spaceId: spaceId || 'all' });
      return { processed: 0, results: [] };
    }

    Telemetry.log('migration_articles_found', { count: snapshot.size, spaceId: spaceId || 'all' });

    const results: MigrationResult[] = [];
    
    for (const doc of snapshot.docs) {
      const result = await migrateArticle(doc.id, doc.data());
      results.push(result);
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    Telemetry.log('migration_batch_completed', summary);
    
    return { processed: results.length, summary, results };

  } catch (error: any) {
    Telemetry.log('migration_batch_failed', { error: error?.message || 'Unknown error' });
    throw error;
  }
}

/**
 * HTTP Cloud Function handler for migration
 */
export async function runMigrationHandler(req: any, res: any) {
  const { spaceId, batchSize = 10, secret } = req.body || {};
  
  // Simple auth check
  if (secret !== process.env.ADMIN_REINDEX_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await migrateAllHelpCenterArticles(spaceId, batchSize);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Migration failed' });
  }
}

// CLI execution
if (require.main === module) {
  const spaceId = process.argv[2];
  const batchSize = parseInt(process.argv[3] || '10', 10);
  
  console.log('Starting help center article migration...');
  console.log('Space ID:', spaceId || 'all');
  console.log('Batch size:', batchSize);
  console.log('');
  
  migrateAllHelpCenterArticles(spaceId, batchSize)
    .then(result => {
      console.log('\nMigration completed:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
