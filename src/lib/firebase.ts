// src/lib/firebase.ts
'use client'
import { getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, Messaging } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase-init';

const app = firebaseApp;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.warn("FCM not supported in this browser.");
  }
}

export { app, auth, db, storage, googleProvider, signInWithPopup, signOut, messaging };
