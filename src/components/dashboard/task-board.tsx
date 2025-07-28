
'use client';

import React, { useState, DragEvent } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { tasks as initialTasks, users, projects, Task } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

const TaskCard = ({ task, isDragging }: { task: Task, isDragging: boolean }) => {
  const assignee = users.find(u => u.id === task.assigned_to);
  const project = projects.find(p => p.id === task.project_id);

  return (
    <Card
      className={cn(
        "mb-4 bg-card hover:shadow-md transition-shadow duration-200",
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
        {assignee && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
            <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
          </Avatar>
        )}
        <span className="text-xs text-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</span>
      </CardFooter>
    </Card>
  );
};

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

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
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Task Board</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map(status => (
          <div
            key={status}
            className="flex flex-col"
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
                    <TaskCard task={task} isDragging={draggedTask === task.id} />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
