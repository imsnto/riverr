
'use client';

import React, { useState } from 'react';
import { Project, Space, Task, User, Status } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Folder, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProjectBoard from '@/components/dashboard/project-board';
import ProjectFormDialog from './project-form-dialog';
import { useToast } from '@/hooks/use-toast';

interface TaskBoardProps {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  projects: Project[];
  activeSpace: Space;
  allUsers: User[];
  onUpdateActiveSpace: (updatedSpace: Partial<Space>) => void;
  onAddProject: (project: Omit<Project, 'id'>) => Promise<void>;
  onUpdateProject: (projectId: string, project: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export default function TaskBoard({ 
    tasks, 
    onUpdateTasks, 
    projects, 
    activeSpace, 
    allUsers, 
    onUpdateActiveSpace,
    onAddProject,
    onUpdateProject,
    onDeleteProject
}: TaskBoardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects.length > 0 ? projects[0].id : null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { toast } = useToast();

  const handleCreateNewProject = () => {
    setEditingProject(null);
    setIsProjectFormOpen(true);
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  }

  const handleSaveProject = async (values: Omit<Project, 'id'>, projectId?: string) => {
    try {
        if (projectId) {
            await onUpdateProject(projectId, values);
            toast({ title: 'Project Updated' });
        } else {
            await onAddProject(values);
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

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const spaceMembers = allUsers.filter(u => activeSpace.members[u.id]);

  return (
    <div className="flex h-full gap-6">
      <aside className="w-64 flex-shrink-0 border-r pr-6">
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
                tasks={tasks.filter(t => t.project_id === selectedProject.id)}
                onUpdateTasks={onUpdateTasks}
                activeSpace={activeSpace}
                allUsers={allUsers}
                onUpdateActiveSpace={onUpdateActiveSpace}
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
        spaceId={activeSpace.id}
        spaceMembers={spaceMembers}
      />
    </div>
  );
}
