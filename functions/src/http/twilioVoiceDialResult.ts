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
    const canonicalPublicBaseUrl = PUBLIC_BASE_URL.value();
    
    // Resolve credentials for validation - context usually exists in CallSid
    const { CallSid } = req.body;
    let authToken = TWILIO_AUTH_TOKEN.value();

    if (CallSid) {
      const lookupSnap = await db.doc(`provider_call_lookups/twilio_${CallSid}`).get();
      if (lookupSnap.exists) {
        const { twilioSubaccountSid } = lookupSnap.data() as any;
        if (twilioSubaccountSid) {
          const secretsSnap = await db.doc(`twilio_subaccount_secrets/${twilioSubaccountSid}`).get();
          if (secretsSnap.exists) {
            authToken = secretsSnap.get('authToken');
          }
        }
      }
    }

    const provider = getVoiceProvider('twilio', {
      authToken: authToken,
    });

    if (!provider.validateWebhook(req, canonicalPublicBaseUrl)) {
      res.status(401).send("Unauthorized");
      return;
    }

    const { DialCallStatus } = req.body;
    const toNormalized = String(req.query.to || "");
    
    if (DialCallStatus === 'completed') {
      res.type('text/xml').send('<Response><Hangup/></Response>');
      return;
    }

    if (!toNormalized) {
        res.type('text/xml').send('<Response><Hangup/></Response>');
        return;
    }

    const lookupRef = db.doc(`phone_channel_lookups/twilio_voice_${toNormalized}`);
    const lookupSnap = await lookupRef.get();
    const voicemailEnabled = lookupSnap.exists ? !!lookupSnap.get('voicemailEnabled') : false;

    if (voicemailEnabled) {
      const twiml = provider.buildVoicemailTwiML({
        recordingCallbackUrl: `${canonicalPublicBaseUrl.replace(/\/$/, "")}/api/twilio/voice/recording`,
      });
      res.type('text/xml').send(twiml);
    } else {
      res.type('text/xml').send('<Response><Hangup/></Response>');
    }
  }
);
