
import type { Firestore } from "firebase-admin/firestore";
import { chunkArticleHtml, estimateTokens } from "./chunking";
import type { HelpCenterChunk } from "./types";

function safeSlug(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function indexHelpCenterArticleToChunks(args: {
  adminDB: Firestore;
  article: any; // your HelpCenterArticle shape
  spaceId: string;
  publicHelpBaseUrl: string;
}) {
  const { adminDB, article, spaceId, publicHelpBaseUrl } = args;

  const status = article.status;
  if (status !== "published") return { chunkCount: 0 };

  const hubId = article.hubId;
  const helpCenterIds: string[] = Array.isArray(article.helpCenterIds) ? article.helpCenterIds : [];
  if (!hubId || helpCenterIds.length === 0) return { chunkCount: 0 };

  const articleId = article.id;
  const articleTitle = article.title ?? "Untitled";
  const articleSubtitle = article.subtitle ?? null;
  const articleType = article.type ?? 'article';
  const isPublic = Boolean(article.isPublic);
  const allowedUserIds: string[] = Array.isArray(article.allowedUserIds) ? article.allowedUserIds : [];

  const slug = article.slug ?? safeSlug(articleTitle);
  const hc = helpCenterIds[0];
  const url =
    article.publicUrl
      ? (article.publicUrl.startsWith("http") ? article.publicUrl : `${publicHelpBaseUrl}${article.publicUrl}`)
      : `${publicHelpBaseUrl}/hc/${hc}/articles/${articleId}`;

  const specs = chunkArticleHtml({
    html: article.content ?? "",
    maxTokens: 220,
    overlapTokens: 60,
  });

  const now = new Date();
  const nowIso = now.toISOString();
  const nowEpoch = now.getTime();
  const articleUpdatedAtEpoch = article.updatedAt ? new Date(article.updatedAt).getTime() : nowEpoch;


  // Write chunks as: bii_help_chunks/{chunkId}
  // Stable IDs: `${articleId}__${order}`
  const chunks: HelpCenterChunk[] = specs.map((c) => {
    const anchor =
      c.headingPath.length
        ? safeSlug(c.headingPath.join("-")) + `-${c.chunkIndex}`
        : `chunk-${c.chunkIndex}`;

    return {
      id: `${articleId}__${c.chunkIndex}`,
      spaceId,
      hubId,
      helpCenterIds,
      articleId,
      articleTitle,
      articleSubtitle,
      articleType,
      chunkIndex: c.chunkIndex,
      headingPath: c.headingPath,
      anchor,
      text: c.text,
      charCount: c.text.length,
      tokenEstimate: estimateTokens(c.text),
      status: 'published',
      isPublic,
      allowedUserIds: isPublic ? [] : allowedUserIds,
      articleUpdatedAt: articleUpdatedAtEpoch,
      chunkUpdatedAt: nowEpoch,
      language: 'en',
      url: url + (anchor ? `#${anchor}` : ""),
    };
  });

  // Delete old chunks for this article (so edits don’t leave junk behind)
  const oldSnap = await adminDB
    .collection("bii_help_chunks")
    .where("articleId", "==", articleId)
    .limit(500)
    .get();

  // Batch delete + write
  let batch = adminDB.batch();
  let ops = 0;

  for (const doc of oldSnap.docs) {
    batch.delete(doc.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = adminDB.batch();
      ops = 0;
    }
  }

  for (const chunk of chunks) {
    const ref = adminDB.collection("bii_help_chunks").doc(chunk.id);
    batch.set(ref, chunk, { merge: true });
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = adminDB.batch();
      ops = 0;
    }
  }

  if (ops) await batch.commit();

  // Optional: write index metadata back to the article (helps debugging)
  await adminDB.collection("help_center_articles").doc(articleId).set(
    {
      chunkCount: chunks.length,
      chunkedAt: nowIso,
    },
    { merge: true }
  );

  return { chunkCount: chunks.length };
}
