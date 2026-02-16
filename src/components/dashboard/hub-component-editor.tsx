
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Check, GripVertical, Plus, Info, Briefcase, Star, Headset, Workflow, BookOpen, AtSign, MessageCircle, FolderKanban, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

const ALL_COMPONENTS: Record<string, { name: string; description: string; icon: React.ReactNode; foundational?: boolean }> = {
    'tasks': { name: 'Task Board', description: 'Kanban board for tasks.', icon: <FolderKanban /> },
    'help-center': { name: 'Knowledge', description: 'Centralized documentation for internal and public use.', icon: <BookOpen />, foundational: true },
    'deals': { name: 'Deals', description: 'Manage your sales pipeline and opportunities.', icon: <DollarSign /> },
    'contacts': { name: 'Contacts', description: 'View and manage all customer and lead profiles.', icon: <AtSign /> },
    'inbox': { name: 'Inbox', description: 'Live chat and messaging with visitors and customers.', icon: <MessageCircle /> },
    'tickets': { name: 'Tickets', description: 'Track and manage customer issues from open to resolved.', icon: <Headset /> },
    'flows': { name: 'Workflows', description: 'Automate processes, assignments, and job flows.', icon: <Workflow /> },
};


const CATEGORIES = [
    { name: 'Core Work', icon: <Briefcase />, components: ['tasks', 'help-center'] },
    { name: 'Sales', icon: <Star />, components: ['deals', 'contacts', 'inbox'] },
    { name: 'Support', icon: <Headset />, components: ['tickets', 'help-center', 'inbox'] },
    { name: 'Automation', icon: <Workflow />, components: ['flows'] },
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
  
  const selectedComponentsData = selected.map(id => ({ id, ...ALL_COMPONENTS[id] })).filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
        <p className="text-sm font-medium text-muted-foreground">Active Tools</p>
        {selectedComponentsData.map(comp => (
          <div key={comp.id} className="flex items-center gap-2 p-2 bg-card rounded-md border shadow-sm">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <p className="flex-1 font-medium">{comp.name}</p>
            <Button variant="ghost" size="sm" onClick={() => handleToggle(comp.id)}>Remove</Button>
          </div>
        ))}
        {selectedComponentsData.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">No tools selected. Add some below.</p>
        )}
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Tools to this Hub
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Tools to your Hub</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-6">
            <div className="py-4 space-y-4">
              <TooltipProvider>
                  {CATEGORIES.map(category => (
                      <div key={category.name}>
                          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                            {React.cloneElement(category.icon, { className: "h-4 w-4" })}
                            {category.name}
                          </h3>
                          <div className="space-y-2">
                              {category.components.map(id => {
                                  const comp = ALL_COMPONENTS[id];
                                  if (!comp) return null;
                                  const isSelected = selected.includes(id);
                                  return (
                                      <button
                                          key={id}
                                          onClick={() => handleToggle(id)}
                                          className={cn(
                                              "w-full text-left p-3 rounded-lg border-2 flex justify-between items-start transition-colors",
                                              isSelected ? "border-primary bg-primary/10" : "hover:bg-accent/50 border-transparent"
                                          )}
                                      >
                                          <div className="flex gap-3">
                                              <div className={cn(
                                                  "h-5 w-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center",
                                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                              )}>
                                                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                              </div>
                                              <div>
                                                  <div className="font-semibold flex items-center gap-2">
                                                      {comp.name}
                                                      {comp.foundational && (
                                                          <Badge variant="outline" className="border-purple-500/50 text-purple-400">Foundational</Badge>
                                                      )}
                                                  </div>
                                                  <p className="text-sm text-muted-foreground">{comp.description}</p>

                                                  {comp.foundational && isSelected && (
                                                      <div className="mt-3 text-xs text-muted-foreground space-y-1 bg-card p-3 rounded-md border">
                                                          <p className="font-semibold text-foreground">This Hub will support:</p>
                                                          <ul className="list-disc list-inside">
                                                              <li>Internal Docs & SOPs</li>
                                                              <li>Public Help Center</li>
                                                              <li>Agent knowledge base</li>
                                                          </ul>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  ))}
              </TooltipProvider>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
