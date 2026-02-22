
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { normalizePhoneFallback } from "../comms/utils";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioVoiceInbound = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID] },
  async (req, res) => {
    const baseUrl = PUBLIC_BASE_URL.value();
    const b = req.body;
    const to = (b.To || b.Called || "").trim();

    if (!to) {
      res.status(200).send("<Response><Hangup/></Response>");
      return;
    }

    const toNormalized = normalizePhoneFallback(to);
    const lookupRef = db.doc(`phone_channel_lookups/twilio_voice_${toNormalized}`);
    const lookupSnap = await lookupRef.get();

    if (!lookupSnap.exists || !lookupSnap.get('isActive')) {
      res.type('text/xml').send('<Response><Say>The number you called is currently unavailable. Goodbye.</Say></Response>');
      return;
    }

    const { spaceId, hubId, defaultForwardToE164, twilioSubaccountSid } = lookupSnap.data() as any;

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
      logger.warn("Unauthorized Twilio voice attempt", { to });
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const { from, providerCallId } = provider.parseInboundCall(req);
      const fromNormalized = normalizePhoneFallback(from);
      
      // CRM Linking
      let contactId: string | null = null;
      const contactQuery = await db.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhoneE164", "==", from)
        .limit(1).get();
      if (!contactQuery.empty) contactId = contactQuery.docs[0].id;

      if (!contactId) {
        const newContactRef = await db.collection("contacts").add({
          spaceId,
          name: from,
          primaryPhone: from,
          primaryPhoneE164: from,
          primaryPhoneNormalized: fromNormalized,
          source: 'voice',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          mergeParentId: null,
          emails: [],
          phones: [from],
          tags: [],
          externalIds: {},
        });
        contactId = newContactRef.id;
      }

      const conversationId = `voice_${spaceId}_${toNormalized.replace(/\+/g, '')}_${fromNormalized.replace(/\+/g, '')}`;
      const convoRef = db.doc(`conversations/${conversationId}`);
      const now = new Date().toISOString();

      await convoRef.set({
        id: conversationId,
        spaceId,
        hubId,
        contactId,
        visitorId: null,
        status: 'human',
        state: 'human_assigned',
        channel: 'voice',
        channelProvider: 'twilio',
        channelAddress: to,
        externalAddress: from,
        assigneeId: null,
        assignedAgentIds: [],
        lastMessage: 'Incoming call...',
        lastMessageAt: now,
        lastMessageAuthor: from,
        updatedAt: now,
        createdAt: now,
        twilioSubaccountSid: twilioSubaccountSid || null
      }, { merge: true });

      await db.doc(`provider_call_lookups/twilio_${providerCallId}`).set({
        conversationId,
        spaceId,
        hubId,
        contactId,
        from,
        to,
        fromNormalized,
        toNormalized,
        createdAt: now,
        twilioSubaccountSid: twilioSubaccountSid || null
      }, { merge: true });

      const eventId = `twilio_call_${providerCallId}_started`;
      await db.doc(`chat_messages/${eventId}`).set({
        id: eventId,
        conversationId,
        authorId: 'system',
        type: 'event',
        eventType: 'call_started',
        content: 'Incoming call',
        senderType: 'contact',
        timestamp: now,
        channel: 'voice',
        provider: 'twilio',
        providerCallId,
        from,
        to
      }, { merge: true });

      const twiml = provider.buildForwardTwiML({
        forwardToE164: defaultForwardToE164,
        statusCallbackUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/voice/status`,
        actionUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/voice/dial-result?to=${encodeURIComponent(toNormalized)}`,
      });

      res.type('text/xml').send(twiml);
    } catch (err: any) {
      logger.error("Inbound Call error", err);
      res.type('text/xml').send('<Response><Say>An internal error occurred.</Say></Response>');
    }
  }
);
