
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) admin.initializeApp();

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const acceptInvite = onCall({ memory: "512MiB" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const { inviteId, token } = request.data as { inviteId: string; token: string };
  if (!inviteId || !token) throw new HttpsError("invalid-argument", "Missing inviteId/token.");

  const inviteRef = admin.firestore().doc(`invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError("not-found", "Invite not found.");

  const invite = inviteSnap.data() as any;

  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "Invite is not pending.");
  }

  const tokenHash = sha256Hex(token);
  if (!invite.tokenHash || invite.tokenHash !== tokenHash) {
    throw new HttpsError("permission-denied", "Invalid invite token.");
  }

  if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date()) {
    throw new HttpsError("failed-precondition", "Invite has expired.");
  }

  const spaceId = invite.spaceId;
  if (!spaceId) throw new HttpsError("invalid-argument", "Invite missing spaceId.");

  const membershipId = `${spaceId}_${uid}`;
  const membershipRef = admin.firestore().doc(`memberships/${membershipId}`);
  const spaceRef = admin.firestore().doc(`spaces/${spaceId}`);

  const role = invite.spaceRole ?? "Member";

  // Atomically update the space member list and create the membership record
  await admin.firestore().runTransaction(async (transaction) => {
    // 1. Update the members map on the Space document (Crucial for Firestore rules and UI list)
    transaction.set(spaceRef, {
      [`members.${uid}`]: { 
        role: role 
      }
    }, { merge: true });

    // 2. Create the dedicated membership document
    transaction.set(membershipRef, {
      spaceId,
      userId: uid,
      spaceRole: role,
      hubs: invite.hubAccess
        ? Object.fromEntries(
            Object.entries(invite.hubAccess).map(([hubId, role]) => [hubId, { role }])
          )
        : {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      invitedBy: invite.createdBy ?? null,
    }, { merge: true });

    // 3. Mark invite as accepted
    transaction.update(inviteRef, {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedBy: uid,
    });
  });

  return { spaceId };
});
