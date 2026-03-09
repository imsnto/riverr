
import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/email/EmailService";
import { adminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Invalid callback response" }, { status: 400 });
  }

  try {
    const { hubId, emailConfigId } = JSON.parse(state);
    
    // We need spaceId too. In a real app, we'd verify the user's session token here
    // For Phase 1, we'll lookup the pending config to find the spaceId
    const configQuery = await adminDB.collectionGroup("emailConfigs")
        .where("id", "==", emailConfigId)
        .limit(1)
        .get();
    
    if (configQuery.empty) throw new Error("Connection session expired");
    const spaceId = configQuery.docs[0].ref.parent.parent!.id;

    // TODO: Get real userId from session cookie
    const userId = "admin-placeholder";

    await emailService.completeConnection(spaceId, hubId, emailConfigId, code, userId);

    return NextResponse.redirect(`${process.env.APP_BASE_URL}/space/${spaceId}/hub/${hubId}/settings?tab=email&success=true`);
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    if (error.message.includes("already connected")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to complete connection" }, { status: 500 });
  }
}
