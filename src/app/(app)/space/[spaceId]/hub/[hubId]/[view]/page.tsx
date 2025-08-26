
// src/app/(app)/space/[spaceId]/hub/[hubId]/[view]/page.tsx

'use client';

import React from 'react';

interface HubPageProps {
  params: {
    spaceId: string;
    hubId: string;
    view: string;
  };
}

export default function HubPage({ params }: HubPageProps) {
  // TODO: Fetch Hub data, permissions, and render the correct view component
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Hub View</h1>
      <p>Space ID: {params.spaceId}</p>
      <p>Hub ID: {params.hubId}</p>
      <p>View: {params.view}</p>
    </div>
  );
}
