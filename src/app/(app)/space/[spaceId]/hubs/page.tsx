
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { addHub, getHubsForSpace } from '@/lib/db';
import { Hub } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export default function HubSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { appUser, activeSpace, setActiveHub, getUserPermissions } = useAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const spaceId = params.spaceId as string;
  
  const userPermissions = activeSpace ? getUserPermissions(activeSpace.id) : null;
  const isSpaceAdmin = userPermissions?.role === 'Admin';


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
  
  const handleCreateHub = async () => {
    if (!appUser || !activeSpace) return;
    const newHubData: Partial<Hub> = {
        name: 'New Hub',
        type: 'project-management', // default type
        settings: { components: ['tasks'], defaultView: 'tasks' },
    };
    try {
        await addHub({ ...newHubData, spaceId: activeSpace.id, createdBy: appUser.id, isDefault: false, createdAt: new Date().toISOString() } as Omit<Hub, 'id'>);
        // Refetch hubs after creation
        const fetchedHubs = await getHubsForSpace(activeSpace.id);
        setHubs(fetchedHubs);
    } catch(e) {
        console.error("Failed to create hub", e)
    }
  }


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
          This space doesn't have any hubs configured yet.
        </p>
         {isSpaceAdmin && (
            <Button onClick={handleCreateHub} className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                Create a Hub
            </Button>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-12">
        <div className="text-center flex-1">
            <h1 className="text-4xl font-bold tracking-tight">Select a Hub</h1>
            <p className="mt-3 text-lg text-muted-foreground">
            Choose a hub to continue to your workspace.
            </p>
        </div>
        {isSpaceAdmin && (
            <Button onClick={handleCreateHub}>
                <Plus className="mr-2 h-4 w-4" />
                New Hub
            </Button>
        )}
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

