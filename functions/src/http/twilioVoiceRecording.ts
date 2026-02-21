
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
      const lookupRef = db.doc(`provider_call_lookups/twilio_${CallSid}`);
      const lookupSnap = await lookupRef.get();

      if (lookupSnap.exists) {
        const { conversationId } = lookupSnap.data() as any;
        const now = new Date().toISOString();

        const msgId = `twilio_call_${CallSid}_voicemail`;
        await db.doc(`chat_messages/${msgId}`).set({
          conversationId,
          type: 'event',
          eventType: 'voicemail_recorded',
          senderType: 'contact',
          recordingUrl: RecordingUrl,
          durationSeconds: parseInt(RecordingDuration, 10),
          timestamp: now,
          channel: 'voice',
          provider: 'twilio',
          providerCallId: CallSid,
        }, { merge: true });

        await db.doc(`conversations/${conversationId}`).update({
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
