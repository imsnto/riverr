import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as postmark from 'postmark';

admin.initializeApp();

// ✅ Use your verified Postmark info
const POSTMARK_API_KEY = 'eed163d1-398a-40f8-b555-8ec1c5a53ae5';
const FROM_EMAIL = 'brad@riverr.app';
const POSTMARK_STREAM = 'defaultTransactional'; // from your "Invite Users (Riverr Project Management)" server
const DOMAIN = 'app.riverr.app'; // your actual frontend domain (must be verified in Postmark)

const postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);

// Cloud Function to send invite email when a new invite is created in Firestore
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

      console.log(`✅ Invite email sent to ${invite.email}`);
    } catch (error) {
      console.error(`❌ Error sending invite to ${invite.email}:`, error);
    }
  });

// Cloud Function to process jobs from the Business Brain queue
export const processBrainJob = functions.firestore
  .document('brain_jobs/{jobId}')
  .onCreate(async (snap, context) => {
    const job = snap.data();
    const jobId = context.params.jobId;

    if (!job) {
      console.error(`Job ${jobId} has no data.`);
      return;
    }

    // Update job status to 'running'
    await snap.ref.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      console.log(`🧠 Processing job ${jobId} of type: ${job.type}`);

      // Future logic will go here based on job.type
      switch (job.type) {
        case 'ingest_conversations':
          // This is where STEP 2 (Ingest historical conversations) will be triggered.
          // For now, we'll just log it.
          console.log(`Starting conversation ingestion for source: ${job.params.source}`);
          // Placeholder for actual ingestion logic
          // await ingestConversations(job.params);
          break;
        // ... other job types will be added here
        default:
          console.warn(`Unknown job type: ${job.type}`);
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // If successful, update status to 'completed'
      await snap.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Successfully completed job ${jobId}`);

    } catch (error: any) {
      console.error(`❌ Failed to process job ${jobId}:`, error);
      await snap.ref.update({
        status: 'failed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
      });
    }
  });
