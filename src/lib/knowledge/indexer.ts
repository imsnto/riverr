import type { Firestore } from "firebase-admin/firestore";
import admin from "firebase-admin";
import { chunkArticleHtml } from "./chunking";
import { generateDocumentEmbedding } from '@/lib/brain/embed';

function safeSlug(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Indexes a help center article into Firestore vector search.
 * Replaces Typesense-based indexing.
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

  const now = new Date().toISOString();
  const modelName = process.env.EMBEDDING_MODEL || 'gemini-embedding-2-preview';

  let chunkCount = 0;

  for (const c of specs) {
    const anchor = c.headingPath.length
        ? safeSlug(c.headingPath.join("-")) + `-${c.chunkIndex}`
        : `chunk-${c.chunkIndex}`;

    const url = article.publicUrl
      ? (article.publicUrl.startsWith("http") ? article.publicUrl : `${publicHelpBaseUrl}${article.publicUrl}`)
      : `${publicHelpBaseUrl}/hc/${helpCenterId}/articles/${articleId}`;

    // GENERATE VECTOR (2048-dim)
    const embedding = await generateDocumentEmbedding(c.text);

    if (embedding) {
        const chunkData = {
            hubId,
            spaceId,
            sourceType: 'help_center_article',
            sourceId: articleId,
            helpCenterId,
            title: articleTitle,
            text: c.text,
            url: url + (anchor ? `#${anchor}` : ""),
            visibility: article.visibility || 'public',
            allowedUserIds: article.allowedUserIds || [],
            status: 'active',
            embedding: (admin.firestore.FieldValue as any).vector(embedding),
            embeddingModel: modelName,
            embeddingDim: 2048,
            createdAt: now,
            updatedAt: now,
            headingPath: c.headingPath,
            chunkIndex: c.chunkIndex,
        };

        // Standard Firestore write
        await adminDB.collection('brain_chunks').add(chunkData);
        chunkCount++;
    }
  }

  // Update index metadata
  await adminDB.collection("help_center_articles").doc(articleId).set(
    {
      chunkCount: chunkCount,
      chunkedAt: now,
    },
    { merge: true }
  );

  return { chunkCount };
}
