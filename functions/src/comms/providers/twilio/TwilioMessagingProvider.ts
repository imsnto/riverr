
import * as twilio from 'twilio';
import { MessagingProvider, InboundSms, SmsStatus } from '../MessagingProvider';

export class TwilioMessagingProvider implements MessagingProvider {
  readonly name = 'twilio';
  private client: twilio.Twilio;

  constructor(private accountSid: string, private authToken: string) {
    this.client = twilio(accountSid, authToken);
  }

  validateWebhook(req: any): boolean {
    const signature = req.headers['x-twilio-signature'];
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    const params = req.body;
    return twilio.validateRequest(this.authToken, signature, url, params);
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
      to: b.To,
      from: b.From,
      body: b.Body,
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
