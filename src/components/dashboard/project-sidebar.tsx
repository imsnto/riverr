'use client';

import React from 'react';
import { Project, Task } from '@/lib/data';
import { Button } from '../ui/button';
import { Plus, Archive, LayoutTemplate, Settings } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ProjectSidebarProps {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

export default function ProjectSidebar({ projects, tasks, selectedProjectId, onSelectProject, onNewProject }: ProjectSidebarProps) {
  
  const getProjectLastUpdate = (projectId: string) => {
      const projectTasks = tasks.filter(t => t.project_id === projectId);
      if (projectTasks.length === 0) return null;
      
      const lastUpdatedTask = projectTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!lastUpdatedTask) return null;

      return formatDistanceToNow(new Date(lastUpdatedTask.createdAt), { addSuffix: true });
  }

  return (
    <div className="hidden md:flex flex-col h-full p-2 border-r bg-card w-64">
      <div className="p-2 mb-2">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-lg font-semibold">Projects</h2>
                <p className="text-xs text-muted-foreground">{projects.length} active</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onNewProject} className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
        </div>
      </div>
      
      <div className="px-2 mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Projects
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2">
          {projects.map(project => {
              const projectTasks = tasks.filter(t => t.project_id === project.id);
              const lastUpdate = getProjectLastUpdate(project.id);
              return (
                 <Button
                    key={project.id}
                    variant="ghost"
                    className={cn(
                        "w-full h-auto justify-start p-2 text-left flex-col items-start hover:bg-white/5",
                        selectedProjectId === project.id ? 'bg-white/10 border border-white/10' : 'text-zinc-300'
                    )}
                    onClick={() => onSelectProject(project.id)}
                 >
                    <div className={cn("font-medium", selectedProjectId === project.id ? 'text-white' : '')}>{project.name}</div>
                    <div className="text-xs text-zinc-500">
                        {projectTasks.length} tasks {lastUpdate && `• ${lastUpdate}`}
                    </div>
                </Button>
              )
          })}
        </div>
      </ScrollArea>
       <div className="mt-auto p-2">
          <Separator className="my-2" />
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white">
             <Archive className="h-4 w-4 mr-2" /> Archive
          </Button>
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white">
             <LayoutTemplate className="h-4 w-4 mr-2" /> Templates
          </Button>
           <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white">
             <Settings className="h-4 w-4 mr-2" /> Settings
          </Button>
      </div>
    </div>
  );
}
