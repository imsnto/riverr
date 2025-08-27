// src/app/(app)/space/[spaceId]/hub/[hubId]/[view]/page.tsx
'use client';
import Dashboard from '@/components/dashboard/dashboard';

interface HubPageProps {
  params: {
    spaceId: string;
    hubId: string;
    view: string;
  };
}

export default function HubPage({ params }: HubPageProps) {
  // The Dashboard component now contains all the logic for layout and view rendering
  return <Dashboard view={params.view} />;
}
