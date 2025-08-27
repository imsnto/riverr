
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Dashboard from '@/app/(app)/page';

// This page is now a router/redirector based on auth and space/hub state.
// The actual dashboard UI is now primarily rendered by the hub view at /space/[spaceId]/hub/[hubId]/[view]
export default function RootPage() {
    const { status, activeSpace, activeHub, userSpaces } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            if (activeSpace && activeHub) {
                // If we have a cached space AND hub, go directly to the hub's default view
                 const defaultView = activeHub.isDefault ? (activeHub.settings?.defaultView || 'tasks') : 'tasks';
                router.push(`/space/${activeSpace.id}/hub/${activeHub.id}/${defaultView}`);
            } else if (activeSpace) {
                // If we only have a space, go to hub selection for that space
                router.push(`/space/${activeSpace.id}/hubs`);
            } else if (userSpaces.length > 0) {
                 // If we have spaces but none is active, go to space selection
                 router.push('/space-selection');
            } else {
                // User has no spaces, maybe show a "create a space" page in the future
                // For now, they will just see the loader.
            }
        }
    }, [status, activeSpace, activeHub, userSpaces, router]);

    // Show a loading indicator while we figure out where to go
    return (
       <div className="flex h-screen items-center justify-center">
            <p>Loading your workspace...</p>
        </div>
    );
}
