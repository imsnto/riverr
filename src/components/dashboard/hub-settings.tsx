
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Hub } from '@/lib/data';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import HubComponentEditor from './hub-component-editor';

interface HubSettingsProps {
  activeHub: Hub | null;
  onUpdateHub: (updatedData: Partial<Hub>) => void;
}

export default function HubSettings({ activeHub, onUpdateHub }: HubSettingsProps) {
  const [hubName, setHubName] = useState(activeHub?.name || '');
  const [selectedComponents, setSelectedComponents] = useState<string[]>(activeHub?.settings?.components || []);

  useEffect(() => {
    if (activeHub) {
      setHubName(activeHub.name);
      setSelectedComponents(activeHub.settings?.components || []);
    }
  }, [activeHub]);
  
  if (!activeHub) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>No Active Hub</CardTitle>
                <CardDescription>Select a hub from the sidebar to manage its settings.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  const handleSaveChanges = () => {
    const updatedData: Partial<Hub> = {
        name: hubName,
        settings: {
            ...activeHub.settings,
            components: selectedComponents
        }
    };
    onUpdateHub(updatedData);
  }

  const hasChanges = hubName !== activeHub.name || JSON.stringify(selectedComponents) !== JSON.stringify(activeHub.settings.components);

  return (
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
  );
}
