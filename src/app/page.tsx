
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function RootPage() {
    const { status, activeSpace, activeHub, userSpaces } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            const onboardingSpace = userSpaces.find(s => s.isOnboarding);

            if (onboardingSpace) {
                router.push('/onboarding');
                return;
            }

            const lastSpace = localStorage.getItem('timeflow_active_space_v2');
            const lastHub = localStorage.getItem('timeflow_active_hub_v2');

            if (lastSpace && lastHub) {
                try {
                    const space = JSON.parse(lastSpace);
                    const hub = JSON.parse(lastHub);
                    const defaultView = hub.settings?.defaultView || 'overview';
                    router.push(`/space/${space.id}/hub/${hub.id}/${defaultView}`);
                } catch (e) {
                    router.push('/space-selection');
                }
            } else if (activeSpace && activeHub) {
                const defaultView = activeHub.settings?.defaultView || 'overview';
                router.push(`/space/${activeSpace.id}/hub/${activeHub.id}/${defaultView}`);
            } else {
                router.push('/space-selection');
            }
        }
    }, [status, router, activeSpace, activeHub, userSpaces]);

    return <DashboardSkeleton />;
}
