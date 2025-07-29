
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  "projectId": "timeflow-6i3eo",
  "appId": "1:209410404537:web:bb2b7ff8376f1149e42b68",
  "storageBucket": "timeflow-6i3eo.firebasestorage.app",
  "apiKey": "AIzaSyAzD2lBIiXFdlngOKolF6NKmCeyyuxoZOw",
  "authDomain": "timeflow-6i3eo.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "209410404537"
};

export const firebaseApp: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
