// src/app/(app)/space/[spaceId]/hub/[hubId]/[view]/page.tsx
'use client';
import Dashboard from '@/components/dashboard/dashboard';
import { useParams } from 'next/navigation';
import React from 'react';

export default function HubPage() {
  const params = useParams() as { view: string };
  // The Dashboard component now contains all the logic for layout and view rendering
  return <Dashboard view={params.view} />;
}
