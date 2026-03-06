import { TwilioMessagingProvider } from './providers/twilio/TwilioMessagingProvider';
import { TwilioVoiceProvider } from './providers/twilio/TwilioVoiceProvider';
import { MessagingProvider } from './providers/MessagingProvider';
import { VoiceProvider } from './providers/VoiceProvider';

/**
 * Returns a messaging provider instance.
 * Supports credential overrides for multi-tenant subaccounts.
 */
export function getMessagingProvider(
  providerName: 'twilio',
  overrides?: { accountSid?: string; authToken?: string }
): MessagingProvider {
  if (providerName === 'twilio') {
    const accountSid = overrides?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = overrides?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(`Twilio messaging credentials missing.`);
    }
    return new TwilioMessagingProvider(accountSid, authToken);
  }
  throw new Error(`Unsupported provider: ${providerName}`);
}

/**
 * Returns a voice provider instance.
 * Supports credential overrides for multi-tenant subaccounts.
 */
export function getVoiceProvider(
  providerName: 'twilio',
  overrides?: { authToken?: string }
): VoiceProvider {
  if (providerName === 'twilio') {
    const authToken = overrides?.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      throw new Error(`Twilio voice credentials missing.`);
    }
    return new TwilioVoiceProvider(authToken);
  }
  throw new Error(`Unsupported voice provider: ${providerName}`);
}
