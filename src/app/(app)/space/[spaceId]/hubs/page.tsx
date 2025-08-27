
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getHubsForSpace } from '@/lib/db';
import { Hub } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function HubSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { setActiveHub } = useAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const spaceId = params.spaceId as string;

  useEffect(() => {
    if (spaceId) {
      getHubsForSpace(spaceId)
        .then((fetchedHubs) => {
          setHubs(fetchedHubs);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch hubs:", error);
          setIsLoading(false);
        });
    }
  }, [spaceId]);

  const handleHubSelect = (hub: Hub) => {
    setActiveHub(hub);
    const defaultView = hub.isDefault ? (hub.settings?.defaultView || 'tasks') : 'tasks';
    router.push(`/space/${spaceId}/hub/${hub.id}/${defaultView}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading hubs...</p>
      </div>
    );
  }
  
  if (hubs.length === 0) {
     return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <h1 className="text-3xl font-bold">No Hubs Found</h1>
        <p className="mt-2 text-muted-foreground">
          This space doesn't have any hubs configured yet. An admin can create one in the space settings.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Select a Hub</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Choose a hub to continue to your workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {hubs.map((hub) => (
          <Card
            key={hub.id}
            className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
            onClick={() => handleHubSelect(hub)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <span>{hub.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Type: {hub.type}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
