
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";
import { indexHelpCenterArticleToChunks } from "@/lib/knowledge/indexer";
import { getTypesenseAdmin } from "@/lib/typesense";

const typesense = getTypesenseAdmin();
const REINDEX_SECRET = process.env.ADMIN_REINDEX_SECRET;

const PUBLIC_HELP_BASE_URL = process.env.PUBLIC_HELP_BASE_URL || "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev";

const typesenseMemoryNodeSchema = {
  "name": "memory_nodes",
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "type", "type": "string", "facet": true },
    { "name": "spaceId", "type": "string", "facet": true },
    { "name": "hubId", "type": "string", "optional": true },
    { "name": "helpCenterIds", "type": "string[]", "facet": true, "optional": true },
    { "name": "articleId", "type": "string", "facet": true, "optional": true },
    { "name": "articleTitle", "type": "string", "optional": true },
    { "name": "articleSubtitle", "type": "string", "optional": true },
    { "name": "articleType", "type": "string", "facet": true, "optional": true },
    { "name": "language", "type": "string", "facet": true, "default": "en" },
    { "name": "chunkIndex", "type": "int32", "optional": true },
    { "name": "headingPath", "type": "string[]", "optional": true },
    { "name": "anchor", "type": "string", "optional": true },
    { "name": "text", "type": "string" },
    { "name": "content", "type": "string", "optional": true },
    { "name": "charCount", "type": "int32", "optional": true },
    { "name": "tokenEstimate", "type": "int32", "optional": true },
    { "name": "url", "type": "string", "optional": true },
    { "name": "status", "type": "string", "facet": true, "optional": true },
    { "name": "isPublic", "type": "bool", "facet": true, "optional": true },
    { "name": "allowedUserIds", "type": "string[]", "optional": true, "facet": true },
    { "name": "articleUpdatedAt", "type": "int64", "optional": true },
    { "name": "chunkUpdatedAt", "type": "int64", "optional": true }
  ],
  "default_sorting_field": "chunkUpdatedAt"
};


async function ensureCollectionExists() {
    try {
        await typesense.collections('memory_nodes').retrieve();
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.log("Creating Typesense collection: memory_nodes");
            await typesense.collections().create(typesenseMemoryNodeSchema as any);
        } else {
            throw error; // Re-throw other errors
        }
    }
}

async function deleteChunksForArticle(spaceId: string, articleId: string) {
  try {
    await typesense.collections("memory_nodes").documents().delete({
      filter_by: `spaceId:=${spaceId} && articleId:=${articleId}`,
    });
  } catch (error: any) {
      // It's okay if no documents were found to delete (404)
      if (error.httpStatus !== 404) {
          console.error(`Error deleting chunks for article ${articleId}:`, error);
          throw error;
      }
  }
}


export async function POST(req: Request) {
  if (!REINDEX_SECRET) {
    return NextResponse.json({ ok: false, error: "Missing ADMIN_REINDEX_SECRET on the server." }, { status: 500 });
  }

  const auth = req.headers.get("x-admin-secret");
  if (auth !== REINDEX_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  await ensureCollectionExists();

  const body = await req.json().catch(() => ({}));
  const hubId = body.hubId as string | undefined;
  const articleId = body.articleId as string | undefined;

  if (!hubId) {
    return NextResponse.json({ ok: false, error: "hubId is required" }, { status: 400 });
  }

  const hubDoc = await adminDB.collection("hubs").doc(hubId).get();
  if (!hubDoc.exists) {
    return NextResponse.json({ ok: false, error: `Hub ${hubId} not found.` }, { status: 404 });
  }
  const spaceId = hubDoc.data()?.spaceId;
  if (!spaceId) {
    return NextResponse.json({ ok: false, error: `Hub ${hubId} is missing a spaceId.` }, { status: 500 });
  }

  if (articleId) {
    const articleRef = adminDB.collection("help_center_articles").doc(articleId);
    const docSnap = await articleRef.get();

    if (!docSnap.exists || docSnap.data()?.hubId !== hubId) {
      return NextResponse.json(
        { ok: false, error: `Article ${articleId} not found in hub ${hubId}.` },
        { status: 404 }
      );
    }
    
    await deleteChunksForArticle(spaceId, articleId);

    const article = { id: docSnap.id, ...docSnap.data() };
    const res = await indexHelpCenterArticleToChunks({
      adminDB,
      article,
      spaceId,
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    
    return NextResponse.json({ ok: true, hubId, spaceId, articles: 1, totalChunks: res.chunkCount, reindexed: [articleId] });
  }

  const snap = await adminDB
    .collection("help_center_articles")
    .where("hubId", "==", hubId)
    .where("status", "==", "published")
    .get();

  let totalChunks = 0;
  let articlesCount = 0;

  for (const doc of snap.docs) {
    const article = { id: doc.id, ...doc.data() };
    
    await deleteChunksForArticle(spaceId, article.id);

    const res = await indexHelpCenterArticleToChunks({
      adminDB,
      article,
      spaceId,
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    totalChunks += res.chunkCount;
    articlesCount += 1;
  }

  return NextResponse.json({ ok: true, hubId, spaceId, articles: articlesCount, totalChunks });
}
