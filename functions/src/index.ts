
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { EmailConfig } from "../../src/lib/data";

if (!admin.apps.length) admin.initializeApp();

// Daily Email Watch Renewal
export const renewEmailWatches = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days buffer

  // 1. Renew Hub Watches
  const hubQuerySnap = await db.collectionGroup("emailConfigs")
    .where("connected", "==", true)
    .where("watchConfig.expiresAt", "<=", cutoff.toISOString())
    .get();

  for (const doc of hubQuerySnap.docs) {
    console.log(`Renewing hub watch for ${doc.data().emailAddress}`);
  }

  // 2. Renew Agent Watches
  const agentIndexSnap = await db.collection("emailIndex")
    .where("type", "==", "agent")
    .get();

  for (const indexDoc of agentIndexSnap.docs) {
    const { userId, emailConfigId } = indexDoc.data();
    const configRef = db.doc(`users/${userId}/emailConfigs/${emailConfigId}`);
    const configSnap = await configRef.get();
    
    if (configSnap.exists) {
      const config = configSnap.data() as EmailConfig;
      if (config.connected && config.watchConfig?.expiresAt && new Date(config.watchConfig.expiresAt) <= cutoff) {
        console.log(`Renewing agent watch for ${config.emailAddress}`);
      }
    }
  }
});

// Exports
export { sendInviteEmail } from "./sendInviteEmail";
export { acceptInvite } from "./acceptInvite";
export { resendInvite } from "./resendInvite";
export { onVisitorMessageCreated } from "./onVisitorMessageCreated";
export { processBrainJob } from "./processBrainJob";
export { onChatMessageCreated } from "./chatNotifications/metadataTriggers";
export { 
  sendAgentChatAlertEmail, 
  sendVisitorReplyEmail,
  scheduledAcknowledgementEmail 
} from "./chatNotifications/emailNotifications";
export { onSmsMessageCreated } from "./chat/botTrigger";
export { twilioSmsInbound } from "./http/twilioSmsInbound";
export { twilioSmsStatus } from "./http/twilioSmsStatus";
export { sendCommsMessage } from "./http/sendCommsMessage";
export { twilioVoiceInbound } from "./http/twilioVoiceInbound";
export { twilioVoiceStatus } from "./http/twilioVoiceStatus";
export { twilioVoiceRecording } from "./http/twilioVoiceRecording";
export { twilioVoiceDialResult } from "./http/twilioVoiceDialResult";
export { provisionTwilioSubaccount, searchNumbers, buyPhoneNumber } from "./twilio/provisioning";
export { onChatMessageCreatedForInsight } from "./chat/insightTrigger";
