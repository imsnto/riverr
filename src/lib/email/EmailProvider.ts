
/**
 * @fileOverview Shared types and interface for email providers.
 */

import { EmailTokens, WatchConfig, EmailProviderName } from "@/lib/data";

export interface ParsedEmailEvent {
  emailAddress: string;
  providerPayload: unknown;
}

export interface ParsedEmail {
  providerMessageId: string;
  providerThreadId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  bodyText: string;
  receivedAt: Date;
  hasAttachments: boolean;
  isAutoReply: boolean;
  headers: {
    messageId: string;
    inReplyTo?: string;
    references?: string;
  };
}

export interface EmailReply {
  toAddress: string;
  subject: string;
  bodyText: string;
  inReplyToHeader: string;
  referencesHeader: string;
  providerThreadId: string;
}

export interface SentEmailResult {
  providerMessageId: string;
  sentAt: Date;
}

export interface EmailProvider {
  readonly providerName: EmailProviderName;

  // OAuth
  getAuthUrl(hubId: string, emailConfigId: string): string;
  exchangeCodeForTokens(code: string): Promise<EmailTokens>;
  refreshTokens(refreshToken: string): Promise<EmailTokens>;
  getConnectedAddress(tokens: EmailTokens): Promise<string>;

  // Inbound watch
  setupWatch(tokens: EmailTokens, webhookUrl: string): Promise<WatchConfig>;
  renewWatch(tokens: EmailTokens, watchConfig: WatchConfig): Promise<WatchConfig>;
  teardownWatch(tokens: EmailTokens, watchConfig: WatchConfig): Promise<void>;
  parseWebhookPayload(payload: unknown): Promise<ParsedEmailEvent>;
  fetchNewMessages(tokens: EmailTokens, watchConfig: WatchConfig): Promise<ParsedEmail[]>;

  // Outbound
  sendReply(tokens: EmailTokens, reply: EmailReply): Promise<SentEmailResult>;
}
