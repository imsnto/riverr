
// src/components/dashboard/space-settings.tsx
'use client';

import React, { useRef, useState } from 'react';
import { User, Space, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Upload, Loader2, Trash2, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { uploadSpaceLogo } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

interface SpaceSettingsProps {
    activeSpace: Space;
    allUsers: User[];
    onSave: (spaceData: Partial<Omit<Space, 'id'>>, spaceId?: string) => void;
    onDelete: (spaceId: string) => void;
    appUser: User | null;
}

export default function SpaceSettings({ activeSpace, onSave, onDelete, appUser }: SpaceSettingsProps) {
  const { setUserSpaces, userSpaces, setActiveSpace, setActiveHub } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState(activeSpace.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSpace) return;

    setIsUploading(true);
    try {
      const logoUrl = await uploadSpaceLogo(file, activeSpace.id);
      await onSave({ logoUrl }, activeSpace.id);
      
      // Update local context
      const updatedSpace = { ...activeSpace, logoUrl };
      setActiveSpace(updatedSpace);
      setUserSpaces(userSpaces.map(s => s.id === activeSpace.id ? updatedSpace : s));
      
      toast({ title: 'Logo updated successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Logo upload failed.' });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGeneralSave = () => {
    onSave({ name }, activeSpace.id);
    setActiveSpace({ ...activeSpace, name });
    toast({ title: 'Space updated' });
  };

  const hasChanges = name !== activeSpace.name;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold">Space Settings</h1>
                <p className="text-muted-foreground text-sm">Manage the identity and configuration of <span className="font-semibold">{activeSpace.name}</span>.</p>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>Update your space's name and branding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="spaceName">Space Name</Label>
                    <Input id="spaceName" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="space-y-2">
                    <Label>Space Logo</Label>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 rounded-md">
                            <AvatarImage src={activeSpace.logoUrl} />
                            <AvatarFallback className="rounded-md text-2xl">
                                {getInitials(activeSpace.name)}
                            </AvatarFallback>
                        </Avatar>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} accept="image/*" />
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Change Logo
                        </Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
                <Button onClick={handleGeneralSave} disabled={!hasChanges}>Save Changes</Button>
            </CardFooter>
        </Card>

        <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Permanently remove this space and all of its data.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive" onClick={() => onDelete(activeSpace.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Space
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
