
// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This is a simplified check. For production, you'd use environment variables
// and a more robust way to handle the private key.
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'timeflow-6i3eo',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-p8rhs@timeflow-6i3eo.iam.gserviceaccount.com',
  // In a real production environment, this key should be stored securely (e.g., in a secret manager)
  // and not hardcoded. The `replace` is to handle newline characters when passed as an env var.
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCp/v0p...\\n-----END PRIVATE KEY-----\\n').replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = admin.auth();
export const adminDB = admin.firestore();
