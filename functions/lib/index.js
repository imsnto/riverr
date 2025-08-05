"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInviteEmail = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const postmark = __importStar(require("postmark"));
admin.initializeApp();
// ✅ Use your verified Postmark info
const POSTMARK_API_KEY = 'eed163d1-398a-40f8-b555-8ec1c5a53ae5';
const FROM_EMAIL = 'brad@riverr.app';
const POSTMARK_STREAM = 'defaultTransactional'; // from your "Invite Users (Riverr Project Management)" server
const DOMAIN = 'app.riverr.app'; // your actual frontend domain (must be verified in Postmark)
const postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);
// Cloud Function to send invite email when a new invite is created in Firestore
exports.sendInviteEmail = functions.firestore
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
    }
    catch (error) {
        console.error(`❌ Error sending invite to ${invite.email}:`, error);
    }
});
