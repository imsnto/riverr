import { onCall, HttpsError } from "firebase-functions/v2/https";
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

export const resendInvite = onCall({ secrets: [POSTMARK_SERVER_TOKEN, APP_BASE_URL] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in to resend an invitation.");

  const { inviteId } = request.data as { inviteId: string };
  if (!inviteId) throw new HttpsError("invalid-argument", "Missing inviteId.");

  const inviteRef = admin.firestore().doc(`invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError("not-found", "Invite not found.");

  const invite = inviteSnap.data() as any;

  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "This invite is no longer pending and cannot be sent.");
  }

  // Generate a NEW token to ensure the link is fresh
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);

  await inviteRef.update({
    tokenHash,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const baseUrl = APP_BASE_URL.value();
  const joinUrl = `${baseUrl}/join?invite=${encodeURIComponent(inviteId)}&token=${encodeURIComponent(rawToken)}`;

  const spaceName = invite.spaceName ?? "a workspace";

  await sendSystemEmail({
    to: invite.email,
    subject: `Reminder: You’ve been invited to join ${spaceName}`,
    orgId: invite.spaceId,
    tag: "invite_reminder",
    metadata: { inviteId },
    htmlBody: `
      <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
        <h2>Reminder: You’ve been invited to join <b>${spaceName}</b></h2>
        <p>Click below to accept your invitation:</p>
        <p><a href="${joinUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Accept invitation</a></p>
        <p style="color:#777; font-size: 12px;">
          If you weren’t expecting this, you can ignore this email. This link replaces any previous invitation links.
        </p>
      </div>
    `,
    textBody: `Reminder: You've been invited to join ${spaceName}. Accept here: ${joinUrl}`,
  });

  return { success: true, message: "Invitation resent successfully." };
});
