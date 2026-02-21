
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
      
      const lookupRef = db.doc(`provider_call_lookups/twilio_${providerCallId}`);
      const lookupSnap = await lookupRef.get();

      if (lookupSnap.exists) {
        const { conversationId } = lookupSnap.data() as any;
        const now = new Date().toISOString();

        // Map Twilio status to internal eventType (ensuring no hyphens and matching UI)
        let eventType: 'call_ringing' | 'call_answered' | 'call_ended' | 'call_missed';
        
        switch(status) {
            case 'ringing': eventType = 'call_ringing'; break;
            case 'in-progress': eventType = 'call_answered'; break;
            case 'completed': eventType = 'call_ended'; break;
            case 'busy':
            case 'failed':
            case 'no-answer':
            case 'canceled':
                eventType = 'call_missed';
                break;
            default:
                res.status(200).send("OK");
                return;
        }

        const msgId = `twilio_call_${providerCallId}_status_${eventType}`;
        await db.doc(`chat_messages/${msgId}`).set({
          conversationId,
          type: 'event',
          eventType,
          senderType: 'contact',
          durationSeconds: durationSeconds || null,
          timestamp: now,
          channel: 'voice',
          provider: 'twilio',
          providerCallId,
        }, { merge: true });

        // Update convo metadata with mm:ss formatting for ended calls
        let label = `Call ${status}`;
        if (eventType === 'call_ended' && durationSeconds) {
            const mins = Math.floor(durationSeconds / 60);
            const secs = durationSeconds % 60;
            label = `Call ended (${mins}:${secs.toString().padStart(2, '0')})`;
        } else if (eventType === 'call_missed') {
            label = `Call missed`;
        }

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
