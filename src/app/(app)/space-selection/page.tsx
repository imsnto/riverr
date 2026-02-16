'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Space, Hub, User } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SpaceFormDialog, { HubFormValues } from '@/components/dashboard/space-form-dialog';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import OnboardingGuide from '@/components/dashboard/OnboardingGuide';

export default function SpaceSelectionPage() {
  const router = useRouter();
  const { userSpaces, setActiveSpace, setActiveHub, appUser, setUserSpaces } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const { toast } = useToast();
  const [isOnboarding, setIsOnboarding] = useState(false);

  useEffect(() => {
    if (appUser && userSpaces.length === 0) {
      setIsOnboarding(true);
    }
    if (appUser) {
        db.getAllUsers().then(setAllUsers);
    }
  }, [appUser, userSpaces]);

  const handleSpaceSelect = (space: Space) => {
    setActiveSpace(space);
    setActiveHub(null); // Clear active hub when changing spaces
    router.push(`/space/${space.id}/hubs`);
  };

  const handleCreateNewSpace = () => {
    setIsFormOpen(true);
  };
  
 const handleSaveSpace = async (spaceData: Omit<Space, 'id'>, hubsData: HubFormValues[]) => {
    if (!appUser) return;
    try {
        const newSpaceId = await db.addSpace(spaceData);
        for (const hub of hubsData) {
            const finalHubData: Omit<Hub, 'id'> = {
                name: hub.name,
                spaceId: newSpaceId,
                type: 'project-management',
                createdAt: new Date().toISOString(),
                createdBy: appUser.id,
                isDefault: hubsData.length === 1,
                settings: { components: hub.components, defaultView: hub.components?.[0] || 'tasks' },
                isPrivate: hub.isPrivate,
                memberIds: hub.isPrivate ? hub.memberIds : [],
                statuses: hub.statuses
            };
            await db.addHub(finalHubData);
        }
        
        const updatedSpaces = await db.getSpacesForUser(appUser.id);
        setUserSpaces(updatedSpaces);
        const newSpace = updatedSpaces.find(s => s.id === newSpaceId);
        if (newSpace) {
            setActiveSpace(newSpace);
            setActiveHub(null);
        }

        toast({ title: 'Space Created', description: `The space and its ${hubsData.length} hub(s) have been created.` });
        router.push(`/space/${newSpaceId}/hubs`);
    } catch (e) {
        toast({ variant: "destructive", title: "Failed to create space" });
        console.error(e);
    }
  };

  if (isOnboarding) {
    return (
      <OnboardingGuide onComplete={() => {
        setIsOnboarding(false);
        handleCreateNewSpace();
      }}/>
    );
  }

  if (userSpaces.length === 0 && !isOnboarding) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <h1 className="text-3xl font-bold">Welcome!</h1>
        <p className="mt-2 text-muted-foreground">
          It looks like you don't have any spaces yet. You can create one or wait for an invitation.
        </p>
         <Button onClick={handleCreateNewSpace} className="mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Create a Space
        </Button>
         {appUser && <SpaceFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveSpace}
            space={null}
            allUsers={allUsers}
            currentUser={appUser}
        />}
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-12">
            <div className="text-center flex-1">
                <h1 className="text-4xl font-bold tracking-tight">Select a Space</h1>
                <p className="mt-3 text-lg text-muted-foreground">
                Choose a workspace to continue.
                </p>
            </div>
             <Button onClick={handleCreateNewSpace}>
                <Plus className="mr-2 h-4 w-4" />
                New Space
            </Button>
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
      {appUser && <SpaceFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSaveSpace}
        space={null}
        allUsers={allUsers}
        currentUser={appUser}
      />}
    </>
  );
}
