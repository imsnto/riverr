
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// Import the AI logic from the app source (shared codebase)
import { invokeAgent } from "../../../src/app/actions/chat";

/**
 * Automates bot responses for SMS conversations.
 * Webchat triggers AI from the client widget, but SMS requires a server-side trigger.
 */
export const onSmsMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data() as any;
    
    // Only respond to contact messages in SMS channels where the bot is active
    if (message.senderType !== "contact" || message.channel !== "sms") return;

    const conversationId = message.conversationId;
    if (!conversationId) return;

    const db = admin.firestore();
    const convoRef = db.doc(`conversations/${conversationId}`);
    const convoSnap = await convoRef.get();
    
    if (!convoSnap.exists) return;
    const convo = convoSnap.data() as any;

    // RULE: Only auto-respond if status is 'bot'
    if (convo.status !== "bot") {
      logger.debug("onSmsMessageCreated: skipping, status is not 'bot'", { conversationId });
      return;
    }

    // Load Bot Config for this hub
    const botsSnap = await db.collection("bots")
      .where("hubId", "==", convo.hubId)
      .where("isEnabled", "==", true)
      .limit(1)
      .get();

    if (botsSnap.empty) {
      logger.warn("onSmsMessageCreated: no active bot found for hub", { hubId: convo.hubId });
      return;
    }

    const botDoc = botsSnap.docs[0];
    const bot = { id: botDoc.id, ...botDoc.data() } as any;

    const incomingMessage = {
      id: event.params.messageId,
      role: "user" as const,
      text: message.content || "",
      createdAt: message.timestamp,
    };

    try {
      logger.info("onSmsMessageCreated: invoking AI for SMS", { conversationId });
      await invokeAgent({
        bot: {
          id: bot.id,
          hubId: bot.hubId,
          name: bot.name,
          allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
        },
        conversation: { id: convoSnap.id, ...convo },
        message: incomingMessage,
      });
    } catch (err: any) {
      logger.error("onSmsMessageCreated: AI invocation failed", {
        conversationId,
        error: err?.message ?? err,
      });
    }
  }
);
