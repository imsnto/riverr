
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { normalizePhoneFallback } from "../comms/utils";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioVoiceInbound = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    const baseUrl = PUBLIC_BASE_URL.value();
    const provider = getVoiceProvider('twilio', {
      authToken: TWILIO_AUTH_TOKEN.value(),
    });

    if (!provider.validateWebhook(req, baseUrl)) {
      logger.warn("Unauthorized Twilio voice attempt");
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const { to, from, providerCallId } = provider.parseInboundCall(req);
      const toNormalized = normalizePhoneFallback(to);
      
      const lookupRef = db.doc(`phone_channel_lookups/twilio_voice_${toNormalized}`);
      const lookupSnap = await lookupRef.get();

      if (!lookupSnap.exists || !lookupSnap.get('isActive')) {
        res.type('text/xml').send('<Response><Say>The number you called is currently unavailable. Goodbye.</Say></Response>');
        return;
      }

      const { spaceId, hubId, defaultForwardToE164, voicemailEnabled } = lookupSnap.data() as any;
      const fromNormalized = normalizePhoneFallback(from);

      // CRM Linking logic (Reused pattern)
      let contactId: string | null = null;
      const contactQuery = await db.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhoneE164", "==", from)
        .limit(1).get();
      if (!contactQuery.empty) contactId = contactQuery.docs[0].id;

      if (!contactId) {
        const newContactRef = await db.collection("contacts").add({
          spaceId, name: from, primaryPhone: from, primaryPhoneE164: from, primaryPhoneNormalized: fromNormalized,
          source: 'call', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
        });
        contactId = newContactRef.id;
      }

      const conversationId = `voice_${spaceId}_${toNormalized.replace(/\+/g, '')}_${fromNormalized.replace(/\+/g, '')}`;
      const convoRef = db.doc(`conversations/${conversationId}`);
      const now = new Date().toISOString();

      await convoRef.set({
        spaceId, hubId, contactId, status: 'human', channel: 'voice', channelProvider: 'twilio',
        channelAddress: to, externalAddress: from, lastMessage: 'Incoming call...', lastMessageAt: now,
        updatedAt: now, createdAt: now
      }, { merge: true });

      const eventRef = db.doc(`chat_messages/twilio_call_${providerCallId}_started`);
      await eventRef.set({
        conversationId, type: 'event', eventType: 'call_started', senderType: 'contact',
        timestamp: now, channel: 'voice', provider: 'twilio', providerCallId, from, to
      }, { merge: true });

      const twiml = provider.buildForwardTwiML({
        forwardToE164: defaultForwardToE164,
        statusCallbackUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/voice/status`,
        actionUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/voice/dial-result`,
      });

      res.type('text/xml').send(twiml);
    } catch (err: any) {
      logger.error("Inbound Call error", err);
      res.type('text/xml').send('<Response><Say>An internal error occurred.</Say></Response>');
    }
  }
);
