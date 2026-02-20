// functions/src/chatNotifications/metadataTriggers.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function safeSnippet(text: string, maxLen = 180) {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + "…";
}

/**
 * Unified trigger to update conversation metadata for ALL messages.
 * This ensures O(1) performance for scheduled follow-ups and UI sorting.
 */
export const onChatMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { messageId } = event.params;
    const message = snap.data() as any;

    if (!message || !message.conversationId) return;

    const conversationId = message.conversationId;
    const senderType = message.senderType;
    const content = message.content || "";
    const timestamp = message.timestamp ? admin.firestore.Timestamp.fromDate(new Date(message.timestamp)) : admin.firestore.FieldValue.serverTimestamp();

    try {
      const conversationRef = db.doc(`conversations/${conversationId}`);
      const snippet = safeSnippet(content);

      const updates: any = {
        lastMessage: snippet,
        lastMessageAt: timestamp,
        lastMessageFrom: senderType,
        updatedAt: timestamp,
      };

      if (senderType === "visitor" || senderType === "contact") {
        updates.lastVisitorMessageAt = timestamp;
        
        // Detection for starting a new session
        const convSnap = await conversationRef.get();
        if (convSnap.exists && !convSnap.get('startedAt')) {
            updates.startedAt = timestamp;
        }
      } else if (senderType === "agent" || senderType === "bot") {
        updates.lastAgentMessageAt = timestamp;
        updates.lastAgentMessageSnippet = snippet;
      }

      await conversationRef.set(updates, { merge: true });

      logger.debug("Updated conversation metadata", { conversationId, senderType, messageId });
    } catch (err: any) {
      logger.error("onChatMessageCreated metadata update failed", {
        conversationId,
        messageId,
        error: err?.message ?? err,
      });
    }
  }
);
