
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";
import { indexHelpCenterArticleToChunks } from "@/lib/knowledge/indexer";

const PUBLIC_HELP_BASE_URL = process.env.PUBLIC_HELP_BASE_URL || "https://your-help-domain.com";

export async function POST(req: Request) {
  // TODO: protect this route (admin auth / secret)
  const body = await req.json().catch(() => ({}));
  const hubId = body.hubId as string | undefined;

  if (!hubId) {
    return NextResponse.json({ ok: false, error: "hubId required" }, { status: 400 });
  }

  const snap = await adminDB
    .collection("help_center_articles")
    .where("hubId", "==", hubId)
    .where("status", "==", "published")
    .get();

  let totalChunks = 0;
  let articles = 0;

  for (const doc of snap.docs) {
    const article = { id: doc.id, ...doc.data() };
    const res = await indexHelpCenterArticleToChunks({
      adminDB,
      article,
      publicHelpBaseUrl: PUBLIC_HELP_BASE_URL,
    });
    totalChunks += res.chunkCount;
    articles += 1;
  }

  return NextResponse.json({ ok: true, hubId, articles, totalChunks });
}
