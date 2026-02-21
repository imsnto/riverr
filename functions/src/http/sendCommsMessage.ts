
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getMessagingProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

// Define secrets for injection
const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Callable Function: sendCommsMessage
 * Used by the UI and Bot to send outbound SMS.
 */
export const sendCommsMessage = onCall(
  { 
    // Secrets included here are automatically mounted to process.env during execution
    secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID] 
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "User must be authenticated.");

    const { conversationId, content } = request.data as { conversationId: string; content: string };
    if (!conversationId || !content) throw new HttpsError("invalid-argument", "Missing conversationId or content.");

    const convoRef = db.doc(`conversations/${conversationId}`);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) throw new HttpsError("not-found", "Conversation not found.");

    const convo = convoSnap.data() as any;

    if (convo.channel !== 'sms') {
      throw new HttpsError("failed-precondition", "Only SMS channel is currently supported by this endpoint.");
    }

    const now = new Date().toISOString();
    const provider = getMessagingProvider('twilio');
    const baseUrl = PUBLIC_BASE_URL.value();

    // 1. Create message doc first (Snappy UI)
    const msgRef = await db.collection("chat_messages").add({
      conversationId,
      authorId: uid,
      senderType: 'agent',
      type: 'message',
      content,
      timestamp: now,
      channel: 'sms',
      provider: 'twilio',
      deliveryStatus: 'created',
    });

    try {
      // 2. Send via Provider
      const { providerMessageId } = await provider.sendSms({
        from: convo.channelAddress,
        to: convo.externalAddress,
        body: content,
        // Canonical URL for status tracking
        statusCallbackUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/sms/status`
      });

      // 3. Update message and write lookup
      await msgRef.update({
        providerMessageId,
        deliveryStatus: 'queued',
      });

      await db.doc(`provider_message_lookups/twilio_${providerMessageId}`).set({
        messageId: msgRef.id,
        conversationId,
      });

      // 4. Update conversation metadata
      await convoRef.update({
        lastMessage: content.slice(0, 140),
        lastMessageAt: now,
        lastMessageAuthor: 'You', 
        updatedAt: now
      });

      return { success: true, messageId: msgRef.id };
    } catch (err: any) {
      logger.error("Failed to send outbound SMS", err);
      await msgRef.update({ deliveryStatus: 'failed', errorMessage: err.message });
      throw new HttpsError("internal", "Failed to send SMS via provider.");
    }
  }
);
