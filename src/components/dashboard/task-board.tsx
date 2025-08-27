

'use client';

import React, { useState } from 'react';
import { Project, Space, Task, User, Status, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Folder, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProjectBoard from './project-board';
import ProjectFormDialog from './project-form-dialog';
import { useToast } from '@/hooks/use-toast';
import NewTaskDialog from './new-task-dialog';
import TaskDetailsDialog from './task-details-dialog';
import { useAuth } from '@/hooks/use-auth';

interface TaskBoardProps {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  projects: Project[];
  activeHub: Hub;
  allUsers: User[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onAddProject: (project: Omit<Project, 'id'>) => Promise<void>;
  onUpdateProject: (projectId: string, project: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onTaskSelect: (task: Task) => void;
  onUpdateTask: (task: Task, tempId?: string) => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
}

export default function TaskBoard({ 
    tasks, 
    onUpdateTasks, 
    projects, 
    activeHub, 
    allUsers, 
    onUpdateActiveHub,
    onAddProject,
    onUpdateProject,
    onDeleteProject,
    onTaskSelect,
    onUpdateTask,
    onAddTask,
}: TaskBoardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects.length > 0 ? projects[0].id : null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const { activeSpace } = useAuth(); // Need this for project form dialog

  const handleCreateNewProject = () => {
    setEditingProject(null);
    setIsProjectFormOpen(true);
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  }

  const handleSaveProject = async (values: Omit<Project, 'id' | 'hubId'>, projectId?: string) => {
    if (!activeHub) {
        toast({ variant: 'destructive', title: 'No active hub selected' });
        return;
    }
    try {
        const projectData = { ...values, hubId: activeHub.id };
        if (projectId) {
            await onUpdateProject(projectId, projectData);
            toast({ title: 'Project Updated' });
        } else {
            await onAddProject(projectData);
            toast({ title: 'Project Created' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the project.'})
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await onDeleteProject(projectId);
      toast({ title: 'Project Deleted' });
      if (selectedProjectId === projectId) {
        setSelectedProjectId(projects.length > 1 ? projects.find(p => p.id !== projectId)!.id : null);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the project.'})
    }
  }

  const handleAddTaskDialog = (newTask: Omit<Task, 'id'>) => {
    onAddTask(newTask);
    const statuses = activeHub.statuses || [];
    if (!statuses.find(s => s.name === newTask.status)) {
        const randomColor = { name: 'Gray', color: '#6b7280' };
        onUpdateActiveHub({ statuses: [...statuses, { name: newTask.status, color: randomColor.color }] });
    }
  };


  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const spaceMembers = allUsers.filter(u => activeSpace?.members[u.id]);
  const statuses = activeHub.statuses || [];

  return (
    <>
      <div className="flex h-full gap-6">
        <aside className="w-56 flex-shrink-0 border-r pr-6">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Projects</h2>
              <Button size="sm" onClick={handleCreateNewProject}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
              </Button>
          </div>
          <div className="space-y-2">
              {projects.map(project => (
                  <div 
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${selectedProjectId === project.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/50'}`}
                  >
                      <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4" />
                          <span>{project.name}</span>
                      </div>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleEditProject(project)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteProject(project.id)} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
              ))}
          </div>
        </aside>
        <main className="flex-1 overflow-hidden">
          {selectedProject ? (
              <ProjectBoard 
                  project={selectedProject}
                  projects={projects}
                  allTasks={tasks}
                  onUpdateTasks={onUpdateTasks}
                  activeHub={activeHub}
                  allUsers={allUsers}
                  onUpdateActiveHub={onUpdateActiveHub}
                  onNewTaskRequest={() => setIsNewTaskDialogOpen(true)}
                  onTaskClick={(task) => onTaskSelect(task)}
                  onUpdateTask={onUpdateTask}
              />
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center bg-card rounded-lg">
                  <Folder className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">No project selected</h3>
                  <p className="text-muted-foreground">Select a project from the list or create a new one.</p>
                  <Button className="mt-4" onClick={handleCreateNewProject}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Project
                  </Button>
              </div>
          )}
        </main>
        <ProjectFormDialog 
          isOpen={isProjectFormOpen}
          onOpenChange={setIsProjectFormOpen}
          onSave={handleSaveProject}
          project={editingProject}
          spaceId={activeSpace?.id || ''}
          spaceMembers={spaceMembers}
        />
        {isNewTaskDialogOpen && (
          <NewTaskDialog
            isOpen={isNewTaskDialogOpen}
            onOpenChange={setIsNewTaskDialogOpen}
            onTaskAdd={handleAddTaskDialog}
            projects={selectedProject ? [selectedProject] : []}
            statuses={statuses}
            allUsers={spaceMembers}
          />
        )}
      </div>
    </>
  );
}
