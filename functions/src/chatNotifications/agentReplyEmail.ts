import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendSystemEmail } from "../email/sendSystemEmail";

export const onAgentReplyEmail = onDocumentUpdated(
  {
    document: "conversations/{convId}",
  },
  async (event) => {
    const after = event.data?.after.data() as any;
    const before = event.data?.before.data() as any;
    console.log(after,before)

    if (!after || !before) return;

    // 1. Is this a new message?
    const isNewMessage = after.lastMessageAt !== before.lastMessageAt;
    
    // 2. Is it from an agent? (Adjust 'agent' to match your field value)
    const isAgent = after.lastMessageFrom === "agent";

    if (!isNewMessage || !isAgent) return;

    // 3. Is visitor INACTIVE? (Check your string timestamp)
    const now = Date.now();
    const lastActive = after.lastVisitorActiveAt ? new Date(after.lastVisitorActiveAt).getTime() : 0;
    const isInactive = (now - lastActive) > 300000; // 5 minutes

    // 4. Send Email
    if (isInactive && after.visitorEmail) {
      // Check cooldown (optional, but keep it simple for now)
      await sendSystemEmail({
        to: after.visitorEmail,
        subject: `New message from ${after.lastMessageAuthor || "Support"}`,
        orgId: after.hubId,
        htmlBody: `
          <div>
            <p>${after.lastMessageAuthor || "Support"} says: ${after.lastMessage}</p>
          </div>
        `,
        tag: "agent_reply",
      });

      // Update cooldown flag
      await event?.data.after.ref.update({
        lastAgentReplyEmailAt: new Date().toISOString()
      });
    }
  }
);