import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import postmark from "postmark";

admin.initializeApp();

// ✅ Postmark API Client (Riverr Project Management)
const client = new postmark.ServerClient("eed163d1-398a-40f8-b555-8ec1c5a53ae5");

export const sendInviteEmail = functions.firestore
  .document("invites/{inviteId}")
  .onCreate(async (snap, context) => {
    const invite = snap.data();
    const { email } = invite;

    const inviteLink = `https://riverr.app/login`; // ✅ Replace with your actual login page URL

    try {
      await client.sendEmail({
        From: '"Bradley from Riverr" <brad@riverr.app>', // ✅ Verified sender
        To: email,
        Subject: `You're invited to join Riverr`,
        HtmlBody: `
          <p>Hey there,</p>
          <p>You've been invited to join <strong>Riverr Project Management</strong>.</p>
          <p><a href="${inviteLink}">Click here to sign in with Google</a>.</p>
          <p>If you weren’t expecting this invitation, you can ignore this email.</p>
          <br>
          <p>— Bradley & the Riverr Team</p>
        `,
        MessageStream: "outbound", // Default stream unless you created a custom one
      });

      console.log(`Invite email sent to ${email}`);
    } catch (error) {
      console.error("Error sending invite email:", error);
    }
  });
