// functions/src/email/sendSystemEmail.ts
//
// Shared Postmark email sender for Manowar.
// Reuses existing working Postmark server + sender signature.
// Sender is intentionally fixed for now: "Manowar <brad@riverr.app>"
// Reply-To can be configured per org in Firestore (organizations/{orgId}.emailSettings.replyToEmail)

import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as postmark from "postmark";
import { logger } from "firebase-functions";

const POSTMARK_SERVER_TOKEN = defineSecret("POSTMARK_SERVER_TOKEN");

// Fixed sender (temporary constraint, already verified in Postmark)
const DEFAULT_FROM = "Manowar <brad@riverr.app>";
const FALLBACK_REPLY_TO = "brad@riverr.app";

// Initialize admin once (safe even if other files also do this)
if (!admin.apps.length) admin.initializeApp();

export type SendSystemEmailArgs = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;

  /**
   * Optional orgId to lookup organizations/{orgId}.emailSettings.replyToEmail
   * If present, Reply-To will be set to that value (if valid).
   */
  orgId?: string;

  /**
   * Optional Postmark Tag (useful for filtering in Postmark UI)
   * e.g. "invite", "agent_alert", "visitor_followup"
   */
  tag?: string;

  /**
   * Optional Postmark Metadata (string key/value)
   * e.g. { conversationId: "...", inviteId: "..." }
   */
  metadata?: Record<string, string>;

  /**
   * Optional override. If provided, we will use this Reply-To (after validation)
   * and will NOT query Firestore for org settings.
   */
  replyToOverride?: string;

  /**
   * Optional override for From (not recommended right now).
   * Present only for future-proofing.
   */
  fromOverride?: string;
};

function isValidEmail(email: string): boolean {
  // Simple, pragmatic validation (good enough for Reply-To)
  // Avoid heavy regex; Postmark will also validate.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function getOrgReplyToEmail(orgId: string): Promise<string | null> {
  try {
    // Note: Adjust collection name to 'spaces' if your schema uses 'spaces' as organizations
    const snap = await admin.firestore().doc(`spaces/${orgId}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    const replyTo = data?.emailSettings?.replyToEmail;
    if (typeof replyTo === "string" && isValidEmail(replyTo)) return replyTo.trim();
    return null;
  } catch (err) {
    logger.warn("sendSystemEmail: failed to load org reply-to email", { orgId, err });
    return null;
  }
}

/**
 * Send an email via Postmark using the existing configured server.
 *
 * Notes:
 * - Uses fixed "From" for now: Manowar <brad@riverr.app>
 * - Sets Reply-To from org settings when orgId is provided
 * - Supports Postmark tag + metadata for debugging/analytics
 */
export async function sendSystemEmail(args: SendSystemEmailArgs): Promise<{ messageId?: string }> {
  const {
    to,
    subject,
    htmlBody,
    textBody,
    orgId,
    tag,
    metadata,
    replyToOverride,
    fromOverride,
  } = args;

  if (!to || !isValidEmail(to)) {
    throw new Error("sendSystemEmail: invalid `to` email address");
  }
  if (!subject?.trim()) {
    throw new Error("sendSystemEmail: missing `subject`");
  }
  if (!htmlBody?.trim()) {
    throw new Error("sendSystemEmail: missing `htmlBody`");
  }

  const client = new postmark.ServerClient(POSTMARK_SERVER_TOKEN.value());

  const from = (fromOverride && fromOverride.trim()) ? fromOverride.trim() : DEFAULT_FROM;

  // Resolve Reply-To:
  // 1) replyToOverride if valid
  // 2) org settings replyToEmail if orgId provided and valid
  // 3) fallback
  let replyTo: string | null = null;

  if (replyToOverride && isValidEmail(replyToOverride)) {
    replyTo = replyToOverride.trim();
  } else if (orgId) {
    replyTo = await getOrgReplyToEmail(orgId);
  }

  // If you prefer to omit Reply-To entirely unless configured, set this to null.
  // For now we default to a safe fallback so replies don't disappear.
  if (!replyTo) replyTo = FALLBACK_REPLY_TO;

  try {
    const res = await client.sendEmail({
      From: from,
      To: to.trim(),
      Subject: subject.trim(),
      HtmlBody: htmlBody,
      TextBody: textBody,
      ReplyTo: replyTo,
      Tag: tag,
      Metadata: metadata,
      MessageStream: "outbound", // Optional; remove if you don't use message streams
    } as any);

    // Postmark response usually includes MessageID
    const messageId = (res as any)?.MessageID || (res as any)?.MessageId;

    logger.info("sendSystemEmail: sent", {
      to,
      subject,
      orgId: orgId ?? null,
      tag: tag ?? null,
      messageId: messageId ?? null,
    });

    return { messageId };
  } catch (err: any) {
    logger.error("sendSystemEmail: failed", {
      to,
      subject,
      orgId: orgId ?? null,
      tag: tag ?? null,
      err: err?.message ?? err,
    });
    throw err;
  }
}
