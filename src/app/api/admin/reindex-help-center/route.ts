
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";
import { indexHelpCenterArticleToChunks } from "@/lib/knowledge/indexer";
import { typesense } from "@/lib/typesense";

const PUBLIC_HELP_BASE_URL = process.env.PUBLIC_HELP_BASE_URL || "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev";

const typesenseChunkSchema = {
  "name": "bii_help_chunks",
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "spaceId", "type": "string", "facet": true },
    { "name": "hubId", "type": "string", "optional": true, "facet": true },
    { "name": "helpCenterIds", "type": "string[]", "facet": true },
    { "name": "articleId", "type": "string", "facet": true },
    { "name": "articleTitle", "type": "string" },
    { "name": "articleSubtitle", "type": "string", "optional": true },
    { "name": "articleType", "type": "string", "facet": true },
    { "name": "chunkIndex", "type": "int32" },
    { "name": "headingPath", "type": "string[]", "optional": true },
    { "name": "anchor", "type": "string", "optional": true },
    { "name": "text", "type": "string" },
    { "name": "url", "type": "string" },
    { "name": "status", "type": "string", "facet": true },
    { "name": "isPublic", "type": "bool", "facet": true },
    { "name": "allowedUserIds", "type": "string[]", "optional": true, "facet": true },
    { "name": "language", "type": "string", "facet": true, "default": "en" },
    { "name": "articleUpdatedAt", "type": "int64" },
    { "name": "chunkUpdatedAt", "type": "int64" }
  ],
  "default_sorting_field": "chunkUpdatedAt"
};


async function ensureCollectionExists() {
    try {
        await typesense.collections('bii_help_chunks').retrieve();
    } catch (error: any) {
        if (error.httpStatus === 404) {
            console.log("Creating Typesense collection: bii_help_chunks");
            await typesense.collections().create(typesenseChunkSchema as any);
        } else {
            throw error; // Re-throw other errors
        }
    }
}


export async function POST(req: Request) {
  // TODO: protect this route (admin auth / secret)
  await ensureCollectionExists();

  const body = await req.json().catch(() => ({}));
  const hubId = body.hubId as string | undefined;
  const articleId = body.articleId as string | undefined;

  if (!hubId) {
    return NextResponse.json({ ok: false, error: "hubId is required" }, { status: 400 });
  }

  // Fetch hub to get spaceId
  const hubDoc = await adminDB.collection("hubs").doc(hubId).get();
  if (!hubDoc.exists) {
    return NextResponse.json({ ok: false, error: `Hub ${hubId} not found.` }, { status: 404 });
  }
  const spaceId = hubDoc.data()?.spaceId;
  if (!spaceId) {
    return NextResponse.json({ ok: false, error: `Hub ${hubId} is missing a spaceId.` }, { status: 500 });
  }


  // Handle re-indexing a single article
  if (articleId) {
    const articleRef = adminDB.collection("help_center_articles").doc(articleId);
    const docSnap = await articleRef.get();

    if (!docSnap.exists() || docSnap.data()?.hubId !== hubId) {
      return NextResponse.json(
        { ok: false, error: `Article ${articleId} not found in hub ${hubId}.` },
        { status: 404 }
      );
    }
    
    const article = { id: docSnap.id, ...docSnap.data() };
    const res = await indexHelpCenterArticleToChunks({
      adminDB,
      article,
      spaceId,
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    
    return NextResponse.json({ ok: true, hubId, spaceId, articles: 1, totalChunks: res.chunkCount, reindexed: [articleId] });
  }

  // Handle re-indexing all articles in a hub
  const snap = await adminDB
    .collection("help_center_articles")
    .where("hubId", "==", hubId)
    .where("status", "==", "published")
    .get();

  let totalChunks = 0;
  let articlesCount = 0;

  for (const doc of snap.docs) {
    const article = { id: doc.id, ...doc.data() };
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
