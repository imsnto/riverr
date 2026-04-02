
// functions/src/chatNotifications/metadataTriggers.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

const CONFIRMATION_PHRASES = [
  "fixed it", "works now", "that worked", "resolved", "all set",
  "thanks so much", "thank you", "perfect", "great", "got it"
];

function safeSnippet(text: string, maxLen = 180) {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + "…";
}

/**
 * Unified trigger to update conversation metadata for ALL messages.
 * This ensures O(1) performance for scheduled follow-ups and UI sorting.
 * Using a transaction to ensure race-safe updates.
 */
export const onChatMessageCreated = onDocumentCreated(
  {
    document: "chat_messages/{messageId}",
     memory: "512MiB",
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
    
    // Convert message timestamp string to Firestore Timestamp
    let msgTs: admin.firestore.Timestamp;
    if (message.timestamp) {
        msgTs = admin.firestore.Timestamp.fromDate(new Date(message.timestamp));
    } else {
        msgTs = admin.firestore.Timestamp.now();
    }

    try {
      const conversationRef = db.doc(`conversations/${conversationId}`);
      const snippet = safeSnippet(content);

      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(conversationRef);
        const conv = convSnap.exists ? (convSnap.data() as any) : {};

        const currentLastMessageAt: admin.firestore.Timestamp | undefined = conv?.lastMessageAt;
        const currentLastMessageMs = currentLastMessageAt ? currentLastMessageAt.toMillis() : 0;
        const msgMs = msgTs.toMillis();

        const updates: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // 1. Detect Customer Confirmation
        if (senderType === "visitor" || senderType === "contact") {
          const lowerContent = content.toLowerCase();
          if (CONFIRMATION_PHRASES.some(phrase => lowerContent.includes(phrase))) {
            updates.customerConfirmed = true;
            updates.customerConfirmationAt = msgTs;
            // Also suggest auto-resolution for certain channels
            if (conv.resolutionStatus === 'unresolved') {
              updates.resolutionStatus = 'resolved';
              updates.resolutionSource = 'customer_confirmed';
              updates.resolvedAt = msgTs;
            }
          }
        }

        // 2. Track per-sender latest
        if (senderType === "visitor" || senderType === "contact") {
          const lastVisitorMs = conv?.lastVisitorMessageAt ? conv.lastVisitorMessageAt.toMillis() : 0;
          if (msgMs >= lastVisitorMs) {
            updates.lastVisitorMessageAt = msgTs;
          }
          // Detection for starting a new session
          if (!conv?.startedAt) {
            updates.startedAt = msgTs;
          }
        } else if (senderType === "agent" || senderType === "bot") {
          const lastAgentMs = conv?.lastAgentMessageAt ? conv.lastAgentMessageAt.toMillis() : 0;
          if (msgMs >= lastAgentMs) {
            updates.lastAgentMessageAt = msgTs;
            updates.lastAgentMessageSnippet = snippet;
          }
        }

        // Update the global "last message" only if this is the newest message
        if (msgMs >= currentLastMessageMs) {
          updates.lastMessage = snippet;
          updates.lastMessageAt = msgTs;
          updates.lastMessageFrom = senderType;
        }

        if (Object.keys(updates).length > 0) {
          tx.set(conversationRef, updates, { merge: true });
        }
      });

      logger.debug("Updated conversation metadata (race-safe)", { conversationId, senderType, messageId });
    } catch (err: any) {
      logger.error("onChatMessageCreated metadata update failed", {
        conversationId,
        messageId,
        error: err?.message ?? err,
      });
    }
  }
);
