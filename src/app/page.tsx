
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const { status } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            router.push('/space-selection');
        }
    }, [status, router]);

    return (
       <div className="flex h-screen items-center justify-center">
            <p>Loading...</p>
        </div>
    );
}
