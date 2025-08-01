
'use client';

import { auth, googleProvider, signInWithPopup } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { GanttChart } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';

function LoginContent() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        setStatus('authenticated');
        router.push('/');
      } else {
        setStatus('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error('Error signing in with Google', error);
        setError(error.message || 'An unexpected error occurred during sign-in.');
      }
    }
  };
  
  if (status === 'loading' || status === 'authenticated') {
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
        <Button onClick={handleGoogleSignIn}>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
