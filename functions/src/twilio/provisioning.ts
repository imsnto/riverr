
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Twilio } from "twilio";
import { logger } from "firebase-functions";
import { normalizePhoneFallback } from "../comms/utils";

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const PUBLIC_BASE_URL = defineSecret("PUBLIC_BASE_URL");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Creates a Twilio subaccount for a Space.
 */
export const provisionTwilioSubaccount = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] },
  async (request) => {
    const { spaceId } = request.data as { spaceId: string };
    if (!spaceId) throw new HttpsError("invalid-argument", "Missing spaceId");

    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

    // Auth Check
    const spaceSnap = await db.doc(`spaces/${spaceId}`).get();
    if (!spaceSnap.exists || spaceSnap.get(`members.${uid}.role`) !== 'Admin') {
      throw new HttpsError("permission-denied", "Only space admins can provision Twilio");
    }

    // Idempotency: Return existing if already provisioned
    const existingSid = spaceSnap.get('comms.twilio.subaccountSid');
    if (existingSid) return { subaccountSid: existingSid };

    const client = new Twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());

    try {
      const subaccount = await client.api.accounts.create({
        friendlyName: `TimeFlow - ${spaceSnap.get('name') || spaceId}`
      });

      // Save pointer on Space
      await spaceSnap.ref.set({
        comms: {
          twilio: {
            subaccountSid: subaccount.sid,
            status: 'active',
            provisionedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        }
      }, { merge: true });

      // Save sensitive Auth Token separately
      await db.doc(`twilio_subaccount_secrets/${subaccount.sid}`).set({
        spaceId,
        authToken: subaccount.authToken
      });

      return { subaccountSid: subaccount.sid };
    } catch (err: any) {
      logger.error("Failed to provision Twilio subaccount", err);
      throw new HttpsError("internal", "Twilio provisioning failed");
    }
  }
);

/**
 * Searches for available phone numbers in a subaccount.
 * Now resolves SID from Space ID for security.
 */
export const searchNumbers = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

    const { spaceId, countryCode, areaCode, type } = request.data as { 
      spaceId: string; 
      countryCode: string; 
      areaCode?: string;
      type: 'local' | 'tollFree' 
    };

    if (!spaceId || !countryCode) throw new HttpsError("invalid-argument", "Missing required params");

    const spaceSnap = await db.doc(`spaces/${spaceId}`).get();
    if (!spaceSnap.exists || spaceSnap.get(`members.${uid}.role`) !== 'Admin') {
      throw new HttpsError("permission-denied", "Only space admins can search numbers");
    }

    const subaccountSid = spaceSnap.get("comms.twilio.subaccountSid");
    if (!subaccountSid) throw new HttpsError("failed-precondition", "Twilio not provisioned for this space");

    // Fetch subaccount token
    const secretsSnap = await db.doc(`twilio_subaccount_secrets/${subaccountSid}`).get();
    if (!secretsSnap.exists) throw new HttpsError("not-found", "Subaccount credentials not found");

    const client = new Twilio(subaccountSid, secretsSnap.get('authToken'));

    try {
      let numbers;
      if (type === 'tollFree') {
        numbers = await client.availablePhoneNumbers(countryCode).tollFree.list({ limit: 10 });
      } else {
        numbers = await client.availablePhoneNumbers(countryCode).local.list({ areaCode, limit: 10 });
      }

      return { numbers: numbers.map(n => ({ 
        phoneNumber: n.phoneNumber, 
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region
      })) };
    } catch (err: any) {
      logger.error("Failed to search numbers", err);
      throw new HttpsError("internal", "Search failed");
    }
  }
);

/**
 * Buys a number and configures webhooks.
 * Now resolves SID from Space ID for security.
 */
export const buyPhoneNumber = onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PUBLIC_BASE_URL] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

    const { spaceId, phoneNumber } = request.data as { spaceId: string; phoneNumber: string };
    if (!spaceId || !phoneNumber) throw new HttpsError("invalid-argument", "Missing params");

    const spaceSnap = await db.doc(`spaces/${spaceId}`).get();
    if (!spaceSnap.exists || spaceSnap.get(`members.${uid}.role`) !== 'Admin') {
      throw new HttpsError("permission-denied", "Only space admins can buy numbers");
    }

    const subaccountSid = spaceSnap.get("comms.twilio.subaccountSid");
    if (!subaccountSid) throw new HttpsError("failed-precondition", "Twilio not provisioned for this space");

    const secretsSnap = await db.doc(`twilio_subaccount_secrets/${subaccountSid}`).get();
    if (!secretsSnap.exists) throw new HttpsError("not-found", "Subaccount credentials not found");

    const client = new Twilio(subaccountSid, secretsSnap.get('authToken'));
    const baseUrl = PUBLIC_BASE_URL.value().replace(/\/$/, "");

    try {
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber,
        smsUrl: `${baseUrl}/api/twilio/sms/inbound`,
        smsMethod: 'POST',
        voiceUrl: `${baseUrl}/api/twilio/voice/inbound`,
        voiceMethod: 'POST',
        statusCallback: `${baseUrl}/api/twilio/voice/status`,
        statusCallbackMethod: 'POST'
      });

      // Record ownership in Space
      await db.collection(`spaces/${spaceId}/commsNumbers`).add({
        sid: purchasedNumber.sid,
        phoneNumber: purchasedNumber.phoneNumber,
        friendlyName: purchasedNumber.friendlyName,
        subaccountSid,
        capabilities: purchasedNumber.capabilities,
        status: 'active',
        purchasedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, e164: purchasedNumber.phoneNumber };
    } catch (err: any) {
      logger.error("Failed to buy number", err);
      throw new HttpsError("internal", err.message || "Purchase failed");
    }
  }
);

/**
 * Assigns a number to a Hub server-side.
 * Firestore rules block direct client writes to routing docs.
 */
export const assignNumberToHub = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { spaceId, hubId, number, type, channelSettings } = request.data as {
    spaceId: string;
    hubId: string;
    number: any;
    type: 'sms' | 'voice';
    channelSettings?: any;
  };

  if (!spaceId || !hubId || !number?.phoneNumber) throw new HttpsError("invalid-argument", "Missing params");

  const spaceSnap = await db.doc(`spaces/${spaceId}`).get();
  if (!spaceSnap.exists || spaceSnap.get(`members.${uid}.role`) !== 'Admin') {
    throw new HttpsError("permission-denied", "Only space admins can assign numbers");
  }

  const e164 = number.phoneNumber;
  const toNormalized = normalizePhoneFallback(e164);
  const lookupId = `twilio_${type}_${toNormalized}`;
  
  await db.doc(`phone_channel_lookups/${lookupId}`).set({
    spaceId,
    hubId,
    channelAddress: e164,
    isActive: true,
    twilioSubaccountSid: number.subaccountSid,
    ...channelSettings
  });

  return { success: true };
});
