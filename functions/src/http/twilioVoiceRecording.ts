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
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN] ,
    memory: "1GiB"
  },
  async (req, res) => {
    const canonicalPublicBaseUrl = PUBLIC_BASE_URL.value();
    const { CallSid } = req.body;

    if (!CallSid) {
      res.status(200).send("OK");
      return;
    }

    try {
      const lookupSnap = await db.doc(`provider_call_lookups/twilio_${CallSid}`).get();
      if (!lookupSnap.exists) {
        res.status(200).send("OK");
        return;
      }

      const { twilioSubaccountSid } = lookupSnap.data() as any;

      let authToken = TWILIO_AUTH_TOKEN.value();
      if (twilioSubaccountSid) {
        const secretsSnap = await db.doc(`twilio_subaccount_secrets/${twilioSubaccountSid}`).get();
        if (secretsSnap.exists) {
          authToken = secretsSnap.get('authToken');
        }
      }

      const provider = getVoiceProvider('twilio', {
        authToken: authToken,
      });

      if (!provider.validateWebhook(req, canonicalPublicBaseUrl)) {
        res.status(401).send("Unauthorized");
        return;
      }

      const { RecordingUrl, RecordingDuration } = req.body;
      const { conversationId, from, to } = lookupSnap.data() as any;
      const now = new Date().toISOString();

      const msgId = `twilio_call_${CallSid}_voicemail`;
      await db.doc(`chat_messages/${msgId}`).set({
        id: msgId,
        conversationId,
        authorId: 'system',
        type: 'event',
        eventType: 'voicemail_recorded',
        content: 'Voicemail received',
        senderType: 'contact',
        recordingUrl: RecordingUrl,
        durationSeconds: RecordingDuration ? parseInt(RecordingDuration, 10) : null,
        timestamp: now,
        channel: 'voice',
        provider: 'twilio',
        providerCallId: CallSid,
        from,
        to
      }, { merge: true });

      await db.doc(`conversations/${conversationId}`).set({
        lastMessage: 'New voicemail recorded',
        lastMessageAt: now,
        lastMessageAuthor: from,
        updatedAt: now,
      }, { merge: true });

      res.status(200).send("OK");
    } catch (err: any) {
      logger.error("Voice Recording error", err);
      res.status(200).send("OK");
    }
  }
);
