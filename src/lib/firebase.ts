
// src/lib/firebase.ts
'use client'
import { getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebaseApp } from '@/lib/firebase-init';

const app = firebaseApp;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();


let messaging: ReturnType<typeof getMessaging>;

if (typeof window !== "undefined" && "navigator" in window) {
  messaging = getMessaging(app);
}

export { app, auth, db, storage, googleProvider, signInWithRedirect, signOut, messaging, getToken, onMessage };
