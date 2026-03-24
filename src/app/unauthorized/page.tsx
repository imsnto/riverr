import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 text-center">
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-bold">403. <span className="text-muted-foreground font-normal">That’s an error.</span></h1>
        <p className="text-lg">
          We're sorry, but you do not have access to this page. <span className="text-muted-foreground">That’s all we know.</span>
        </p>
        <div className="pt-6">
          <Button asChild variant="outline">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
