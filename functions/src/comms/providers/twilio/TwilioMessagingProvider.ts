
import * as twilio from 'twilio';
import { MessagingProvider, InboundSms, SmsStatus } from '../MessagingProvider';

export class TwilioMessagingProvider implements MessagingProvider {
  readonly name = 'twilio';
  private client: twilio.Twilio;

  constructor(private accountSid: string, private authToken: string) {
    this.client = twilio(accountSid, authToken);
  }

  /**
   * Validates that the request genuinely came from Twilio using a canonical base URL.
   */
  validateWebhook(req: any): boolean {
    const signature = req.headers["x-twilio-signature"] || "";
    const baseUrl = process.env.PUBLIC_BASE_URL;
    if (!baseUrl) {
      console.error("TwilioMessagingProvider: PUBLIC_BASE_URL is not defined in environment.");
      return false;
    }

    // Twilio signs the exact URL it requested.
    const url = baseUrl.replace(/\/$/, "") + req.originalUrl;

    // Body MUST be parsed from x-www-form-urlencoded into a plain object (handled by default in CF v2)
    const params = req.body || {};

    return twilio.validateRequest(this.authToken, signature, url, params);
  }

  /**
   * Maps a Twilio request body to a normalized InboundSms object.
   */
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
      body: b.Body,
      providerMessageId: b.MessageSid,
      media: media.length > 0 ? media : undefined,
    };
  }

  /**
   * Maps a Twilio status callback to a normalized SmsStatus object.
   */
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

  /**
   * Sends an outbound SMS via Twilio.
   */
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
