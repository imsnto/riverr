
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getMessagingProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * POST /api/twilio/sms/status
 * Handled by Twilio Status Callback to track delivery.
 */
export const twilioSmsStatus = onRequest(async (req, res) => {
  const provider = getMessagingProvider('twilio');

  try {
    const status = provider.parseSmsStatus(req);
    const { providerMessageId, status: deliveryStatus, errorCode, errorMessage } = status;

    // Use the lookup collection to find the internal messageId
    const lookupRef = db.doc(`provider_message_lookups/twilio_${providerMessageId}`);
    const lookupSnap = await lookupRef.get();

    if (lookupSnap.exists) {
      const { messageId } = lookupSnap.data() as any;
      
      await db.doc(`chat_messages/${messageId}`).update({
        deliveryStatus,
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
      });
      
      logger.debug("Updated SMS delivery status", { messageId, deliveryStatus });
    } else {
      logger.warn("Received status for unknown provider message", { providerMessageId });
    }

    res.status(200).send("OK");
  } catch (err: any) {
    logger.error("SMS Status error", err);
    res.status(200).send("OK"); // Don't let Twilio retry on logic error
  }
});
