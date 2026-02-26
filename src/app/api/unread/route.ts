import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin"; // your admin setup

export async function GET(request: any) {
    try {
        const { searchParams } = new URL(request.url);
        const hubId = searchParams.get("hubId");
        const visitorId = searchParams.get("visitorId");

        if (!hubId || !visitorId) {
            return NextResponse.json({ hasUnread: false });
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

        return NextResponse.json({ hasUnread });

    } catch (error) {
        console.error("Unread API error:", error);
        return NextResponse.json({ hasUnread: false });
    }
}