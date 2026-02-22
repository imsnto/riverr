
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getMessagingProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioSmsStatus = onRequest(
  { secrets: [PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID] },
  async (req, res) => {
    const baseUrl = PUBLIC_BASE_URL.value();
    const { MessageSid } = req.body;

    if (!MessageSid) {
      res.status(200).send("OK");
      return;
    }

    try {
      const lookupRef = db.doc(`provider_message_lookups/twilio_${MessageSid}`);
      const lookupSnap = await lookupRef.get();

      if (!lookupSnap.exists) {
        logger.info("Ignoring status callback for unknown message", { MessageSid });
        res.status(200).send("OK");
        return;
      }

      const { conversationId } = lookupSnap.data() as any;
      const convoSnap = await db.doc(`conversations/${conversationId}`).get();
      const twilioSubaccountSid = convoSnap.get('twilioSubaccountSid');

      // Resolve Auth Token for validation
      let authToken = TWILIO_AUTH_TOKEN.value();
      if (twilioSubaccountSid) {
        const secretsSnap = await db.doc(`twilio_subaccount_secrets/${twilioSubaccountSid}`).get();
        if (secretsSnap.exists) {
          authToken = secretsSnap.get('authToken');
        }
      }

      const provider = getMessagingProvider('twilio', {
        accountSid: twilioSubaccountSid || TWILIO_ACCOUNT_SID.value(),
        authToken: authToken,
      });

      if (!provider.validateWebhook(req, baseUrl)) {
        logger.warn("Unauthorized Twilio webhook attempt (status)", { MessageSid });
        res.status(401).send("Unauthorized");
        return;
      }

      const status = provider.parseSmsStatus(req);
      const { status: deliveryStatus, errorCode, errorMessage } = status;

      await db.doc(`chat_messages/twilio_${MessageSid}`).update({
        deliveryStatus,
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
      });

      res.status(200).send("OK");
    } catch (err: any) {
      logger.error("SMS Status error", err);
      res.status(200).send("OK");
    }
  }
);
