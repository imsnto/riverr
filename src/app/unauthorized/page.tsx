'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, Home } from 'lucide-react';

/**
 * @fileOverview A user-friendly 403 Forbidden page.
 * Matching the requested branding while providing recovery options.
 */
export default function Forbidden() {
  const { signOut, status } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 text-center">
      <div className="space-y-6 max-w-md animate-in fade-in zoom-in-95 duration-500">
        <h1 className="text-4xl font-bold">403. <span className="text-muted-foreground font-normal">That’s an error.</span></h1>
        <p className="text-lg leading-relaxed">
          We're sorry, but you do not have access to this page. <span className="text-muted-foreground">That’s all we know.</span>
        </p>
        
        <div className="pt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default" className="px-8 h-11 font-bold rounded-xl shadow-lg shadow-primary/20">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return to Home
            </Link>
          </Button>
          
          {status === 'authenticated' && (
            <Button 
              variant="outline" 
              className="px-8 h-11 font-bold rounded-xl"
              onClick={() => {
                signOut();
                window.location.href = '/login';
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Switch Account
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-12">
          If you believe this is an error, please ensure your domain is authorized in the Firebase Console.
        </p>
      </div>
    </div>
  );
}
