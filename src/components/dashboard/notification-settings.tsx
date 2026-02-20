'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { updateUser } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

export default function NotificationSettings() {
  const { appUser, setAppUser } = useAuth();
  const { permission, requestPermissionAndRegister } = usePushNotifications();
  const { toast } = useToast();

  const prefs = appUser?.notificationPrefs || { pushEnabled: false, emailEnabled: true };

  const handleTogglePush = async (enabled: boolean) => {
    if (!appUser) return;

    if (enabled && permission !== 'granted') {
      const success = await requestPermissionAndRegister();
      if (!success) {
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings.'
        });
        return;
      }
    }

    const newPrefs = { ...prefs, pushEnabled: enabled };
    await updateUser(appUser.id, { notificationPrefs: newPrefs });
    setAppUser(prev => prev ? { ...prev, notificationPrefs: newPrefs } : null);
    toast({ title: `Push notifications ${enabled ? 'enabled' : 'disabled'}` });
  };

  const handleToggleEmail = async (enabled: boolean) => {
    if (!appUser) return;
    const newPrefs = { ...prefs, emailEnabled: enabled };
    await updateUser(appUser.id, { notificationPrefs: newPrefs });
    setAppUser(prev => prev ? { ...prev, notificationPrefs: newPrefs } : null);
    toast({ title: `Email notifications ${enabled ? 'enabled' : 'disabled'}` });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how you want to be notified of new visitor messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Web Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive browser notifications when a visitor messages you.</p>
            </div>
            <Switch checked={prefs.pushEnabled} onCheckedChange={handleTogglePush} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive an email summary of unread visitor messages.</p>
            </div>
            <Switch checked={prefs.emailEnabled} onCheckedChange={handleToggleEmail} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
