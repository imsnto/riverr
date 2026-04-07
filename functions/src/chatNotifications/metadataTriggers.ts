
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

const RESOLVED_STATUSES = ['resolved', 'resolved_ai', 'resolved_human', 'resolved_user_confirmed'];

function safeSnippet(text: string, maxLen = 180) {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + "…";
}

/**
 * Unified trigger to update conversation metadata for ALL messages.
 * Also handles:
 * - Customer confirmation auto-resolve (resolved_user_confirmed)
 * - Auto-reopen when visitor messages a resolved conversation
 * - Setting aiFollowUpScheduledFor when bot replies
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

    let shouldWriteReopenMessage = false;

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

        if (senderType === "visitor" || senderType === "contact") {
          // 1. Auto-reopen resolved conversations when visitor sends a message
          if (RESOLVED_STATUSES.includes(conv.resolutionStatus)) {
            updates.resolutionStatus = 'unresolved';
            updates.resolvedAt = null;
            updates.aiFollowUpScheduledFor = null;
            updates.aiFollowUpSentAt = null;
            updates.reopenCount = admin.firestore.FieldValue.increment(1);
            updates.status = conv.assigneeId ? 'open' : 'ai_active';
            shouldWriteReopenMessage = true;
          }

          // 2. Clear any pending AI follow-up when visitor replies
          updates.aiFollowUpScheduledFor = null;

          // 3. Detect Customer Confirmation (only if currently unresolved)
          const lowerContent = content.toLowerCase();
          const isConfirmation = CONFIRMATION_PHRASES.some(phrase => lowerContent.includes(phrase));
          if (isConfirmation && (conv.resolutionStatus === 'unresolved' || shouldWriteReopenMessage === false)) {
            updates.customerConfirmed = true;
            updates.customerConfirmationAt = msgTs;
            if (conv.resolutionStatus === 'unresolved') {
              updates.resolutionStatus = 'resolved_user_confirmed';
              updates.resolutionSource = 'customer_confirmed';
              updates.resolvedAt = msgTs;
              updates.lastResolvedAt = msgTs;
              updates.aiFollowUpScheduledFor = null;
              updates.aiFollowUpSentAt = null;
            }
          }

          // 4. Track per-sender latest
          const lastVisitorMs = conv?.lastVisitorMessageAt ? conv.lastVisitorMessageAt.toMillis() : 0;
          if (msgMs >= lastVisitorMs) {
            updates.lastVisitorMessageAt = msgTs;
          }
          if (!conv?.startedAt) {
            updates.startedAt = msgTs;
          }

        } else if (senderType === "agent" || senderType === "bot") {
          const lastAgentMs = conv?.lastAgentMessageAt ? conv.lastAgentMessageAt.toMillis() : 0;
          if (msgMs >= lastAgentMs) {
            updates.lastAgentMessageAt = msgTs;
            updates.lastAgentMessageSnippet = snippet;
          }

          // 5. Schedule AI follow-up when bot replies
          if (senderType === "bot") {
            const followUpAt = new Date(msgTs.toDate().getTime() + 5 * 60 * 1000).toISOString();
            updates.aiFollowUpScheduledFor = followUpAt;
            updates.aiFollowUpSentAt = null;
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

      // Write system "Conversation reopened" message outside the transaction
      if (shouldWriteReopenMessage) {
        await db.collection('chat_messages').add({
          conversationId,
          authorId: 'system',
          senderType: 'system',
          type: 'event',
          content: 'Conversation reopened',
          timestamp: new Date().toISOString(),
          responderType: 'system',
        });
        logger.info("Conversation reopened by visitor message", { conversationId });
      }

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
