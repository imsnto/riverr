export interface InboundCall {
  to: string;
  from: string;
  providerCallId: string;
}

export interface CallStatus {
  providerCallId: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  durationSeconds?: number;
}

export interface VoiceProvider {
  name: string;
  /**
   * Validates that the request genuinely came from the provider.
   * @param req The raw request object.
   * @param canonicalPublicBaseUrl The public domain URL (e.g. https://app.example.com)
   */
  validateWebhook(req: any, canonicalPublicBaseUrl: string): boolean;
  parseInboundCall(req: any): InboundCall;
  parseCallStatus(req: any): CallStatus;
  buildForwardTwiML(args: {
    forwardToE164: string;
    statusCallbackUrl: string;
    actionUrl?: string;
    recordVoicemail?: boolean;
  }): string;
  buildVoicemailTwiML(args: {
    greetingText?: string;
    recordingCallbackUrl: string;
  }): string;
}
