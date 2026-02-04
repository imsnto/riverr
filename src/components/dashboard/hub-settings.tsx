

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Hub, User, EscalationIntakeRule, Project } from '@/lib/data';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import HubComponentEditor from './hub-component-editor';
import { Users } from 'lucide-react';
import HubPermissionDialog from './hub-permission-dialog';
import { useAuth } from '@/hooks/use-auth';
import EscalationIntakeSettings from './escalation-intake-settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface HubSettingsProps {
  activeHub: Hub | null;
  onUpdateHub: (updatedData: Partial<Hub>) => void;
  allUsers: User[];
  allHubs: Hub[];
  projects: Project[];
  escalationRules: EscalationIntakeRule[];
}

export default function HubSettings({ activeHub, onUpdateHub, allUsers, allHubs, projects, escalationRules }: HubSettingsProps) {
  const { activeSpace } = useAuth();

  const [hubName, setHubName] = useState(activeHub?.name || '');
  const [selectedComponents, setSelectedComponents] = useState<string[]>(activeHub?.settings?.components || []);
  const [isPrivate, setIsPrivate] = useState(activeHub?.isPrivate || false);
  const [memberIds, setMemberIds] = useState(activeHub?.memberIds || []);
  const [intraHubEscalationProjectId, setIntraHubEscalationProjectId] = useState<string | null>(activeHub?.settings?.intraHubEscalationProjectId || null);


  useEffect(() => {
    if (activeHub) {
      setHubName(activeHub.name);
      setSelectedComponents(activeHub.settings?.components || []);
      setIsPrivate(activeHub.isPrivate || false);
      setMemberIds(activeHub.memberIds || []);
      setIntraHubEscalationProjectId(activeHub.settings?.intraHubEscalationProjectId || null);
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
            components: selectedComponents,
            intraHubEscalationProjectId: intraHubEscalationProjectId,
        }
    };
    onUpdateHub(updatedData);
  }

  const hasChanges = hubName !== activeHub.name 
    || JSON.stringify(selectedComponents.sort()) !== JSON.stringify((activeHub.settings.components || []).sort())
    || isPrivate !== activeHub.isPrivate
    || JSON.stringify(memberIds.sort()) !== JSON.stringify((activeHub.memberIds || []).sort())
    || intraHubEscalationProjectId !== (activeHub.settings?.intraHubEscalationProjectId || null);
  
  const permissionSummary = isPrivate
    ? `${memberIds.length} member(s) have access`
    : 'Public to everyone in the space';

  const spaceUsers = allUsers.filter(u => activeSpace.members[u.id]);

  const hasTickets = selectedComponents.includes('tickets');
  const hasTasks = selectedComponents.includes('tasks');


  return (
    <div className="space-y-6">
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
        {hasTickets && hasTasks && (
            <div className="space-y-2">
                <Label htmlFor="intraHubEscalation">Intra-Hub Escalation Project</Label>
                <Select value={intraHubEscalationProjectId ?? 'none'} onValueChange={(value) => setIntraHubEscalationProjectId(value === 'none' ? null : value)}>
                    <SelectTrigger id="intraHubEscalation">
                        <SelectValue placeholder="Select a project for local escalations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.filter(p => p.hubId === activeHub.id).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    When a ticket is escalated, a linked task will be created in this project.
                </p>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveChanges} disabled={!hasChanges}>Save Changes</Button>
      </CardFooter>
    </Card>

    <EscalationIntakeSettings
      activeHub={activeHub}
      allUsers={allUsers}
      allHubs={allHubs}
      projects={projects}
      rules={escalationRules}
    />

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
