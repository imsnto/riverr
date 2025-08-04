// src/lib/firebase-init.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  projectId: 'timeflow-6i3eo',
  appId: '1:209410404537:web:bb2b7ff8376f1149e42b68',
  storageBucket: 'timeflow-6i3eo.appspot.com', // ✅ Corrected
  apiKey: 'AIzaSyAzD2lBIiXFdlngOKolF6NKmCeyyuxoZOw',
  authDomain: 'timeflow-6i3eo.firebaseapp.com',
  measurementId: '', // Optional: add if using analytics
  messagingSenderId: '209410404537'
};

export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
