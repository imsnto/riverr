
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// TODO: Move invokeAgent to shared lib or duplicate for functions
// import { invokeAgent } from "../../../src/app/actions/chat";

/**
 * Automates bot responses for SMS conversations.
 * Webchat triggers AI from the client widget, but SMS requires a server-side trigger.
 * TEMPORARILY DISABLED - needs invokeAgent moved from frontend code
 */
export const onSmsMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
    memory: "512MiB",
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

    // TEMPORARILY DISABLED - invokeAgent not available in functions
    logger.warn("onSmsMessageCreated: AI invocation disabled - invokeAgent needs to be moved from frontend code", { conversationId });
    
    // TODO: Re-enable when invokeAgent is available in functions
    // await invokeAgent({...});
  }
);
