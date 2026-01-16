
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Check, GripVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

const ALL_COMPONENTS = [
  { id: 'tasks', name: 'Task Board', description: 'Kanban board for tasks.' },
  { id: 'inbox', name: 'Inbox', description: 'Live chat with website visitors & customers.' },
  { id: 'documents', name: 'Documents', description: 'Collaborative docs.' },
  { id: 'messages', name: 'Messages', description: 'Team chat and channels.' },
  { id: 'flows', name: 'Workflows', description: 'Automated job flows.' },
];

interface HubComponentEditorProps {
  selected: string[];
  setSelected: (selected: string[]) => void;
}

export default function HubComponentEditor({ selected, setSelected }: HubComponentEditorProps) {
  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const availableComponents = ALL_COMPONENTS.filter(c => !selected.includes(c.id));
  const selectedComponents = selected.map(id => ALL_COMPONENTS.find(c => c.id === id)).filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
        <p className="text-sm font-medium text-muted-foreground">Active Features</p>
        {selectedComponents.map(comp => (
          <div key={comp!.id} className="flex items-center gap-2 p-2 bg-card rounded-md border shadow-sm">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <p className="flex-1 font-medium">{comp!.name}</p>
            <Button variant="ghost" size="sm" onClick={() => handleToggle(comp!.id)}>Remove</Button>
          </div>
        ))}
        {selectedComponents.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">No features selected. Add some below.</p>
        )}
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add a Feature
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Features to your Hub</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {availableComponents.map(comp => (
                <DialogTrigger asChild key={comp.id}>
                    <button
                        onClick={() => handleToggle(comp.id)}
                        className="w-full text-left p-3 rounded-lg hover:bg-accent flex justify-between items-center"
                    >
                        <div>
                            <p className="font-semibold">{comp.name}</p>
                            <p className="text-sm text-muted-foreground">{comp.description}</p>
                        </div>
                    </button>
              </DialogTrigger>
            ))}
             {availableComponents.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">All available features have been added.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
