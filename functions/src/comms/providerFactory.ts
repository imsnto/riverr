
import { TwilioMessagingProvider } from './providers/twilio/TwilioMessagingProvider';
import { MessagingProvider } from './providers/MessagingProvider';

export function getMessagingProvider(providerName: 'twilio'): MessagingProvider {
  if (providerName === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials missing in environment.');
    }
    return new TwilioMessagingProvider(accountSid, authToken);
  }
  throw new Error(`Unsupported provider: ${providerName}`);
}
