
'use client';

import React from 'react';
import { Project } from '@/lib/data';
import { Button } from '../ui/button';
import { Plus, Folder } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

export default function ProjectSidebar({ projects, selectedProjectId, onSelectProject, onNewProject }: ProjectSidebarProps) {
  return (
    <div className="hidden md:flex flex-col h-full p-2 border-r bg-card w-56">
      <div className="flex justify-between items-center p-2 mb-2">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Button variant="ghost" size="icon" onClick={onNewProject} className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2">
          {projects.map(project => (
            <div
              key={project.id}
              className={cn(
                  "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                  selectedProjectId === project.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/50'
              )}
              onClick={() => onSelectProject(project.id)}
            >
                <div className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{project.name}</span>
                </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
