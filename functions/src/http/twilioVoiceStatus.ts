
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function mapCallStatusToEventType(status: string): string | null {
  switch (status) {
    case 'ringing': return 'call_ringing';
    case 'in-progress': return 'call_answered';
    case 'completed': return 'call_ended';
    case 'busy':
    case 'failed':
    case 'no-answer':
    case 'canceled':
      return 'call_missed';
    default:
      return null;
  }
}

export const twilioVoiceStatus = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    const baseUrl = PUBLIC_BASE_URL.value();
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

      // Resolve Auth Token for validation
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

      if (!provider.validateWebhook(req, baseUrl)) {
        logger.warn("Unauthorized Twilio voice status attempt", { CallSid });
        res.status(401).send("Unauthorized");
        return;
      }

      const { providerCallId, status, durationSeconds } = provider.parseCallStatus(req);
      const { conversationId, from, to } = lookupSnap.data() as any;
      const now = new Date().toISOString();

      const eventType = mapCallStatusToEventType(status);
      if (!eventType) {
          res.status(200).send("OK");
          return;
      }

      const msgId = `twilio_call_${providerCallId}_status_${eventType}`;
      await db.doc(`chat_messages/${msgId}`).set({
        id: msgId,
        conversationId,
        authorId: 'system',
        type: 'event',
        eventType,
        senderType: 'contact',
        durationSeconds: durationSeconds || null,
        timestamp: now,
        channel: 'voice',
        provider: 'twilio',
        providerCallId,
        from,
        to
      }, { merge: true });

      let label = `Call ${status}`;
      if (eventType === 'call_ended' && durationSeconds) {
          const mins = Math.floor(durationSeconds / 60);
          const secs = durationSeconds % 60;
          label = `Call ended (${mins}:${secs.toString().padStart(2, '0')})`;
      } else if (eventType === 'call_missed') {
          label = `Call missed`;
      } else if (eventType === 'call_answered') {
          label = 'Call answered';
      } else if (eventType === 'call_ringing') {
          label = 'Incoming call ringing';
      }

      await db.doc(`conversations/${conversationId}`).set({
        lastMessage: label,
        lastMessageAt: now,
        lastMessageAuthor: from,
        updatedAt: now,
      }, { merge: true });

      res.status(200).send("OK");
    } catch (err: any) {
      logger.error("Voice Status error", err);
      res.status(200).send("OK");
    }
  }
);
