import { NextResponse,NextRequest } from "next/server";
import { adminDB } from "@/lib/firebase-admin"; // your admin setup

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
};

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 204, // No content is standard for OPTIONS
    headers: corsHeaders 
  });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const hubId = searchParams.get("hubId");
        const visitorId = searchParams.get("visitorId");

        if (!hubId || !visitorId) {
            return NextResponse.json({ hasUnread: false }, { status: 400, headers: corsHeaders });
        }

        const snapshot = await adminDB
            .collection("conversations")
            .where("hubId", "==", hubId)
            .where("visitorId", "==", visitorId)
            .where("status", "==", "open")
            .get();

        let hasUnread = false;

        snapshot.forEach(doc => {
            const convo = doc.data();
            const lastMessageAt = convo.lastMessageAt;
            const lastSeen = convo.lastVisitorSeenAt;

            if (!lastSeen || new Date(lastMessageAt) > new Date(lastSeen)) {
                hasUnread = true;
            }
        });

        return NextResponse.json({ hasUnread }, { status: 200, headers: corsHeaders });

    } catch (error) {
        console.error("Unread API error:", error);
        return NextResponse.json({ hasUnread: false }, { status: 500, headers: corsHeaders });
    }
}