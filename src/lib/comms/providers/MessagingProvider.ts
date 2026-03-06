export interface InboundSms {
  to: string;
  from: string;
  body: string;
  media?: { url: string; contentType?: string }[];
  providerMessageId: string;
}

export interface SmsStatus {
  providerMessageId: string;
  status: 'created' | 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
}

export interface MessagingProvider {
  name: string;
  /**
   * Validates that the request genuinely came from the provider.
   * @param req The raw request object.
   * @param canonicalPublicBaseUrl The public domain URL (e.g. https://app.example.com)
   */
  validateWebhook(req: any, canonicalPublicBaseUrl: string): boolean;
  parseInboundSms(req: any): InboundSms;
  parseSmsStatus(req: any): SmsStatus;
  sendSms(args: {
    from: string;
    to: string;
    body: string;
    mediaUrls?: string[];
    statusCallbackUrl?: string;
  }): Promise<{ providerMessageId: string }>;
}
