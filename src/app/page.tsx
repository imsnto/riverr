
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function RootPage() {
    const { status, activeSpace, activeHub, userSpaces, appUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            // Priority 1: If onboarding is strictly NOT complete, always try to send them to /onboarding.
            if (!appUser?.onboardingComplete) {
                router.push('/onboarding');
                return;
            }

            // Priority 2: Onboarding is complete, handle normal navigation
            const realSpaces = userSpaces.filter(s => !s.isSystem);

            if (realSpaces.length > 0) {
                // First, check for explicitly set active context in the hook (which onboarding sets)
                if (activeSpace && activeHub) {
                    const defaultView = activeHub.settings?.defaultView || 'overview';
                    router.push(`/space/${activeSpace.id}/hub/${activeHub.id}/${defaultView}`);
                    return;
                }

                // Second, check for cached persistence
                const lastSpace = localStorage.getItem('timeflow_active_space_v2');
                const lastHub = localStorage.getItem('timeflow_active_hub_v2');

                if (lastSpace && lastHub) {
                    try {
                        const space = JSON.parse(lastSpace);
                        const hub = JSON.parse(lastHub);
                        
                        if (realSpaces.some(s => s.id === space.id)) {
                            const defaultView = hub.settings?.defaultView || 'overview';
                            router.push(`/space/${space.id}/hub/${hub.id}/${defaultView}`);
                            return;
                        }
                    } catch (e) {
                        // fallback
                    }
                }
                
                // Fallback to selection if no clear context exists
                router.push('/space-selection');
                return;
            }

            // Fallback for edge cases
            router.push('/space-selection');
        }
    }, [status, router, activeSpace, activeHub, userSpaces, appUser?.onboardingComplete]);

    return <DashboardSkeleton />;
}
