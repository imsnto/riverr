

'use client';

import { Button } from '@/components/ui/button';
import { GanttChart } from 'lucide-react';

export default function LoginPage() {
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <GanttChart className="mx-auto h-8 w-8" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to TimeFlow
          </h1>
          <p className="text-sm text-muted-foreground">
            Authentication is currently disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
