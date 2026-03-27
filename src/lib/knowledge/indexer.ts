import type { Firestore } from "firebase-admin/firestore";

/**
 * Indexes a help center article into the canonical Vertex-backed `articles` index.
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

  const now = new Date().toISOString();

  // Normalize a single canonical "article doc" that VertexQueue can embed.
  // This replaces legacy `brain_chunks` + `FieldValue.vector(...)` writes.
  const url = article.publicUrl
    ? (String(article.publicUrl).startsWith("http") ? String(article.publicUrl) : `${publicHelpBaseUrl}${article.publicUrl}`)
    : `${publicHelpBaseUrl}/hc/${helpCenterId}/articles/${articleId}`;

  const destinationLibraryId = helpCenterId;
  const visibility = (article.visibility === "public" ? "public" : "private") as "public" | "private";

  // Preserve createdAt if the doc exists already.
  const existingSnap = await adminDB.collection("articles").doc(articleId).get();
  const existingCreatedAt = existingSnap.exists ? (existingSnap.data()?.createdAt as string | undefined) : undefined;
  const createdAt = existingCreatedAt || now;

  await adminDB.collection("articles").doc(articleId).set(
    {
      id: articleId,
      hubId,
      spaceId,
      destinationLibraryId,
      visibility,
      title: articleTitle,
      subtitle: article.subtitle ?? null,
      body: article.content ?? "",
      summary: article.subtitle ?? null,
      status: "published",
      authorId: article.authorId ?? "system",
      // Expose URL to match existing retrieval mapping (`url`/`slug`)
      url,

      embeddingStatus: "pending",
      embeddingModel: "text-embedding-004",
      embeddingVersion: "v2",
      vectorDocId: null,
      embeddingUpdatedAt: null,

      createdAt,
      updatedAt: now,
    },
    { merge: true }
  );

  // Keep legacy metadata fields updated for existing UI/dashboard pages.
  await adminDB.collection("help_center_articles").doc(articleId).set(
    {
      chunkCount: 1,
      chunkedAt: now,
    },
    { merge: true }
  );

  return { chunkCount: 1 };
}
