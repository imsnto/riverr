
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioVoiceRecording = onRequest(
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

    const { RecordingUrl, CallSid, RecordingDuration } = req.body;

    try {
      const eventSnap = await db.collection("chat_messages")
        .where("providerCallId", "==", CallSid)
        .limit(1).get();

      if (!eventSnap.empty) {
        const baseEvent = eventSnap.docs[0].data();
        const now = new Date().toISOString();

        await db.collection("chat_messages").add({
          ...baseEvent,
          eventType: 'voicemail_recorded',
          recordingUrl: RecordingUrl,
          durationSeconds: parseInt(RecordingDuration, 10),
          timestamp: now,
        });

        await db.doc(`conversations/${baseEvent.conversationId}`).update({
          lastMessage: 'New voicemail recorded',
          lastMessageAt: now,
          updatedAt: now,
        });
      }
      res.status(200).send("OK");
    } catch (err: any) {
      logger.error("Voice Recording error", err);
      res.status(200).send("OK");
    }
  }
);
