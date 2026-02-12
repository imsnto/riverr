

import type { Firestore } from "firebase-admin/firestore";
import { chunkArticleHtml, estimateTokens } from "./chunking";
import { getTypesenseAdmin } from '@/lib/typesense';

const typesense = getTypesenseAdmin();

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
  const helpCenterId: string = article.helpCenterId;
  if (!hubId || !helpCenterId) return { chunkCount: 0 };

  const articleId = article.id;
  const articleTitle = article.title ?? "Untitled";
  const articleType = article.type ?? 'article';
  const isPublic = Boolean(article.isPublic);
  const allowedUserIds: string[] = Array.isArray(article.allowedUserIds) ? article.allowedUserIds : [];
  const language = article.language || 'en';

  const slug = article.slug ?? safeSlug(articleTitle);
  const hc = helpCenterId;
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
  const nowEpoch = now.getTime();
  const articleCreatedAtEpoch = article.createdAt ? new Date(article.createdAt).getTime() : nowEpoch;
  const articleUpdatedAtEpoch = article.updatedAt ? new Date(article.updatedAt).getTime() : nowEpoch;


  // Prepare chunks for Typesense
  const chunks = specs.map((c) => {
    const anchor =
      c.headingPath.length
        ? safeSlug(c.headingPath.join("-")) + `-${c.chunkIndex}`
        : `chunk-${c.chunkIndex}`;

    return {
      id: `${articleId}__${c.chunkIndex}`,
      type: 'doc',
      spaceId,
      hubId,
      sourceId: articleId,
      
      title: articleTitle,
      text: c.text,
      tags: article.tags || [],

      status: 'published',
      url: url + (anchor ? `#${anchor}` : ""),
      language,
      
      isPublic,
      allowedUserIds: isPublic ? [] : allowedUserIds,
      
      sourceCreatedAt: articleCreatedAtEpoch,
      sourceUpdatedAt: articleUpdatedAtEpoch,
      indexedAt: nowEpoch,

      // Doc-specific context
      helpCenterId,
      headingPath: c.headingPath,
      content: article.type === 'playbook' ? article.content : undefined,
      articleType: article.type,
    };
  });

  if (chunks.length > 0) {
    try {
      // Using 'upsert' action and deterministic IDs handles cleanup of old/stale chunks automatically.
      await typesense.collections('memory_nodes').documents().import(chunks, { action: 'upsert' });
    } catch (e) {
      console.error("Failed to index chunks in Typesense:", e);
      // Depending on requirements, you might want to throw here to fail the reindex job.
    }
  }


  // Optional: write index metadata back to the article (helps debugging)
  await adminDB.collection("help_center_articles").doc(articleId).set(
    {
      chunkCount: chunks.length,
      chunkedAt: now.toISOString(),
    },
    { merge: true }
  );

  return { chunkCount: chunks.length };
}

    