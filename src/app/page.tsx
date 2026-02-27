
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
            const realSpaces = userSpaces.filter(s => !s.isSystem);
            const onboardingSpace = userSpaces.find(s => s.isOnboarding);

            // If they have real spaces, they don't need onboarding, even if an onboarding space exists.
            if (realSpaces.length > 0) {
                const lastSpace = localStorage.getItem('timeflow_active_space_v2');
                const lastHub = localStorage.getItem('timeflow_active_hub_v2');

                if (lastSpace && lastHub) {
                    try {
                        const space = JSON.parse(lastSpace);
                        const hub = JSON.parse(lastHub);
                        
                        // Verify the cached space still exists in their list
                        if (realSpaces.some(s => s.id === space.id)) {
                            const defaultView = hub.settings?.defaultView || 'overview';
                            router.push(`/space/${space.id}/hub/${hub.id}/${defaultView}`);
                            return;
                        }
                    } catch (e) {
                        // fallback to selection
                    }
                }
                
                if (activeSpace && activeHub) {
                    const defaultView = activeHub.settings?.defaultView || 'overview';
                    router.push(`/space/${activeSpace.id}/hub/${activeHub.id}/${defaultView}`);
                } else {
                    router.push('/space-selection');
                }
                return;
            }

            // Only show onboarding if they have an onboarding space and no real ones.
            if (onboardingSpace && !appUser?.onboardingComplete) {
                router.push('/onboarding');
                return;
            }

            // Fallback for edge cases
            router.push('/space-selection');
        }
    }, [status, router, activeSpace, activeHub, userSpaces, appUser]);

    return <DashboardSkeleton />;
}
