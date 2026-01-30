
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";
import { indexHelpCenterArticleToChunks } from "@/lib/knowledge/indexer";

const PUBLIC_HELP_BASE_URL = process.env.PUBLIC_HELP_BASE_URL || "https://6000-firebase-studio-1753688090358.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev";

export async function POST(req: Request) {
  // TODO: protect this route (admin auth / secret)
  const body = await req.json().catch(() => ({}));
  const hubId = body.hubId as string | undefined;
  const articleId = body.articleId as string | undefined;

  if (!hubId) {
    return NextResponse.json({ ok: false, error: "hubId is required" }, { status: 400 });
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
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    
    return NextResponse.json({ ok: true, hubId, articles: 1, totalChunks: res.chunkCount, reindexed: [articleId] });
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
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    totalChunks += res.chunkCount;
    articlesCount += 1;
  }

  return NextResponse.json({ ok: true, hubId, articles: articlesCount, totalChunks });
}
