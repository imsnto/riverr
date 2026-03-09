
/**
 * @fileOverview Email orchestration layer.
 * Handles Firestore sync, token management, and provider integration.
 */

import { adminDB } from "@/lib/firebase-admin";
import { getEmailProvider } from "./EmailProviderFactory";
import { EmailProviderName, EmailTokens, EmailConfig, Conversation, ChatMessage } from "@/lib/data";
import { ParsedEmail, EmailReply } from "./EmailProvider";
import crypto from "crypto";

// For AES-256-CBC token encryption
const ENCRYPTION_KEY = process.env.EMAIL_TOKEN_SECRET || "your-default-secret-at-least-32-chars"; 
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export class EmailService {
  async initiateConnection(spaceId: string, hubId: string, providerName: EmailProviderName): Promise<{ authUrl: string; emailConfigId: string }> {
    const provider = getEmailProvider(providerName);
    const emailConfigRef = adminDB.collection("spaces").doc(spaceId).collection("hubs").doc(hubId).collection("emailConfigs").doc();
    const authUrl = provider.getAuthUrl(hubId, emailConfigRef.id);
    
    // Save a pending config
    await emailConfigRef.set({
      id: emailConfigRef.id,
      provider: providerName,
      connected: false,
      createdAt: new Date().toISOString(),
    });

    return { authUrl, emailConfigId: emailConfigRef.id };
  }

  async completeConnection(spaceId: string, hubId: string, emailConfigId: string, code: string, userId: string): Promise<void> {
    const configRef = adminDB.doc(`spaces/${spaceId}/hubs/${hubId}/emailConfigs/${emailConfigId}`);
    const configSnap = await configRef.get();
    if (!configSnap.exists) throw new Error("Pending email configuration not found");

    const configData = configSnap.data() as EmailConfig;
    const provider = getEmailProvider(configData.provider);

    // 1. Exchange code
    const tokens = await provider.exchangeCodeForTokens(code);
    const emailAddress = await provider.getConnectedAddress(tokens);

    // 2. Check uniqueness index
    const indexRef = adminDB.collection("emailIndex").doc(emailAddress);
    const indexSnap = await indexRef.get();
    if (indexSnap.exists) {
      const existing = indexSnap.data();
      await configRef.delete(); // Cleanup pending
      throw new Error(`This email address is already connected to hub ${existing?.hubId} in space ${existing?.spaceId}`);
    }

    // 3. Setup Watch
    const watchConfig = await provider.setupWatch(tokens, "");

    // 4. Encrypt and save
    await configRef.update({
      emailAddress,
      connected: true,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenExpiry: tokens.tokenExpiry,
      watchConfig,
      connectedBy: userId,
      connectedAt: new Date().toISOString(),
      aiMode: "off"
    });

    // 5. Write to index
    await indexRef.set({
      spaceId,
      hubId,
      emailConfigId,
      connectedAt: new Date().toISOString(),
    });
  }

  async handleInboundWebhook(providerName: EmailProviderName, payload: unknown): Promise<void> {
    const provider = getEmailProvider(providerName);
    const { emailAddress } = await provider.parseWebhookPayload(payload);

    // 1. Lookup address
    const indexSnap = await adminDB.collection("emailIndex").doc(emailAddress).get();
    if (!indexSnap.exists) return;
    const { spaceId, hubId, emailConfigId } = indexSnap.data()!;

    // 2. Load Config
    const configRef = adminDB.doc(`spaces/${spaceId}/hubs/${hubId}/emailConfigs/${emailConfigId}`);
    const configSnap = await configRef.get();
    if (!configSnap.exists) return;
    const configData = configSnap.data() as EmailConfig;

    // 3. Tokens
    const tokens = await this.getFreshTokens(configData);
    
    // 4. Fetch
    const newEmails = await provider.fetchNewMessages(tokens, configData.watchConfig!);

    // 5. Process Each
    for (const email of newEmails) {
      if (email.isAutoReply) continue;

      // Deduplicate
      const existingMsgQuery = await adminDB.collection("chat_messages").where("providerMessageId", "==", email.providerMessageId).limit(1).get();
      if (!existingMsgQuery.empty) continue;

      // Match or Create Conversation
      const conversationId = await this.matchOrCreateConversation(spaceId, hubId, email, emailConfigId);

      // Add Message
      const messageData: Omit<ChatMessage, "id"> = {
        conversationId,
        authorId: "visitor", // Logic to map to Contact if needed
        type: "message",
        content: email.bodyText || "No message body",
        timestamp: email.receivedAt.toISOString(),
        senderType: "visitor",
        channel: "email",
        provider: providerName,
        providerMessageId: email.providerMessageId,
        emailHeaders: email.headers,
        hasAttachments: email.hasAttachments,
        emptyBody: !email.bodyText,
      };
      await adminDB.collection("chat_messages").add(messageData);

      // Update Conversation metadata
      await adminDB.collection("conversations").doc(conversationId).update({
        lastMessageAt: messageData.timestamp,
        lastMessage: email.bodyText.slice(0, 140),
        lastMessageAuthor: email.fromName || email.fromAddress,
        updatedAt: new Date().toISOString()
      });

      // 6. Trigger AI Draft (Stubs for now)
      if (configData.aiMode !== "off") {
        // await triggerAiDraft(...)
      }
    }

    // 7. Update historyId
    if (newEmails.length > 0) {
        // provider.historyId logic...
    }
  }

  async sendReply(spaceId: string, hubId: string, conversationId: string, replyText: string, agentId: string): Promise<void> {
    const convoSnap = await adminDB.doc(`conversations/${conversationId}`).get();
    const convo = convoSnap.data() as Conversation;
    if (!convo || convo.channel !== "email") throw new Error("Invalid email conversation");

    const configRef = adminDB.doc(`spaces/${spaceId}/hubs/${hubId}/emailConfigs/${convo.emailConfigId!}`);
    const configSnap = await configRef.get();
    const configData = configSnap.data() as EmailConfig;

    const provider = getEmailProvider(configData.provider);
    const tokens = await this.getFreshTokens(configData);

    // Get most recent customer message for headers
    const lastCustomerMsg = await adminDB.collection("chat_messages")
      .where("conversationId", "==", conversationId)
      .where("senderType", "==", "visitor")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    
    const lastHeaders = lastCustomerMsg.docs[0]?.data()?.emailHeaders;

    const reply: EmailReply = {
      toAddress: convo.emailFromAddress!,
      subject: convo.emailSubject!.startsWith("Re:") ? convo.emailSubject! : `Re: ${convo.emailSubject}`,
      bodyText: replyText,
      inReplyToHeader: lastHeaders?.messageId || "",
      referencesHeader: (lastHeaders?.references ? lastHeaders.references + " " : "") + (lastHeaders?.messageId || ""),
      providerThreadId: convo.emailThreadId!,
    };

    const result = await provider.sendReply(tokens, reply);

    // Write to Firestore
    await adminDB.collection("chat_messages").add({
      conversationId,
      authorId: agentId,
      type: "message",
      senderType: "agent",
      responderType: "human",
      content: replyText,
      timestamp: result.sentAt.toISOString(),
      channel: "email",
      provider: configData.provider,
      providerMessageId: result.providerMessageId,
    });
  }

  private async getFreshTokens(config: EmailConfig): Promise<EmailTokens> {
    const tokens: EmailTokens = {
      accessToken: decrypt(config.accessToken),
      refreshToken: decrypt(config.refreshToken),
      tokenExpiry: config.tokenExpiry,
    };

    if (new Date(tokens.tokenExpiry).getTime() < Date.now() + 5 * 60000) {
      const provider = getEmailProvider(config.provider);
      const newTokens = await provider.refreshTokens(tokens.refreshToken);
      
      const configRef = adminDB.doc(`spaces/${config.id}`); // This path might need mapping fix depending on where config ID comes from
      // We actually need the full path from the config lookup
      // Simplified here: update Firestore with new tokens
      return newTokens;
    }
    return tokens;
  }

  private async matchOrCreateConversation(spaceId: string, hubId: string, email: ParsedEmail, emailConfigId: string): Promise<string> {
    // Strategy 1: Provider Thread ID
    const byThread = await adminDB.collection("conversations")
      .where("hubId", "==", hubId)
      .where("channel", "==", "email")
      .where("emailThreadId", "==", email.providerThreadId)
      .limit(1)
      .get();

    if (!byThread.empty) return byThread.docs[0].id;

    // Strategy 2: Headers (Fallback for cross-service threads)
    if (email.headers.inReplyTo) {
        // Query by messageId...
    }

    // Strategy 3: Create New
    const convoRef = await adminDB.collection("conversations").add({
      spaceId,
      hubId,
      channel: "email",
      emailConfigId,
      emailThreadId: email.providerThreadId,
      emailSubject: email.subject,
      emailFromAddress: email.fromAddress,
      emailFromName: email.fromName,
      status: "new",
      lastMessage: email.bodyText.slice(0, 140),
      lastMessageAt: email.receivedAt.toISOString(),
      lastMessageAuthor: email.fromName || email.fromAddress,
      updatedAt: new Date().toISOString()
    });

    return convoRef.id;
  }
}

export const emailService = new EmailService();
