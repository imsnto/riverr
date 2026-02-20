'use client';

import { useState, useEffect } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { useAuth } from './use-auth';
import { savePushToken } from '@/lib/db';

export function usePushNotifications() {
  const { appUser } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermissionAndRegister = async () => {
    if (!messaging || !appUser) return;

    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: 'YOUR_PUBLIC_VAPID_KEY' // Replace with your key from Firebase Console
        });

        if (token) {
          await savePushToken(appUser.id, token, navigator.userAgent);
          return true;
        }
      }
    } catch (error) {
      console.error("FCM registration failed:", error);
    }
    return false;
  };

  return { permission, requestPermissionAndRegister };
}
