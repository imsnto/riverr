
'use client';

import React, { useState } from 'react';
import { Space, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SpaceFormDialog from './space-form-dialog';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
};

interface SpaceSettingsProps {
    allSpaces: Space[];
    allUsers: User[];
    setSpaces: (spaces: Space[]) => void;
    appUser: User | null;
}

export default function SpaceSettings({ allSpaces, allUsers, setSpaces, appUser }: SpaceSettingsProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const { toast } = useToast();

  const handleCreateNew = () => {
    setSelectedSpace(null);
    setIsFormOpen(true);
  };

  const handleEdit = (space: Space) => {
    setSelectedSpace(space);
    setIsFormOpen(true);
  };
  
  const handleDelete = (spaceId: string) => {
    setSpaces(allSpaces.filter(s => s.id !== spaceId));
    toast({ title: 'Space Deleted', description: 'The space has been successfully deleted.' });
  }

  const handleSave = (spaceData: Space) => {
    if (selectedSpace) {
      setSpaces(allSpaces.map(s => s.id === spaceData.id ? spaceData : s));
      toast({ title: 'Space Updated', description: 'The space has been successfully updated.' });
    } else {
      setSpaces([...allSpaces, { ...spaceData, id: `space-${Date.now()}`, members: [appUser!.id] }]);
      toast({ title: 'Space Created', description: 'The space has been successfully created.' });
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
            {allSpaces.map(space => {
              const members = space.members.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
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
        onSave={handleSave}
        space={selectedSpace}
        allUsers={allUsers}
      />
    </>
  );
}
