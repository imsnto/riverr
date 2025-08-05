
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ServerClient } from 'postmark';

admin.initializeApp();

// Initialize Postmark client from secure config
// Set this by running: firebase functions:config:set postmark.key="YOUR_POSTMARK_API_KEY"
const postmarkKey = functions.config().postmark?.key;

if (!postmarkKey) {
  console.error('Postmark API key not set in Firebase Functions config. Set it with: firebase functions:config:set postmark.key="YOUR_KEY"');
}
const postmark = new ServerClient(postmarkKey);


export const sendInviteEmail = functions.firestore
  .document('invites/{email}')
  .onCreate(async (snap) => {
    if (!postmarkKey) {
      console.error('Cannot send email, Postmark key is not configured.');
      return;
    }
    
    const invite = snap.data();
    const to = invite.email;

    // TODO: Replace with your actual domain
    const loginUrl = 'https://timeflow-6i3eo.web.app/login'; 

    try {
      await postmark.sendEmail({
        From: 'no-reply@timeflow-6i3eo.web.app', // This must be a verified sender signature in Postmark
        To: to,
        Subject: 'You’ve been invited to Timeflow',
        HtmlBody: `
          <p>Hello,</p>
          <p>You’ve been invited to join a workspace on Timeflow.</p>
          <p><a href="${loginUrl}">Click here to sign in with Google</a>.</p>
          <p>If you were not expecting this, you can safely ignore this email.</p>
        `,
        TextBody: `You’ve been invited to Timeflow. Sign in here: ${loginUrl}`,
        MessageStream: 'outbound', // Or whatever your transactional stream is named
      });

      console.log(`✅ Invite email sent to ${to}`);
    } catch (err) {
      console.error(`❌ Failed to send invite to ${to}:`, err);
    }
  });
