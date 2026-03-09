
import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/email/EmailService";
import { EmailProviderName } from "@/lib/data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("spaceId");
  const hubId = searchParams.get("hubId");
  const provider = searchParams.get("provider") as EmailProviderName;

  if (!spaceId || !hubId || !provider) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const { authUrl } = await emailService.initiateConnection(spaceId, hubId, provider);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Email connect failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
