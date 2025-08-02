'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Dashboard from '@/app/(app)/page';

export default function RootPage() {
    const { status, firebaseUser } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center">
                <p>Loading...</p>
            </div>
        )
    }

    if (status === 'authenticated' && firebaseUser) {
        return <Dashboard />;
    }

    return (
       <div className="flex h-screen items-center justify-center">
            <p>Loading...</p>
        </div>
    );
}