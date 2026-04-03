/**
 * @fileoverview Firebase Admin SDK initialization
 */
import admin from "firebase-admin";

let isInitialized = false;
try {
  admin.app();
  isInitialized = true;
} catch {
  isInitialized = false;
}

if (!isInitialized) {
  const projectId = process.env.APP_ADMIN_PROJECT_ID;
  const clientEmail = process.env.APP_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.APP_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const hasExplicitServiceAccount = !!projectId && !!clientEmail && !!privateKey;

  admin.initializeApp(
    hasExplicitServiceAccount
      ? {
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket: "timeflow-6i3eo.appspot.com",
        }
      : {
          // In managed runtimes (Firebase/App Hosting), use default credentials.
          storageBucket: "timeflow-6i3eo.appspot.com",
        }
  );
}

export const adminAuth = admin.auth();
export const adminDB = admin.firestore();
export const adminStorage = admin.storage().bucket("timeflow-6i3eo.appspot.com");
export default admin;
