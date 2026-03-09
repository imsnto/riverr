
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects legacy /profile route to the unified Settings dashboard.
 */
export default function ProfileRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/settings?view=profile');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-muted-foreground text-sm animate-pulse">Redirecting to settings...</p>
        </div>
    );
}
