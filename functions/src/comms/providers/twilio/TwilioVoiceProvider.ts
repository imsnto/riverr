
import { twiml, validateRequest } from 'twilio';
import { VoiceProvider, InboundCall, CallStatus } from '../VoiceProvider';

export class TwilioVoiceProvider implements VoiceProvider {
  readonly name = 'twilio';

  constructor(private authToken: string) {}

  validateWebhook(req: any, baseUrl: string): boolean {
    const signature = req.headers["x-twilio-signature"] || "";
    const url = baseUrl.replace(/\/$/, "") + req.originalUrl;
    const params = req.body || {};
    return validateRequest(this.authToken, signature, url, params);
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
    
    // Optional: add a short whisper or announcement here
    // response.say('Forwarding call to Manowar agent.');

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
