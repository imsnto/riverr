import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import crypto from "crypto";
import { sendSystemEmail } from "./email/sendSystemEmail";

const POSTMARK_SERVER_TOKEN = defineSecret("POSTMARK_SERVER_TOKEN");
const APP_BASE_URL = defineSecret("APP_BASE_URL");

if (!admin.apps.length) admin.initializeApp();

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const sendInviteEmail = onDocumentCreated(
  {
    document: "invites/{inviteId}",
    secrets: [POSTMARK_SERVER_TOKEN, APP_BASE_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const inviteId = event.params.inviteId;
    const invite = snap.data() as any;

    // Prevent duplicate sends
    if (invite.tokenHash || invite.sentAt) return;

    // Generate raw token (only goes in the email)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);

    await snap.ref.update({
      tokenHash,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const baseUrl = APP_BASE_URL.value(); // https://manowar.cloud
    const joinUrl = `${baseUrl}/join?invite=${encodeURIComponent(
      inviteId
    )}&token=${encodeURIComponent(rawToken)}`;

    const spaceName = invite.spaceName ?? "a workspace";

    await sendSystemEmail({
      to: invite.email,
      subject: `You’ve been invited to join ${spaceName}`,
      orgId: invite.spaceId,
      tag: "invite",
      metadata: { inviteId },
      htmlBody: `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
          <h2>You’ve been invited to join <b>${spaceName}</b></h2>
          <p>Click below to accept your invitation:</p>
          <p><a href="${joinUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Accept invitation</a></p>
          <p style="color:#777; font-size: 12px;">
            If you weren’t expecting this, you can ignore this email.
          </p>
        </div>
      `,
    });
  }
);
