
import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/email/EmailService";
import { EmailProviderName } from "@/lib/data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("spaceId");
  const hubId = searchParams.get("hubId");
  const userId = searchParams.get("userId");
  const provider = searchParams.get("provider") as EmailProviderName;

  if (!provider) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    if (hubId === 'agent' && userId) {
      // Personal Agent connection
      const { authUrl } = await emailService.initiateAgentConnection(userId, provider);
      // We need to pass the userId in the state for the callback to know which user it is
      const stateObj = JSON.parse(decodeURIComponent(authUrl.split('state=')[1].split('&')[0]));
      stateObj.userId = userId;
      const newAuthUrl = authUrl.split('state=')[0] + 'state=' + encodeURIComponent(JSON.stringify(stateObj)) + authUrl.split('state=')[1].split('&').slice(1).join('&');
      
      return NextResponse.redirect(newAuthUrl);
    } else if (spaceId && hubId) {
      // Hub connection
      const { authUrl } = await emailService.initiateConnection(spaceId, hubId, provider);
      return NextResponse.redirect(authUrl);
    }
    
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("Email connect failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
