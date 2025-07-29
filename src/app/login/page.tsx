// src/app/login/page.tsx
'use client';

import { auth, googleProvider, signInWithPopup, signOut } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { GanttChart } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const { status } = useAuth();

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // The useAuth hook will handle redirection on successful login.
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Error signing in with Google', error);
        setError(error.message || 'An unexpected error occurred during sign-in.');
      }
    }
  };
  
  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center">Authenticating...</div>;
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <GanttChart className="mx-auto h-8 w-8" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to TimeFlow
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>
        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>
                    {error}
                </AlertDescription>
            </Alert>
        )}
        <Button onClick={handleGoogleSignIn} disabled={status === 'loading'}>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
