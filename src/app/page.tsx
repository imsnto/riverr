
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const { status, activeSpace, activeHub } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            if (activeSpace && activeHub) {
                const defaultView = activeHub.settings?.defaultView || 'tasks';
                router.push(`/space/${activeSpace.id}/hub/${activeHub.id}/${defaultView}`);
            } else {
                router.push('/space-selection');
            }
        }
    }, [status, router, activeSpace, activeHub]);

    return (
       <div className="flex h-screen items-center justify-center">
            <p>Loading...</p>
        </div>
    );
}
