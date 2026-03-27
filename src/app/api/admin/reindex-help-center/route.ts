import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";
import { indexHelpCenterArticleToChunks } from "@/lib/knowledge/indexer";

export async function POST(req: Request) {
  console.log('REINDEX: Start request received');
  
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

  try {
    if (articleId) {
      console.log(`REINDEX: Single article ${articleId}`);
      const articleRef = adminDB.collection("help_center_articles").doc(articleId);
      const docSnap = await articleRef.get();

      if (!docSnap.exists || docSnap.data()?.hubId !== hubId) {
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
        publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "",
      });
      
      return NextResponse.json({ ok: true, hubId, spaceId, articles: 1, totalChunks: res.chunkCount, reindexed: [articleId] });
    }

    console.log(`REINDEX: Mass reindexing hub ${hubId}`);
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
        publicHelpBaseUrl: process.env.PUBLIC_HELP_BASE_URL || "",
      });
      totalChunks += res.chunkCount;
      articlesCount += 1;
    }

    return NextResponse.json({ ok: true, hubId, spaceId, articles: articlesCount, totalChunks });
  } catch (err: any) {
    console.error('REINDEX ERROR:', err);
    return NextResponse.json({ ok: false, error: err.message || "Internal server error during indexing" }, { status: 500 });
  }
}
