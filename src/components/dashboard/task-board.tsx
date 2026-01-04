

'use client';

import React, { useState } from 'react';
import { Project, Space, Task, User, Status, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, Folder } from 'lucide-react';
import ProjectBoard from './project-board';
import NewTaskDialog from './new-task-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TaskBoardProps {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  projects: Project[];
  selectedProjectId: string | null;
  activeHub: Hub;
  allUsers: User[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onTaskSelect: (task: Task) => void;
  onUpdateTask: (task: Task, tempId?: string) => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onNewProject: () => void;
}

export default function TaskBoard({ 
    tasks, 
    onUpdateTasks, 
    projects, 
    selectedProjectId,
    activeHub, 
    allUsers, 
    onUpdateActiveHub,
    onTaskSelect,
    onUpdateTask,
    onAddTask,
    onNewProject,
}: TaskBoardProps) {
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [defaultStatusForNewTask, setDefaultStatusForNewTask] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { activeSpace } = useAuth();
  
  const handleAddTaskDialog = (newTask: Omit<Task, 'id'>) => {
    onAddTask(newTask);
    const statuses = activeHub.statuses || [];
    if (!statuses.find(s => s.name === newTask.status)) {
        const randomColor = { name: 'Gray', color: '#6b7280' };
        onUpdateActiveHub({ statuses: [...statuses, { name: newTask.status, color: randomColor.color }] });
    }
  };

  const handleNewTaskRequest = (status?: string) => {
    setDefaultStatusForNewTask(status);
    setIsNewTaskDialogOpen(true);
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const spaceMembers = allUsers.filter(u => activeSpace?.members[u.id]);
  const statuses = activeHub.statuses || [];

  return (
    <>
      <div className="flex h-full flex-col p-8">
          {selectedProject ? (
              <ProjectBoard 
                  project={selectedProject}
                  projects={projects}
                  allTasks={tasks}
                  onUpdateTasks={onUpdateTasks}
                  activeHub={activeHub}
                  allUsers={allUsers}
                  onUpdateActiveHub={onUpdateActiveHub}
                  onNewTaskRequest={handleNewTaskRequest}
                  onTaskClick={(task) => onTaskSelect(task)}
                  onUpdateTask={onUpdateTask}
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
        {isNewTaskDialogOpen && (
          <NewTaskDialog
            isOpen={isNewTaskDialogOpen}
            onOpenChange={setIsNewTaskDialogOpen}
            onTaskAdd={handleAddTaskDialog}
            projects={selectedProject ? [selectedProject] : []}
            statuses={statuses}
            allUsers={spaceMembers}
            defaultStatus={defaultStatusForNewTask}
          />
        )}
      </div>
    </>
  );
}
