
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { addHub, getHubsForSpace } from '@/lib/db';
import { Hub, Status } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import CreateHubDialog, { HubFormValues } from '@/components/dashboard/create-hub-dialog';
import { ContentSkeleton } from '@/components/dashboard/content-skeleton';

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: '#6b7280' },
    { name: 'In Progress', color: '#3b82f6' },
    { name: 'In Review', color: '#f59e0b' },
    { name: 'Done', color: '#22c55e' },
];

export default function HubSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { appUser, userSpaces, setActiveHub } = useAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const spaceId = params.spaceId as string;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const activeSpace = userSpaces.find(s => s.id === spaceId);
  const userPermissions = activeSpace && appUser ? activeSpace.members[appUser.id] : null;
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
    const defaultView = hub.settings?.defaultView || 'overview';
    router.push(`/space/${spaceId}/hub/${hub.id}/${defaultView}`);
  };
  
  const handleCreateHub = () => {
    setIsCreateDialogOpen(true);
  }

  const handleSaveHub = async (values: HubFormValues) => {
    if (!appUser || !activeSpace) return;
    const newHubData: Omit<Hub, 'id'> = {
        name: values.name,
        type: 'project-management',
        settings: { components: values.components, defaultView: 'overview' },
        spaceId: activeSpace.id, 
        createdBy: appUser.id, 
        isDefault: false, 
        createdAt: new Date().toISOString(),
        isPrivate: false,
        memberIds: [],
        statuses: defaultStatuses,
    };
    try {
        await addHub(newHubData);
        const fetchedHubs = await getHubsForSpace(activeSpace.id);
        setHubs(fetchedHubs);
    } catch(e) {
        console.error("Failed to create hub", e)
    }
  }


  if (isLoading) {
    return <ContentSkeleton />;
  }
  
  if (hubs.length === 0) {
     return (
        <>
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
             <CreateHubDialog 
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSave={handleSaveHub}
            />
        </>
    );
  }

  return (
    <>
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
      <CreateHubDialog 
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveHub}
      />
    </>
  );
}
