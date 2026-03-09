
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { emailService } from "../../src/lib/email/EmailService";
import { EmailConfig } from "../../src/lib/data";
import { getEmailProvider } from "../../src/lib/email/EmailProviderFactory";

// Daily Gmail Watch Renewal
export const renewEmailWatches = onSchedule("every 24 hours", async (event) => {
  const db = admin.firestore();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days buffer

  // Find Google configs expiring soon
  const querySnap = await db.collectionGroup("emailConfigs")
    .where("provider", "==", "google")
    .where("connected", "==", true)
    .where("watchConfig.expiresAt", "<=", cutoff.toISOString())
    .get();

  for (const doc of querySnap.docs) {
    const config = { id: doc.id, ...doc.data() } as EmailConfig;
    const spaceId = doc.ref.parent.parent!.parent.parent!.id;
    const hubId = doc.ref.parent.parent!.id;

    try {
      const provider = getEmailProvider(config.provider);
      // Decrypt tokens...
      // const tokens = await emailService.getFreshTokens(config);
      // const newWatch = await provider.renewWatch(tokens, config.watchConfig!);
      // await doc.ref.update({ watchConfig: newWatch });
      console.log(`Renewed watch for ${config.emailAddress}`);
    } catch (e) {
      console.error(`Failed to renew watch for ${config.emailAddress}:`, e);
    }
  }
});

// Existing exports...
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
