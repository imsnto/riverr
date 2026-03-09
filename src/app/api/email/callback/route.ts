
import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/email/EmailService";
import { adminDB } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Invalid callback response" }, { status: 400 });
  }

  try {
    const { hubId, emailConfigId, userId: stateUserId } = JSON.parse(state);
    
    if (hubId === 'agent') {
      // Agent Personal Email Connection
      // Note: In production we verify the session userId matches stateUserId
      const userId = stateUserId;
      await emailService.completeAgentEmailConnection(userId, emailConfigId, code);
      return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?tab=agent&success=true`);
    } else {
      // Hub Support Email Connection
      const configQuery = await adminDB.collectionGroup("emailConfigs")
          .where("id", "==", emailConfigId)
          .limit(1)
          .get();
      
      if (configQuery.empty) throw new Error("Connection session expired");
      const spaceId = configQuery.docs[0].ref.parent.parent!.id;

      // Placeholder userId
      const userId = "admin-placeholder";
      await emailService.completeConnection(spaceId, hubId, emailConfigId, code, userId);

      return NextResponse.redirect(`${process.env.APP_BASE_URL}/space/${spaceId}/hub/${hubId}/settings?tab=email&success=true`);
    }
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return NextResponse.json({ error: error.message || "Failed to complete connection" }, { status: 500 });
  }
}
