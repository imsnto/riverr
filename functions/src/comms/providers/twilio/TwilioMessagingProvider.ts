import { Twilio, validateRequest } from 'twilio';
import { MessagingProvider, InboundSms, SmsStatus } from '../MessagingProvider';

export class TwilioMessagingProvider implements MessagingProvider {
  readonly name = 'twilio';
  private client: Twilio;

  constructor(private accountSid: string, private authToken: string) {
    this.client = new Twilio(accountSid, authToken);
  }

  /**
   * Validates that the request genuinely came from Twilio using a canonical base URL.
   */
  validateWebhook(req: any, canonicalPublicBaseUrl: string): boolean {
    const signature = req.headers["x-twilio-signature"] || "";
    if (!canonicalPublicBaseUrl) {
      console.error("TwilioMessagingProvider: canonicalPublicBaseUrl is not defined.");
      return false;
    }

    // Reconstruct exact URL signed by Twilio
    const pathAndQuery = req.originalUrl || req.url || "";
    const url = canonicalPublicBaseUrl.replace(/\/$/, "") + pathAndQuery;

    // Params MUST be the raw form-encoded body
    const params = req.body || {};

    const isValid = validateRequest(this.authToken, signature, url, params);
    
    if (!isValid) {
      console.warn("Twilio SMS signature validation failed", {
        url,
        signature: signature?.slice(0, 8) + "...",
        bodyKeys: Object.keys(params)
      });
    }

    return isValid;
  }

  parseInboundSms(req: any): InboundSms {
    const b = req.body;
    const media: { url: string; contentType?: string }[] = [];
    const numMedia = parseInt(b.NumMedia || '0', 10);
    
    for (let i = 0; i < numMedia; i++) {
      media.push({
        url: b[`MediaUrl${i}`],
        contentType: b[`MediaContentType${i}`],
      });
    }

    return {
      to: (b.To || '').trim(),
      from: (b.From || '').trim(),
      body: b.Body || "",
      providerMessageId: b.MessageSid,
      media: media.length > 0 ? media : undefined,
    };
  }

  parseSmsStatus(req: any): SmsStatus {
    const b = req.body;
    return {
      providerMessageId: b.MessageSid,
      status: this.mapStatus(b.MessageStatus),
      errorCode: b.ErrorCode,
      errorMessage: b.ErrorMessage,
    };
  }

  private mapStatus(twilioStatus: string): SmsStatus['status'] {
    switch (twilioStatus) {
      case 'accepted':
      case 'queued':
        return 'queued';
      case 'sending':
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'undelivered':
        return 'undelivered';
      case 'failed':
        return 'failed';
      default:
        return 'queued';
    }
  }

  async sendSms(args: {
    from: string;
    to: string;
    body: string;
    mediaUrls?: string[];
    statusCallbackUrl?: string;
  }): Promise<{ providerMessageId: string }> {
    const msg = await this.client.messages.create({
      from: args.from,
      to: args.to,
      body: args.body,
      mediaUrl: args.mediaUrls,
      statusCallback: args.statusCallbackUrl,
    });
    return { providerMessageId: msg.sid };
  }
}
