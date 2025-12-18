// src/components/FirebaseErrorListener.tsx
'use client';
import { useEffect } from 'react';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';

const isDevelopment = process.env.NODE_ENV === 'development';

export default function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // In development, we throw the error to show the Next.js error overlay
      if (isDevelopment) {
        throw error;
      }
      
      // In production, we show a friendly toast message
      console.error('Firestore Permission Error:', error);
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to perform this action.',
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
