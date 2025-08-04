
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 text-center">
      <h1 className="text-4xl font-bold text-destructive">🚫 Access Denied</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        You don’t have permission to view this page.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please contact an administrator if you believe this is a mistake.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
