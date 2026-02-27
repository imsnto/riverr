
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { updateUser } from '@/lib/db';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, firebaseUser, setAppUser } = useAuth();
  
  const inviteId = searchParams.get('invite');
  const token = searchParams.get('token');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!inviteId || !token) {
      setError('This invitation link is invalid or incomplete.');
      setIsLoading(false);
      return;
    }

    if (status === 'unauthenticated') {
        const redirectUrl = `/join?invite=${inviteId}&token=${token}`;
        router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
        return;
    }
    
    if (status === 'authenticated' && firebaseUser) {
      const acceptInvite = async () => {
        try {
          const functions = getFunctions(getApp());
          const acceptInviteFn = httpsCallable(functions, 'acceptInvite');
          const result = await acceptInviteFn({ inviteId, token });
          const { spaceId } = result.data as { spaceId: string };
          
          // Mark onboarding as complete for the user since they've joined a real space
          await updateUser(firebaseUser.uid, { onboardingComplete: true });
          setAppUser(prev => prev ? { ...prev, onboardingComplete: true } : null);

          // Redirect to the invited space
          router.push(`/space/${spaceId}/hubs`);
          
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Failed to accept the invitation. It may be expired or invalid.');
          setIsLoading(false);
        }
      };

      acceptInvite();
    }
  }, [status, firebaseUser, inviteId, token, router, setAppUser]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying invitation...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-6 left-6">
            <Image 
                src="/manowar.png"
                width={48}
                height={48}
                alt="Manowar Logo"
            />
        </div>
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>{error ? 'Invitation Error' : 'Invitation Accepted'}</CardTitle>
            </CardHeader>
            <CardContent>
                {error ? (
                    <p className="text-destructive">{error}</p>
                ) : (
                    <p>Redirecting you to your new workspace...</p>
                )}
                <Button onClick={() => router.push('/')} className="mt-4 w-full">
                    Go to Dashboard
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
