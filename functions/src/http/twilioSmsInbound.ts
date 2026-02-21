
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getMessagingProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioSmsInbound = onRequest(async (req, res) => {
  const provider = getMessagingProvider('twilio');

  // Skip validation in local development if needed, but recommended for production
  // if (!provider.validateWebhook(req)) {
  //   logger.warn("Unauthorized Twilio webhook attempt");
  //   res.status(401).send("Unauthorized");
  //   return;
  // }

  try {
    const inbound = provider.parseInboundSms(req);
    const { to, from, body, providerMessageId, media } = inbound;

    // 1. Resolve To number
    const lookupRef = db.doc(`phone_channel_lookups/twilio_sms_${to}`);
    const lookupSnap = await lookupRef.get();

    if (!lookupSnap.exists || !lookupSnap.get('isActive')) {
      logger.info("Ignoring SMS to unassigned/inactive number", { to });
      res.status(200).send("OK");
      return;
    }

    const { spaceId, hubId } = lookupSnap.data() as any;

    // 2. Ensure deterministic conversation
    const conversationId = `sms_${spaceId}_${to.replace(/[^\d+]/g, '')}_${from.replace(/[^\d+]/g, '')}`;
    const convoRef = db.doc(`conversations/${conversationId}`);

    await db.runTransaction(async (tx) => {
      const convoSnap = await tx.get(convoRef);
      const now = new Date().toISOString();

      if (!convoSnap.exists) {
        tx.set(convoRef, {
          spaceId,
          hubId,
          contactId: null, // Will be resolved by metadata/CRM trigger
          status: 'bot',
          state: 'ai_active',
          channel: 'sms',
          channelProvider: 'twilio',
          channelAddress: to,
          externalAddress: from,
          lastMessage: body.slice(0, 140),
          lastMessageAt: now,
          lastMessageAuthor: from,
          updatedAt: now,
          createdAt: now,
        });
      }

      // 3. Create message idempotently
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
      });
    });

    res.status(200).send("<Response></Response>");
  } catch (err: any) {
    logger.error("Inbound SMS error", err);
    res.status(500).send("Internal Server Error");
  }
});
