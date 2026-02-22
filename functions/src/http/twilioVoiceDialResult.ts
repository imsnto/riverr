
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getVoiceProvider } from "../comms/providerFactory";
import { logger } from "firebase-functions";

const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const twilioVoiceDialResult = onRequest(
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

    const { DialCallStatus } = req.body;
    // Get To from query params as canonical context
    const toNormalized = String(req.query.to || "");
    
    if (DialCallStatus === 'completed') {
      res.type('text/xml').send('<Response><Hangup/></Response>');
      return;
    }

    if (!toNormalized) {
        logger.warn("twilioVoiceDialResult: Missing toNormalized context");
        res.type('text/xml').send('<Response><Hangup/></Response>');
        return;
    }

    const lookupRef = db.doc(`phone_channel_lookups/twilio_voice_${toNormalized}`);
    const lookupSnap = await lookupRef.get();
    const voicemailEnabled = lookupSnap.exists ? !!lookupSnap.get('voicemailEnabled') : false;

    if (voicemailEnabled) {
      const twiml = provider.buildVoicemailTwiML({
        recordingCallbackUrl: `${baseUrl.replace(/\/$/, "")}/api/twilio/voice/recording`,
      });
      res.type('text/xml').send(twiml);
    } else {
      res.type('text/xml').send('<Response><Hangup/></Response>');
    }
  }
);
