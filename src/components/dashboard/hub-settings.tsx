
// src/components/dashboard/hub-settings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Hub, User } from '@/lib/data';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import HubComponentEditor from './hub-component-editor';
import { Users } from 'lucide-react';
import HubPermissionDialog from './hub-permission-dialog';
import { useAuth } from '@/hooks/use-auth';

interface HubSettingsProps {
  activeHub: Hub;
  onUpdateHub: (updatedData: Partial<Hub>) => void;
  allUsers: User[];
}

export default function HubSettings({ activeHub, onUpdateHub, allUsers }: HubSettingsProps) {
  const { activeSpace } = useAuth();

  const [hubName, setHubName] = useState(activeHub.name);
  const [selectedComponents, setSelectedComponents] = useState<string[]>(activeHub.settings?.components || []);
  const [isPrivate, setIsPrivate] = useState(activeHub.isPrivate || false);
  const [memberIds, setMemberIds] = useState<string[]>(activeHub.memberIds || []);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);

  useEffect(() => {
    if (activeHub) {
      setHubName(activeHub.name);
      setSelectedComponents(activeHub.settings?.components || []);
      setIsPrivate(activeHub.isPrivate || false);
      setMemberIds(activeHub.memberIds || []);
    }
  }, [activeHub]);
  
  if (!activeSpace) return null;

  const handlePermissionsSave = (newMemberIds: string[], applyToAll: boolean) => {
    setIsPrivate(!applyToAll);
    setMemberIds(applyToAll ? [] : newMemberIds);
  };
  
  const handleSaveChanges = () => {
    const updatedData: Partial<Hub> = {
        name: hubName,
        isPrivate: isPrivate,
        memberIds: isPrivate ? memberIds : [],
        settings: {
            ...activeHub.settings,
            components: selectedComponents,
        }
    };
    onUpdateHub(updatedData);
  }

  const hasChanges = hubName !== activeHub.name 
    || JSON.stringify(selectedComponents.sort()) !== JSON.stringify((activeHub.settings.components || []).sort())
    || isPrivate !== activeHub.isPrivate
    || JSON.stringify(memberIds.sort()) !== JSON.stringify((activeHub.memberIds || []).sort());
  
  const permissionSummary = isPrivate
    ? `${memberIds.length} member(s) have access`
    : 'Public to everyone in the space';

  const spaceUsers = allUsers.filter(u => activeSpace.members[u.id]);

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold">Hub Settings</h1>
            <p className="text-sm text-muted-foreground">Manage the features and permissions for <span className="font-semibold">{activeHub.name}</span>.</p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>General Configuration</CardTitle>
                <CardDescription>Update the name and visible tools for this hub.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="hubName">Hub Name</Label>
                    <Input 
                        id="hubName"
                        value={hubName}
                        onChange={(e) => setHubName(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium">{isPrivate ? 'Private Hub' : 'Public Hub'}</p>
                            <p className="text-xs text-muted-foreground">{permissionSummary}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsPermissionDialogOpen(true)}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Access
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Active Tools</Label>
                    <HubComponentEditor 
                        selected={selectedComponents}
                        setSelected={setSelectedComponents}
                    />
                </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
                <Button onClick={handleSaveChanges} disabled={!hasChanges}>Save Changes</Button>
            </CardFooter>
        </Card>

        <HubPermissionDialog
            isOpen={isPermissionDialogOpen}
            onOpenChange={setIsPermissionDialogOpen}
            spaceUsers={spaceUsers}
            onSave={handlePermissionsSave}
            defaultPermissions={{ userIds: memberIds, applyToAll: !isPrivate }}
        />
    </div>
  );
}
