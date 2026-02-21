
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioVoiceStatus = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    const baseUrl = PUBLIC_BASE_URL.value();
    const provider = getVoiceProvider('twilio', {
      authToken: TWILIO_AUTH_TOKEN.value(),
    });

    if (!provider.validateWebhook(req, baseUrl)) {
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const { providerCallId, status, durationSeconds } = provider.parseCallStatus(req);
      
      const eventRef = db.doc(`chat_messages/twilio_call_${providerCallId}_status_${status}`);
      const eventSnap = await db.collection("chat_messages")
        .where("providerCallId", "==", providerCallId)
        .where("type", "==", "event")
        .limit(1).get();

      if (!eventSnap.empty) {
        const baseEvent = eventSnap.docs[0].data();
        const conversationId = baseEvent.conversationId;
        const now = new Date().toISOString();

        let eventType: any = `call_${status}`;
        if (status === 'completed') eventType = 'call_ended';
        if (['busy', 'failed', 'no-answer', 'canceled'].includes(status)) eventType = 'call_missed';

        await eventRef.set({
          ...baseEvent,
          id: eventRef.id,
          eventType,
          durationSeconds: durationSeconds || null,
          timestamp: now,
        }, { merge: true });

        // Update convo metadata
        const label = eventType === 'call_ended' ? `Call ended (${durationSeconds}s)` : `Call ${status}`;
        await db.doc(`conversations/${conversationId}`).update({
          lastMessage: label,
          lastMessageAt: now,
          updatedAt: now,
        });
      }

      res.status(200).send("OK");
    } catch (err: any) {
      logger.error("Voice Status error", err);
      res.status(200).send("OK");
    }
  }
);
