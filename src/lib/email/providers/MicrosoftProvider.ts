
import { EmailProvider, ParsedEmail, EmailReply, SentEmailResult, ParsedEmailEvent } from "../EmailProvider";
import { EmailTokens, WatchConfig } from "@/lib/data";

export class MicrosoftProvider implements EmailProvider {
  readonly providerName = "microsoft";

  getAuthUrl(): string {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async exchangeCodeForTokens(): Promise<EmailTokens> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async refreshTokens(): Promise<EmailTokens> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async getConnectedAddress(): Promise<string> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async setupWatch(): Promise<WatchConfig> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async renewWatch(): Promise<WatchConfig> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async teardownWatch(): Promise<void> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async parseWebhookPayload(): Promise<ParsedEmailEvent> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async fetchNewMessages(): Promise<ParsedEmail[]> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
  async sendReply(): Promise<SentEmailResult> {
    throw new Error("Microsoft 365 email provider not yet implemented");
  }
}
