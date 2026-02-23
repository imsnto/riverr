import { twiml, validateRequest } from 'twilio';
import { VoiceProvider, InboundCall, CallStatus } from '../VoiceProvider';

export class TwilioVoiceProvider implements VoiceProvider {
  readonly name = 'twilio';

  constructor(private authToken: string) {}

  validateWebhook(req: any, canonicalPublicBaseUrl: string): boolean {
    const signature = req.headers["x-twilio-signature"] || "";
    if (!canonicalPublicBaseUrl) {
      console.error("TwilioVoiceProvider: canonicalPublicBaseUrl is not defined.");
      return false;
    }

    const pathAndQuery = req.originalUrl || req.url || "";
    const url = canonicalPublicBaseUrl.replace(/\/$/, "") + pathAndQuery;
    const params = req.body || {};

    const isValid = validateRequest(this.authToken, signature, url, params);

    if (!isValid) {
      console.warn("Twilio Voice signature validation failed", {
        url,
        signature: signature?.slice(0, 8) + "...",
        bodyKeys: Object.keys(params)
      });
    }

    return isValid;
  }

  parseInboundCall(req: any): InboundCall {
    const b = req.body;
    return {
      to: (b.To || '').trim(),
      from: (b.From || '').trim(),
      providerCallId: b.CallSid,
    };
  }

  parseCallStatus(req: any): CallStatus {
    const b = req.body;
    return {
      providerCallId: b.CallSid,
      status: b.CallStatus,
      durationSeconds: b.CallDuration ? parseInt(b.CallDuration, 10) : undefined,
    };
  }

  buildForwardTwiML(args: {
    forwardToE164: string;
    statusCallbackUrl: string;
    actionUrl?: string;
    recordVoicemail?: boolean;
  }): string {
    const response = new twiml.VoiceResponse();
    
    const dial = response.dial({
      timeout: 20,
      action: args.actionUrl,
      statusCallback: args.statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    dial.number(args.forwardToE164);

    return response.toString();
  }

  buildVoicemailTwiML(args: {
    greetingText?: string;
    recordingCallbackUrl: string;
  }): string {
    const response = new twiml.VoiceResponse();
    response.say(args.greetingText || 'Please leave a message after the tone.');
    response.record({
      action: args.recordingCallbackUrl,
      maxLength: 120,
      playBeep: true,
    });
    return response.toString();
  }
}
