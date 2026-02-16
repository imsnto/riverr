

'use client';

import React, { useState, useEffect } from 'react';
import { Project, Space, Task, User, Status, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Folder } from 'lucide-react';
import ProjectBoard from './project-board';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '../ui/scroll-area';
import { ContentSkeleton } from './content-skeleton';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskBoardProps {
  allTasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  activeHub: Hub;
  allUsers: User[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (task: Task, tempId?: string) => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onNewProject: () => void;
  onNewTaskRequest: (status?: string) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export default function TaskBoard({ 
    allTasks, 
    onUpdateTasks, 
    projects, 
    selectedProjectId,
    onSelectProject,
    activeHub, 
    allUsers, 
    onUpdateActiveHub,
    onTaskClick,
    onUpdateTask,
    onAddTask,
    onNewProject,
    onNewTaskRequest,
    onEditProject,
    onDeleteProject,
}: TaskBoardProps) {
  const { activeSpace } = useAuth();
  const isMobile = useIsMobile();
  
  const handleSelectProject = (id: string | null) => {
      onSelectProject(id);
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  
  const getProjectLastUpdate = (projectId: string) => {
      const projectTasks = allTasks.filter(t => t.project_id === projectId);
      if (projectTasks.length === 0) return null;
      
      const lastUpdatedTask = projectTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!lastUpdatedTask) return null;

      return lastUpdatedTask.createdAt ? formatDistanceToNow(new Date(lastUpdatedTask.createdAt), { addSuffix: true }) : '';
  }
  
  if (isMobile) {
    if (!selectedProject) {
        return (
            <div className="flex h-full flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-semibold">Projects</h1>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {projects.map(project => {
                            const projectTasks = allTasks.filter(t => t.project_id === project.id);
                            const lastUpdate = getProjectLastUpdate(project.id);
                            return (
                                <Button
                                    key={project.id}
                                    variant="ghost"
                                    className="w-full h-auto justify-start p-2 text-left flex-col items-start hover:bg-white/5 text-zinc-300"
                                    onClick={() => handleSelectProject(project.id)}
                                >
                                    <div className="font-medium text-white">{project.name}</div>
                                    <div className="text-xs text-zinc-500">
                                        {projectTasks.length} tasks {lastUpdate && `• ${lastUpdate}`}
                                    </div>
                                </Button>
                            )
                        })}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t">
                    <Button variant="outline" className="w-full" onClick={onNewProject}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </div>
            </div>
        );
    } else {
        return (
             <>
                <div className="flex h-full flex-col overflow-hidden">
                    <ProjectBoard 
                        project={selectedProject}
                        projects={projects}
                        onSelectProject={handleSelectProject}
                        allTasks={allTasks}
                        onUpdateTasks={onUpdateTasks}
                        activeHub={activeHub}
                        allUsers={allUsers}
                        onUpdateActiveHub={onUpdateActiveHub}
                        onNewTaskRequest={onNewTaskRequest}
                        onTaskClick={onTaskClick}
                        onUpdateTask={onUpdateTask}
                        onBack={() => handleSelectProject(null)}
                        onEditProject={onEditProject}
                        onDeleteProject={onDeleteProject}
                    />
                </div>
            </>
        )
    }
  }

  // Desktop view
  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
          {selectedProject ? (
              <ProjectBoard 
                  project={selectedProject}
                  projects={projects}
                  onSelectProject={handleSelectProject}
                  allTasks={allTasks}
                  onUpdateTasks={onUpdateTasks}
                  activeHub={activeHub}
                  allUsers={allUsers}
                  onUpdateActiveHub={onUpdateActiveHub}
                  onNewTaskRequest={onNewTaskRequest}
                  onTaskClick={onTaskClick}
                  onUpdateTask={onUpdateTask}
                  onBack={() => handleSelectProject(null)}
                  onEditProject={onEditProject}
                  onDeleteProject={onDeleteProject}
              />
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center bg-card rounded-lg">
                  <Folder className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">No project selected</h3>
                  <p className="text-muted-foreground">Select a project from the sidebar or create a new one.</p>
                  <Button className="mt-4" onClick={onNewProject}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Project
                  </Button>
              </div>
          )}
      </div>
    </>
  );
}
