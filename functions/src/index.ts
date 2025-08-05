import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as postmark from 'postmark';

admin.initializeApp();

// ✅ Make sure this matches your *Invite Users (Riverr Project Management)* server
const POSTMARK_API_KEY = 'eed163d1-398a-40f8-b555-8ec1c5a53ae5';
const FROM_EMAIL = 'brad@riverr.app';
const POSTMARK_STREAM = 'defaultTransactional'; // ✅ Name of your transactional stream
const DOMAIN = 'app.riverr.app'; // ✅ Must match your verified domain

const postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);

export const sendInviteEmail = functions.firestore
  .document('invites/{inviteId}')
  .onCreate(async (snap, context) => {
    const invite = snap.data();

    if (!invite?.email || !invite?.token) {
      console.error('Missing email or token in invite document');
      return;
    }

    const inviteLink = `https://${DOMAIN}/invite?token=${invite.token}`;

    try {
      await postmarkClient.sendEmail({
        From: FROM_EMAIL,
        To: invite.email,
        Subject: `You've been invited to join Riverr`,
        HtmlBody: `
          <h2>You’ve been invited to join Riverr Project Management</h2>
          <p>Hello!</p>
          <p>You’ve been invited to join the Riverr workspace. Click the button below to accept your invite and sign in using your Google account:</p>
          <p><a href="${inviteLink}" style="background-color:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;">Accept Invite</a></p>
          <p>If you did not expect this invite, you can safely ignore this email.</p>
        `,
        MessageStream: POSTMARK_STREAM,
      });

      console.log(`Invite email sent to ${invite.email}`);
    } catch (error) {
      console.error(`Error sending invite to ${invite.email}:`, error);
    }
  });
