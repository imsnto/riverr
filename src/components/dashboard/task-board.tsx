
'use client';

import React, { useState, DragEvent } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { tasks as initialTasks, users, projects, Task, Project } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import NewTaskDialog from './new-task-dialog';
import TaskDetailsDialog from './task-details-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

const TaskCard = ({ task, onUpdateTask, onClick, isDragging }: { task: Task, onUpdateTask: (task: Task) => void, onClick: () => void, isDragging: boolean }) => {
  const assignee = users.find(u => u.id === task.assigned_to);
  const project = projects.find(p => p.id === task.project_id);

  const handleAssigneeChange = (userId: string) => {
    onUpdateTask({ ...task, assigned_to: userId });
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        "mb-4 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <CardHeader className="p-4 cursor-grab">
        <div className="flex justify-between items-start">
            <Badge variant="outline" className="mb-2 font-normal">{project?.name || 'No Project'}</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        </div>
        <CardTitle className="text-base font-medium">{task.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4 pt-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                {assignee && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                    <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
                  </Avatar>
                )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="start">
            {users.map(user => (
              <DropdownMenuItem key={user.id} onSelect={() => handleAssigneeChange(user.id)}>
                {user.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</span>
      </CardFooter>
    </Card>
  );
};

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const columns: Task['status'][] = ['Backlog', 'In Progress', 'Review', 'Done'];

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleAddTask = (newTask: Task) => {
    setTasks(prevTasks => [...prevTasks, newTask]);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(tasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    // Also update the selected task if it's the one being edited
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Task Board</h1>
        <Button onClick={() => setIsNewTaskDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map(status => (
          <div
            key={status}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <h2 className="text-lg font-semibold mb-4 px-1">{status}</h2>
            <div className="bg-primary/5 rounded-lg p-2 min-h-[500px]">
              {tasks
                .filter(task => task.status === status)
                .map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <TaskCard 
                      task={task} 
                      onClick={() => setSelectedTask(task)} 
                      onUpdateTask={handleUpdateTask}
                      isDragging={draggedTask === task.id} 
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <NewTaskDialog 
        isOpen={isNewTaskDialogOpen}
        onOpenChange={setIsNewTaskDialogOpen}
        onTaskAdd={handleAddTask}
      />
      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          isOpen={!!selectedTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTask(null);
          }}
          onUpdateTask={handleUpdateTask}
        />
      )}
    </>
  );
}
