// src/components/dashboard/space-settings.tsx
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Space, Invite, SpaceMember, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, Upload, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SpaceFormDialog, { HubFormValues } from './space-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { addHub, addSpace as dbAddSpace, getSpacesForUser, uploadSpaceLogo } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

interface SpaceSettingsProps {
    allUsers: User[];
    onSave: (spaceData: Partial<Omit<Space, 'id'>>, spaceId?: string) => void;
    onDelete: (spaceId: string) => void;
    appUser: User | null;
}

export default function SpaceSettings({ allUsers, onSave, onDelete, appUser }: SpaceSettingsProps) {
  const { userSpaces, setUserSpaces, setActiveSpace, setActiveHub, activeSpace } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(activeSpace?.id || null);

  useEffect(() => {
    if (!selectedSpaceId && userSpaces.length > 0) {
        const nonSystemSpaces = userSpaces.filter(s => !s.isSystem);
        if (nonSystemSpaces.length > 0) {
          setSelectedSpaceId(nonSystemSpaces[0].id);
        }
    }
  }, [userSpaces, selectedSpaceId]);

  const selectedSpace = userSpaces.find(s => s.id === selectedSpaceId);

  if (!appUser) return null;

  const handleCreateNew = () => {
    setEditingSpace(null);
    setIsFormOpen(true);
  };

  const handleEdit = (space: Space) => {
    setEditingSpace(space);
    setIsFormOpen(true);
  };
  
  const handleDelete = (spaceId: string) => {
    onDelete(spaceId);
    if (selectedSpaceId === spaceId) {
      setSelectedSpaceId(userSpaces.filter(s => s.id !== spaceId)[0]?.id || null);
    }
    toast({ title: 'Space Deleted', description: 'The space has been successfully deleted.' });
  }

  const handleSaveAndClose = async (spaceData: Omit<Space, 'id'>, hubsData: HubFormValues[]) => {
    if (!appUser) return;
    if (editingSpace) {
      onSave(spaceData, editingSpace.id);
      toast({ title: 'Space Updated', description: 'The space has been successfully updated.' });
    } else {
        const newSpaceId = await dbAddSpace(spaceData);
        for (const hub of hubsData) {
            const finalHubData: Omit<Hub, 'id'> = {
                name: hub.name,
                spaceId: newSpaceId,
                type: 'project-management',
                createdAt: new Date().toISOString(),
                createdBy: appUser.id,
                isDefault: false,
                settings: { components: hub.components, defaultView: hub.components[0] || 'tasks' },
                isPrivate: hub.isPrivate,
                memberIds: hub.isPrivate ? hub.memberIds : [],
                statuses: hub.statuses
            };
            await addHub(finalHubData);
        }
        
        const updatedSpaces = await getSpacesForUser(appUser.id);
        setUserSpaces(updatedSpaces);
        const newSpace = updatedSpaces.find(s => s.id === newSpaceId);
        if (newSpace) {
            setActiveSpace(newSpace);
            setActiveHub(null);
            setSelectedSpaceId(newSpace.id);
        }

        toast({ title: 'Space Created', description: `The space and its ${hubsData.length} hub(s) have been created.` });
        router.push(`/space/${newSpaceId}/hubs`);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSpace) return;

    setIsUploading(true);
    try {
      const logoUrl = await uploadSpaceLogo(file, selectedSpace.id);
      await onSave({ logoUrl }, selectedSpace.id);
      
      const updatedSpaces = userSpaces.map(s => s.id === selectedSpace.id ? { ...s, logoUrl } : s);
      setUserSpaces(updatedSpaces);
      if (activeSpace?.id === selectedSpace.id) {
          setActiveSpace({ ...activeSpace, logoUrl });
      }
      
      toast({ title: 'Logo updated successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Logo upload failed.' });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <>
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div>
                    <h1 className="text-2xl font-bold">Spaces</h1>
                    <p className="text-muted-foreground">Create new spaces and manage existing ones.</p>
                </div>
                 <Button onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Space
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="space-y-2">
                        <Label>Select Space</Label>
                        <Select value={selectedSpaceId || ''} onValueChange={setSelectedSpaceId}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select a space to manage" />
                            </SelectTrigger>
                            <SelectContent>
                                {userSpaces.filter(s => !s.isSystem).map(space => (
                                    <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                {selectedSpace && (
                     <CardContent>
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg">{selectedSpace.name}</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(selectedSpace)}>
                                            <Edit className="mr-2 h-3 w-3" /> Edit Members
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedSpace.id)}>
                                            <Trash2 className="mr-2 h-3 w-3" /> Delete Space
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <Label>Space Logo</Label>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16 rounded-md">
                                            <AvatarImage src={selectedSpace.logoUrl} />
                                            <AvatarFallback className="rounded-md text-2xl">
                                                {getInitials(selectedSpace.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} accept="image/*" />
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                            Upload Logo
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     </CardContent>
                )}
                 {!selectedSpace && userSpaces.filter(s => !s.isSystem).length > 0 && (
                    <CardContent>
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">Select a space from the dropdown to manage its settings.</p>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>

        <SpaceFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveAndClose}
            space={editingSpace}
            allUsers={allUsers}
            currentUser={appUser}
        />
    </>
  );
}
