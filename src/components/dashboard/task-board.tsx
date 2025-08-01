
'use client';

import React, { useState, DragEvent } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { users, Task, Project } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import NewTaskDialog from './new-task-dialog';
import TaskDetailsDialog from './task-details-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

const TaskCard = ({ task, project, onUpdateTask, onClick, isDragging }: { task: Task, project?: Project, onUpdateTask: (task: Task) => void, onClick: () => void, isDragging: boolean }) => {
  const assignee = users.find(u => u.id === task.assigned_to);

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

interface TaskBoardProps {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  projects: Project[];
}

export default function TaskBoard({ tasks, onUpdateTasks, projects }: TaskBoardProps) {
  const [columns, setColumns] = useState<string[]>(['Backlog', 'In Progress', 'Review', 'Done']);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const { toast } = useToast();

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string, targetTaskId?: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const draggedTask = tasks.find(t => t.id === taskId);

    if (!draggedTask) return;

    let newTasks = tasks.filter(t => t.id !== taskId);
    
    const updatedTask = { ...draggedTask, status: newStatus };

    if (targetTaskId) {
        const targetIndex = newTasks.findIndex(t => t.id === targetTaskId);
        if (targetIndex !== -1) {
            newTasks.splice(targetIndex, 0, updatedTask);
        } else {
            newTasks.push(updatedTask);
        }
    } else {
        newTasks.push(updatedTask);
    }
    
    onUpdateTasks(newTasks);
    setDraggedTask(null);
  };


  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleAddTask = (newTask: Task) => {
    onUpdateTasks([...tasks, newTask]);
    if (!columns.includes(newTask.status)) {
        setColumns([...columns, newTask.status]);
    }
  };

  const handleUpdateTask = (updatedTask: Task) => {
    onUpdateTasks(tasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  }

  const handleAddNewColumn = () => {
    const newStatusName = `New Status ${columns.length + 1}`;
    setColumns([...columns, newStatusName]);
  }

  const handleRenameColumn = (oldName: string) => {
    if (!newColumnName || newColumnName === oldName) {
        setEditingColumn(null);
        return;
    }
    if (columns.includes(newColumnName)) {
        toast({ variant: 'destructive', title: 'Status name already exists.'});
        return;
    }
    onUpdateTasks(tasks.map(t => t.status === oldName ? { ...t, status: newColumnName } : t));
    setColumns(columns.map(c => c === oldName ? newColumnName : c));
    setEditingColumn(null);
    setNewColumnName("");
  }

  const handleDeleteColumn = (columnToDelete: string) => {
    if (columns.length <= 1) {
        toast({ variant: 'destructive', title: 'Cannot delete the last column.'});
        return;
    }
    const defaultColumn = columns.find(c => c !== columnToDelete)!;
    onUpdateTasks(tasks.map(t => t.status === columnToDelete ? { ...t, status: defaultColumn } : t));
    setColumns(columns.filter(c => c !== columnToDelete));
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
            <div className="flex justify-between items-center mb-4 px-1">
                 {editingColumn === status ? (
                    <Input 
                        defaultValue={status}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onBlur={() => handleRenameColumn(status)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameColumn(status)}}
                        autoFocus
                        className="h-8"
                    />
                ) : (
                    <h2 className="text-lg font-semibold">{status}</h2>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setEditingColumn(status); setNewColumnName(status); }}>
                            <Edit className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="mr-2 h-4 w-4 text-destructive" /> <span className="text-destructive">Delete</span>
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete the "{status}" column. All tasks in this column will be moved to the first column. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteColumn(status)}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="bg-primary/5 rounded-lg p-2 min-h-[500px]">
              {tasks
                .filter(task => task.status === status)
                .map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(e, status, task.id);
                    }}
                  >
                    <TaskCard 
                      task={task} 
                      project={projects.find(p => p.id === task.project_id)}
                      onClick={() => setSelectedTask(task)} 
                      onUpdateTask={handleUpdateTask}
                      isDragging={draggedTask === task.id} 
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
         <div className="flex-shrink-0 w-80">
            <Button variant="outline" className="w-full" onClick={handleAddNewColumn}>
                <Plus className="mr-2 h-4 w-4" /> Add Status
            </Button>
        </div>
      </div>
      <NewTaskDialog 
        isOpen={isNewTaskDialogOpen}
        onOpenChange={setIsNewTaskDialogOpen}
        onTaskAdd={handleAddTask}
        projects={projects}
        statuses={columns}
      />
      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          isOpen={!!selectedTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTask(null);
          }}
          onUpdateTask={handleUpdateTask}
          statuses={columns}
        />
      )}
    </>
  );
}
