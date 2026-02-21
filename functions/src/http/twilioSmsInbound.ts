
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getMessagingProvider } from "../comms/providerFactory";
import { normalizePhoneFallback } from "../comms/utils";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioSmsInbound = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID] },
  async (req, res) => {
    const provider = getMessagingProvider('twilio', {
      accountSid: TWILIO_ACCOUNT_SID.value(),
      authToken: TWILIO_AUTH_TOKEN.value(),
    });

    const baseUrl = PUBLIC_BASE_URL.value();
    if (!provider.validateWebhook(req, baseUrl)) {
      logger.warn("Unauthorized Twilio webhook attempt (inbound)");
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const inbound = provider.parseInboundSms(req);
      const { to, from, body, providerMessageId, media } = inbound;

      const toNormalized = normalizePhoneFallback(to);
      const lookupRef = db.doc(`phone_channel_lookups/twilio_sms_${toNormalized}`);
      const lookupSnap = await lookupRef.get();

      if (!lookupSnap.exists || !lookupSnap.get('isActive')) {
        logger.info("Ignoring SMS to unassigned/inactive number", { to });
        res.status(200).send("OK");
        return;
      }

      const { spaceId, hubId } = lookupSnap.data() as any;
      const fromNormalized = normalizePhoneFallback(from);
      
      // CRM Linking logic
      let contactId: string | null = null;
      const contactQuery = await db.collection("contacts")
        .where("spaceId", "==", spaceId)
        .where("primaryPhoneE164", "==", from)
        .limit(1)
        .get();
        
      if (!contactQuery.empty) {
        contactId = contactQuery.docs[0].id;
      } else {
        const normQuery = await db.collection("contacts")
          .where("spaceId", "==", spaceId)
          .where("primaryPhoneNormalized", "==", fromNormalized)
          .limit(1)
          .get();
        if (!normQuery.empty) contactId = normQuery.docs[0].id;
      }

      if (!contactId) {
        const newContactRef = await db.collection("contacts").add({
          spaceId,
          name: from,
          primaryPhone: from,
          primaryPhoneE164: from,
          primaryPhoneNormalized: fromNormalized,
          phoneNormalizationStatus: 'e164',
          source: 'sms',
          emails: [],
          phones: [from],
          externalIds: {},
          tags: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          mergeParentId: null
        });
        contactId = newContactRef.id;
      }

      const conversationId = `sms_${spaceId}_${toNormalized.replace(/\+/g, '')}_${fromNormalized.replace(/\+/g, '')}`;
      const convoRef = db.doc(`conversations/${conversationId}`);

      await db.runTransaction(async (tx) => {
        const convoSnap = await tx.get(convoRef);
        const now = new Date().toISOString();

        if (!convoSnap.exists) {
          tx.set(convoRef, {
            spaceId,
            hubId,
            contactId,
            status: 'bot',
            state: 'ai_active',
            channel: 'sms',
            channelProvider: 'twilio',
            channelAddress: to,
            externalAddress: from,
            assigneeId: null,
            assignedAgentIds: [],
            lastMessage: body.slice(0, 140),
            lastMessageAt: now,
            lastMessageAuthor: from,
            updatedAt: now,
            createdAt: now,
          });
        } else {
          tx.update(convoRef, {
            contactId,
            lastMessage: body.slice(0, 140),
            lastMessageAt: now,
            lastMessageAuthor: from,
            updatedAt: now
          });
        }

        const msgRef = db.doc(`chat_messages/twilio_${providerMessageId}`);
        tx.set(msgRef, {
          conversationId,
          senderType: 'contact',
          type: 'message',
          content: body,
          timestamp: now,
          channel: 'sms',
          provider: 'twilio',
          providerMessageId,
          media: media || null,
        }, { merge: true });
      });

      res.status(200).send("<Response></Response>");
    } catch (err: any) {
      logger.error("Inbound SMS error", err);
      res.status(200).send("OK");
    }
  }
);
