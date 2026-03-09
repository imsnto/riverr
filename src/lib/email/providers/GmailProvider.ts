
/**
 * @fileOverview Google Workspace (Gmail) provider implementation.
 */

import { google } from "googleapis";
import { EmailProvider, ParsedEmail, EmailReply, SentEmailResult, ParsedEmailEvent } from "../EmailProvider";
import { EmailTokens, WatchConfig } from "@/lib/data";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class GmailProvider implements EmailProvider {
  readonly providerName = "google";

  private getOAuthClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  getAuthUrl(hubId: string, emailConfigId: string): string {
    const client = this.getOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: JSON.stringify({ hubId, emailConfigId }),
    });
  }

  async exchangeCodeForTokens(code: string): Promise<EmailTokens> {
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      tokenExpiry: new Date(tokens.expiry_date!).toISOString(),
    };
  }

  async refreshTokens(refreshToken: string): Promise<EmailTokens> {
    const client = this.getOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { tokens } = await client.refreshAccessToken();
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || refreshToken,
      tokenExpiry: new Date(tokens.expiry_date!).toISOString(),
    };
  }

  async getConnectedAddress(tokens: EmailTokens): Promise<string> {
    const client = this.getOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data.email!;
  }

  async setupWatch(tokens: EmailTokens, webhookUrl: string): Promise<WatchConfig> {
    const client = this.getOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const gmail = google.gmail({ version: "v1", auth: client });

    // Note: process.env.GMAIL_PUBSUB_TOPIC must be set (e.g. projects/my-project/topics/gmail-notifications)
    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: process.env.GMAIL_PUBSUB_TOPIC,
        labelIds: ["INBOX"],
      },
    });

    return {
      historyId: res.data.historyId!,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async renewWatch(tokens: EmailTokens, watchConfig: WatchConfig): Promise<WatchConfig> {
    return this.setupWatch(tokens, ""); // Gmail doesn't use the URL directly here, it's bound to the topic
  }

  async teardownWatch(tokens: EmailTokens, watchConfig: WatchConfig): Promise<void> {
    const client = this.getOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const gmail = google.gmail({ version: "v1", auth: client });
    await gmail.users.stop({ userId: "me" });
  }

  async parseWebhookPayload(payload: any): Promise<ParsedEmailEvent> {
    // Pub/Sub payload structure
    const message = payload.message;
    const data = JSON.parse(Buffer.from(message.data, "base64").toString());
    return {
      emailAddress: data.emailAddress,
      providerPayload: data,
    };
  }

  async fetchNewMessages(tokens: EmailTokens, watchConfig: WatchConfig): Promise<ParsedEmail[]> {
    const client = this.getOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const gmail = google.gmail({ version: "v1", auth: client });

    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: watchConfig.historyId,
    });

    const messages: ParsedEmail[] = [];
    const addedMessages = history.data.history?.flatMap(h => h.messagesAdded || []) || [];

    for (const record of addedMessages) {
      if (!record.message?.id) continue;
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: record.message.id,
        format: "full",
      });

      const parsed = this.parseGmailMessage(msg.data);
      if (parsed) messages.push(parsed);
    }

    return messages;
  }

  private parseGmailMessage(data: any): ParsedEmail | null {
    const headers = data.payload.headers as any[];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    const fromRaw = getHeader("from") || "";
    const fromParts = fromRaw.match(/(.*)<(.*)>/);
    const fromName = fromParts ? fromParts[1].trim() : "";
    const fromAddress = fromParts ? fromParts[2].trim() : fromRaw.trim();

    // Check for auto-replies
    const autoSubmitted = getHeader("auto-submitted");
    const isAutoReply = !!autoSubmitted && autoSubmitted !== "no";

    // Extract body
    let bodyText = "";
    if (data.payload.parts) {
      const textPart = data.payload.parts.find((p: any) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        bodyText = Buffer.from(textPart.body.data, "base64").toString();
      } else {
        const htmlPart = data.payload.parts.find((p: any) => p.mimeType === "text/html");
        if (htmlPart?.body?.data) {
          bodyText = Buffer.from(htmlPart.body.data, "base64").toString().replace(/<[^>]+>/g, " ");
        }
      }
    } else if (data.payload.body?.data) {
      bodyText = Buffer.from(data.payload.body.data, "base64").toString();
    }

    return {
      providerMessageId: data.id,
      providerThreadId: data.threadId,
      subject: getHeader("subject") || "(No Subject)",
      fromAddress,
      fromName,
      bodyText: bodyText.trim(),
      receivedAt: new Date(parseInt(data.internalDate)),
      hasAttachments: !!data.payload.parts?.some((p: any) => p.filename),
      isAutoReply,
      headers: {
        messageId: getHeader("message-id"),
        inReplyTo: getHeader("in-reply-to"),
        references: getHeader("references"),
      },
    };
  }

  async sendReply(tokens: EmailTokens, reply: EmailReply): Promise<SentEmailResult> {
    const client = this.getOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const gmail = google.gmail({ version: "v1", auth: client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(reply.subject).toString("base64")}?=`;
    const messageParts = [
      `To: ${reply.toAddress}`,
      `Content-Type: text/plain; charset=utf-8`,
      "MIME-Version: 1.0",
      `Subject: ${utf8Subject}`,
      `In-Reply-To: ${reply.inReplyToHeader}`,
      `References: ${reply.referencesHeader}`,
      "",
      reply.bodyText,
    ];
    const message = messageParts.join("\n");

    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: reply.providerThreadId,
      },
    });

    return {
      providerMessageId: res.data.id!,
      sentAt: new Date(),
    };
  }
}
