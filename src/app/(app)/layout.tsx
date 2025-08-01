
'use client';

import { AuthProvider } from '@/hooks/use-auth';

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthProvider>{children}</AuthProvider>;
}
