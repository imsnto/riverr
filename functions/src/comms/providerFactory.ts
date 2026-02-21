
import { TwilioMessagingProvider } from './providers/twilio/TwilioMessagingProvider';
import { MessagingProvider } from './providers/MessagingProvider';

/**
 * Returns a messaging provider instance.
 * In Cloud Functions v2, credentials are automatically mounted to process.env 
 * if they are included in the 'secrets' array of the function configuration.
 */
export function getMessagingProvider(
  providerName: 'twilio',
  overrides?: { accountSid?: string; authToken?: string }
): MessagingProvider {
  if (providerName === 'twilio') {
    const accountSid = overrides?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = overrides?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        `Twilio credentials missing. Ensure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set in the environment or passed as overrides.`
      );
    }
    return new TwilioMessagingProvider(accountSid, authToken);
  }
  throw new Error(`Unsupported provider: ${providerName}`);
}
