import type { Firestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { chunkArticleHtml } from "./chunking";
import { generateDocumentEmbedding } from '@/lib/brain/embed';

/**
 * ⚠️ DEPRECATED: Firestore brain_chunks indexing is being phased out in favor of Vertex AI Vector Search.
 * 
 * This function is kept for backward compatibility during migration.
 * New code should use the unified Vertex AI indexing via brain_jobs collection.
 * 
 * Migration plan:
 * 1. Articles are now indexed to Vertex AI via onArticleUpdated cloud function
 * 2. Topics and Insights already use Vertex AI via processBrainJob
 * 3. After full migration, this file will be removed
 * 
 * See: @/functions/src/onArticleUpdated.ts for new implementation
 */

function safeSlug(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Indexes a help center article into Firestore vector search.
 */
export async function indexHelpCenterArticleToChunks(args: {
  adminDB: Firestore;
  article: any; // HelpCenterArticle
  spaceId: string;
  publicHelpBaseUrl: string;
}) {
  const { adminDB, article, spaceId, publicHelpBaseUrl } = args;

  const status = article.status;
  if (status !== "published") return { chunkCount: 0 };

  const hubId = article.hubId;
  const helpCenterId: string = article.helpCenterId;
  if (!hubId || !helpCenterId) return { chunkCount: 0 };

  const articleId = article.id;
  const articleTitle = article.title ?? "Untitled";
  
  const specs = chunkArticleHtml({
    html: article.content ?? "",
    maxTokens: 220,
    overlapTokens: 60,
  });

  console.log(`INDEXER: Processing article ${articleId} into ${specs.length} specs`);

  const modelName = process.env.EMBEDDING_MODEL || 'gemini-embedding-2-preview';

  // FIX 4: Parallelize embedding generation for 5-10x speedup
  console.log(`INDEXER: Generating ${specs.length} embeddings in parallel...`);
  const results = await Promise.all(
    specs.map(async (c) => {
      try {
        const embedding = await generateDocumentEmbedding(c.text);
        return { spec: c, embedding };
      } catch (err) {
        console.error(`INDEXER: Embedding failed for chunk ${c.chunkIndex} of article ${articleId}`, err);
        return { spec: c, embedding: null };
      }
    })
  );

  let chunkCount = 0;

  for (const { spec, embedding } of results) {
    if (!embedding) continue;

    const anchor = spec.headingPath.length
        ? safeSlug(spec.headingPath.join("-")) + `-${spec.chunkIndex}`
        : `chunk-${spec.chunkIndex}`;

    const url = article.publicUrl
      ? (article.publicUrl.startsWith("http") ? article.publicUrl : `${publicHelpBaseUrl}${article.publicUrl}`)
      : `${publicHelpBaseUrl}/hc/${helpCenterId}/articles/${articleId}`;

    const chunkData = {
        hubId,
        spaceId,
        sourceType: 'help_center_article',
        sourceId: articleId,
        helpCenterId,
        title: articleTitle,
        text: spec.text,
        url: url + (anchor ? `#${anchor}` : ""),
        visibility: article.visibility || 'public',
        allowedUserIds: article.allowedUserIds || [],
        status: 'active',
        // Firestore Vector write
        embedding: (admin.firestore.FieldValue as any).vector(embedding),
        embeddingModel: modelName,
        embeddingDim: 1536,
        // FIX 5: Use serverTimestamp for accurate ordering
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        headingPath: spec.headingPath?.filter((h): h is string => typeof h === 'string') || [],
        chunkIndex: spec.chunkIndex,
    };

    await adminDB.collection('brain_chunks').add(chunkData);
    chunkCount++;
  }

  // Update index metadata
  await adminDB.collection("help_center_articles").doc(articleId).set(
    {
      chunkCount: chunkCount,
      chunkedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log(`INDEXER: Successfully indexed ${chunkCount} chunks for ${articleId}`);
  return { chunkCount };
}
