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
  activeHub: Hub | null;
  onUpdateHub: (updatedData: Partial<Hub>) => void;
  allUsers: User[];
}

export default function HubSettings({ activeHub, onUpdateHub, allUsers }: HubSettingsProps) {
  const { activeSpace } = useAuth();

  const [hubName, setHubName] = useState(activeHub?.name || '');
  const [selectedComponents, setSelectedComponents] = useState<string[]>(activeHub?.settings?.components || []);
  const [isPrivate, setIsPrivate] = useState(activeHub?.isPrivate || false);
  const [memberIds, setMemberIds] = useState(activeHub?.memberIds || []);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);

  useEffect(() => {
    if (activeHub) {
      setHubName(activeHub.name);
      setSelectedComponents(activeHub.settings?.components || []);
      setIsPrivate(activeHub.isPrivate || false);
      setMemberIds(activeHub.memberIds || []);
    }
  }, [activeHub]);
  
  if (!activeHub || !activeSpace) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>No Active Hub</CardTitle>
                <CardDescription>Select a hub from the sidebar to manage its settings.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

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
            components: selectedComponents
        }
    };
    onUpdateHub(updatedData);
  }

  const hasChanges = hubName !== activeHub.name 
    || JSON.stringify(selectedComponents) !== JSON.stringify(activeHub.settings.components)
    || isPrivate !== activeHub.isPrivate
    || JSON.stringify(memberIds.sort()) !== JSON.stringify((activeHub.memberIds || []).sort());
  
  const permissionSummary = isPrivate
    ? `${memberIds.length} member(s) have access`
    : 'Public to everyone in the space';

  const spaceUsers = allUsers.filter(u => activeSpace.members[u.id]);


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Hub Settings</CardTitle>
        <CardDescription>
          Manage settings for the <span className="font-semibold text-primary">{activeHub.name}</span> hub.
        </CardDescription>
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
             <Button variant="outline" onClick={() => setIsPermissionDialogOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                Manage Access
             </Button>
          </div>
        </div>
        <div className="space-y-2">
            <Label>Features</Label>
            <HubComponentEditor 
                selected={selectedComponents}
                setSelected={setSelectedComponents}
            />
        </div>
      </CardContent>
      <CardFooter>
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
    </>
  );
}
