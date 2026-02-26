import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { title, body, recipients, url } = await req.json();

    if (!title || !body || !Array.isArray(recipients) || !url) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const tokens = recipients;
    if (tokens.length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid tokens found" },
        { status: 400 }
      );
    }

    const BATCH_SIZE = 500;
    const invalidTokens: string[] = [];

    // ---- 🔥 Send in batches of 500 ----
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        data: {
          title,
          body,
          url: url || "/",
          badge: 'https://firebasestorage.googleapis.com/v0/b/timeflow-6i3eo.firebasestorage.app/o/manowar.png?alt=media&token=fb758032-475d-4399-934f-527a2fd2cf63',
          icon: 'https://firebasestorage.googleapis.com/v0/b/timeflow-6i3eo.firebasestorage.app/o/manowar.png?alt=media&token=fb758032-475d-4399-934f-527a2fd2cf63'
        },
      });

      // Collect invalid tokens
      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          res.error?.code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(batch[idx]);
        }
      });
    }

    // ---- 🔥 Remove invalid tokens from Firestore (OPTIMIZED) ----
    if (invalidTokens.length > 0) {
      // 1. Convert the array to a Set for O(1) lookup
      const invalidTokenSet = new Set(invalidTokens);

      // 2. The Unscalable Full Read remains (Fix this by changing data model!)
      const snap = await admin.firestore().collection("fcmTokens").get();

      console.log(`Found ${snap.size} docs to scan for token cleanup...`);

      const docs = snap.docs;
      const BATCH_LIMIT = 500;
      let batch = admin.firestore().batch();
      let batchCounter = 0;

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const data = doc.data();
        const docTokens: string[] = data.tokens || [];

        // IMPROVED: Use Set.has() instead of Array.includes() for much faster lookup
        const toRemove = docTokens.filter((t) => invalidTokenSet.has(t));

        if (toRemove.length > 0) {
          batch.update(doc.ref, {
            tokens: admin.firestore.FieldValue.arrayRemove(...toRemove),
          });
          batchCounter++;
        }

        if (batchCounter >= BATCH_LIMIT) {
          await batch.commit();
          console.log("🔥 Batch committed (500 writes)");

          batch = admin.firestore().batch();
          batchCounter = 0;
        }
      }

      // Commit leftover updates
      if (batchCounter > 0) {
        await batch.commit();
        console.log("🔥 Final cleanup batch committed");
      }

      console.log("🔥 All invalid tokens removed successfully");
    }


    return NextResponse.json(
      {
        success: true,
        message: "Notification sent",
        totalTokens: tokens.length,
        invalidRemoved: invalidTokens.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
