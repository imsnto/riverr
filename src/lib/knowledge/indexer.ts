
import type { Firestore } from "firebase-admin/firestore";
import { chunkArticleHtml, estimateTokens } from "./chunking";
import type { HelpCenterChunk } from "./types";
import { typesense } from '@/lib/typesense';

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


  // Prepare chunks for Typesense
  const chunks: Omit<HelpCenterChunk, 'id'> & { id: string }[] = specs.map((c) => {
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

  if (chunks.length > 0) {
    try {
      // Using 'upsert' action and deterministic IDs handles cleanup of old/stale chunks automatically.
      await typesense.collections('bii_help_chunks').documents().import(chunks, { action: 'upsert' });
    } catch (e) {
      console.error("Failed to index chunks in Typesense:", e);
      // Depending on requirements, you might want to throw here to fail the reindex job.
    }
  }


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
