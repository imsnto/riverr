// src/app/(app)/space/[spaceId]/hub/[hubId]/[view]/page.tsx
'use client';
import Dashboard from '@/components/dashboard/dashboard';
import { useParams } from 'next/navigation';
import React from 'react';

export default function HubPage() {
  const params = useParams() as { view: string };
  
  return (
      <Dashboard view={params.view} />
  );
}
