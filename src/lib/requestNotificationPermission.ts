"use client";

import { use } from "react";
import { getToken, messaging, db } from "./firebase";
import { doc, setDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

let isFCMInitialized = false;

export const requestNotificationPermission = async (userId: string) => {
  if (isFCMInitialized) {
    console.log("FCM already initialized");
    return;
  }

  isFCMInitialized = true;
  try {
    if (typeof window === "undefined") return;

    // Ask for permission first
    const permission = await Notification.requestPermission();
    console.log("Permission:", permission);

    if (permission !== "granted") return;

    // Register Service Worker
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );

    // 🔥 Wait until service worker is ACTIVE
    await navigator.serviceWorker.ready;

    if (!registration) {
      console.error("Service worker registration failed");
      return;
    }

    if (!messaging) {
      console.error("Messaging not initialized");
      return;
    }

    // Get FCM Token
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("No FCM token generated");
      return;
    }

    // Save token with tier in Firestore
    await setDoc(
      doc(db, "fcmTokens", userId),
      {
        tokens: arrayUnion(token),
        updatedAt: serverTimestamp(),
        id: userId,
      },
      { merge: true },
    );

    console.log("FCM Token:", token);

    // TODO: Save token to DB for this user
  } catch (error) {
    isFCMInitialized = false;
    console.error("Error Requesting Notification Permission:", error);
  }
};
