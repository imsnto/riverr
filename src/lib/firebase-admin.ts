/**
 * @fileoverview Firebase Admin SDK initialization
 */
import admin from "firebase-admin";


if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // convert literal \n to real newlines
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  
  export const adminAuth = admin.auth();
  export const adminDB = admin.firestore();
  export const adminStorage = admin.storage().bucket();
  export default admin;