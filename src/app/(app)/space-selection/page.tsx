
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Space } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function SpaceSelectionPage() {
  const router = useRouter();
  const { userSpaces, setActiveSpace, setActiveHub } = useAuth();

  const handleSpaceSelect = (space: Space) => {
    setActiveSpace(space);
    setActiveHub(null); // Clear active hub when changing spaces
    router.push(`/space/${space.id}/hubs`);
  };

  if (userSpaces.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <h1 className="text-3xl font-bold">Welcome!</h1>
        <p className="mt-2 text-muted-foreground">
          It looks like you don't have any spaces yet. You can create one or wait for an invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Select a Space</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Choose a workspace to continue.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {userSpaces.map((space) => (
          <Card
            key={space.id}
            className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
            onClick={() => handleSpaceSelect(space)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <span>{space.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {Object.keys(space.members).length} member(s)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
