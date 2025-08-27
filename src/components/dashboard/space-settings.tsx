
// src/components/dashboard/space-settings.tsx
'use client';

import React, { useState } from 'react';
import { Hub, Space, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SpaceFormDialog from './space-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { createDefaultHubForSpace, addSpace as dbAddSpace, getSpacesForUser } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';


const getInitials = (name: string) => {
  return name ? name.split(' ').map(n => n[0]).join('') : '';
};

interface SpaceSettingsProps {
    allSpaces: Space[];
    allUsers: User[];
    onSave: (space: Omit<Space, 'id' | 'statuses'>, spaceId?: string) => void;
    onDelete: (spaceId: string) => void;
    appUser: User | null;
}

export default function SpaceSettings({ allUsers, onSave, onDelete, appUser }: SpaceSettingsProps) {
  const { userSpaces, setUserSpaces, setActiveSpace, setActiveHub } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  if (!appUser) return null;

  const handleCreateNew = () => {
    setSelectedSpace(null);
    setIsFormOpen(true);
  };

  const handleEdit = (space: Space) => {
    setSelectedSpace(space);
    setIsFormOpen(true);
  };
  
  const handleDelete = (spaceId: string) => {
    onDelete(spaceId);
    toast({ title: 'Space Deleted', description: 'The space has been successfully deleted.' });
  }

  const handleSaveAndClose = async (spaceData: Omit<Space, 'id' | 'statuses'>, hubData: Omit<Hub, 'id' | 'spaceId' | 'createdAt' | 'createdBy'>) => {
    if (selectedSpace) {
      // Logic for updating a space and its hubs would go here
      onSave(spaceData, selectedSpace.id);
      toast({ title: 'Space Updated', description: 'The space has been successfully updated.' });
    } else {
        const newSpaceId = await dbAddSpace(spaceData);
        await createDefaultHubForSpace(newSpaceId, appUser.id, hubData);
        
        // Refresh spaces and set active
        const updatedSpaces = await getSpacesForUser(appUser.id);
        setUserSpaces(updatedSpaces);
        const newSpace = updatedSpaces.find(s => s.id === newSpaceId);
        if (newSpace) {
            setActiveSpace(newSpace);
            setActiveHub(null); // Clear hub so user is forced to select one
        }

        toast({ title: 'Space Created', description: 'The space and a default hub have been created.' });
        router.push(`/space/${newSpaceId}/hubs`);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>Manage Spaces</CardTitle>
                <CardDescription>Create new spaces and manage existing ones.</CardDescription>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Space
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userSpaces.map(space => {
              const members = Object.keys(space.members).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
              return (
                <div key={space.id} className="border p-4 rounded-lg flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold">{space.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex -space-x-2 overflow-hidden">
                                {members.slice(0, 5).map(member => (
                                    <Avatar key={member.id} className="inline-block h-6 w-6 rounded-full border-2 border-card">
                                        <AvatarImage src={member.avatarUrl} />
                                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                    </Avatar>
                                ))}
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {members.length} member{members.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(space)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(space.id)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SpaceFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSaveAndClose}
        space={selectedSpace}
        allUsers={allUsers}
        currentUser={appUser}
      />
    </>
  );
}
