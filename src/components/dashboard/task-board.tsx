
'use client';

import React, { useState, DragEvent } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { users, Task, Project } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2, Palette } from 'lucide-react';
import { Button, buttonVariants } from '../ui/button';
import { cn } from '@/lib/utils';
import NewTaskDialog from './new-task-dialog';
import TaskDetailsDialog from './task-details-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from '../ui/dropdown-menu';
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

export interface Status {
    name: string;
    color: string;
}

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

const STATUS_COLORS = [
    { name: 'Gray', color: 'hsl(var(--muted-foreground))' },
    { name: 'Blue', color: 'hsl(var(--primary))' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Red', color: 'hsl(var(--destructive))' },
    { name: 'Purple', color: '#8b5cf6' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Teal', color: '#14b8a6' },
];


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
  statuses: Status[];
  onUpdateStatuses: (statuses: Status[]) => void;
}

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: 'hsl(var(--muted-foreground))' },
    { name: 'In Progress', color: 'hsl(var(--primary))' },
    { name: 'Review', color: 'hsl(var(--accent))' },
    { name: 'Done', color: 'hsl(var(--destructive))' },
]

export default function TaskBoard({ tasks, onUpdateTasks, projects, statuses, onUpdateStatuses }: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    if (statuses.length === 0) {
        onUpdateStatuses(defaultStatuses);
    }
  }, [statuses, onUpdateStatuses])

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
    const draggedTaskItem = tasks.find(t => t.id === taskId);

    if (!draggedTaskItem) return;

    let newTasks = tasks.filter(t => t.id !== taskId);
    
    const updatedTask = { ...draggedTaskItem, status: newStatus };

    if (targetTaskId) {
        const targetIndex = newTasks.findIndex(t => t.id === targetTaskId);
        if (targetIndex !== -1) {
            newTasks.splice(targetIndex, 0, updatedTask);
        } else {
            // Fallback if target task not found after filter
             const statusTasks = newTasks.filter(t => t.status === newStatus);
             const lastTaskOfStatus = statusTasks[statusTasks.length -1];
             if(lastTaskOfStatus) {
                newTasks.splice(newTasks.findIndex(t => t.id === lastTaskOfStatus.id) + 1, 0, updatedTask);
             } else {
                newTasks.push(updatedTask)
             }
        }
    } else {
        const statusTasks = newTasks.filter(t => t.status === newStatus);
        const lastTaskOfStatus = statusTasks[statusTasks.length -1];
        if(lastTaskOfStatus) {
           newTasks.splice(newTasks.findIndex(t => t.id === lastTaskOfStatus.id) + 1, 0, updatedTask);
        } else {
           newTasks.push(updatedTask)
        }
    }
    
    onUpdateTasks(newTasks);
    setDraggedTask(null);
  };


  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleAddTask = (newTask: Task) => {
    onUpdateTasks([...tasks, newTask]);
    if (!statuses.find(s => s.name === newTask.status)) {
        const randomColor = STATUS_COLORS[statuses.length % STATUS_COLORS.length];
        onUpdateStatuses([...statuses, { name: newTask.status, color: randomColor.color }]);
    }
  };

  const handleUpdateTask = (updatedTask: Task) => {
    onUpdateTasks(tasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  }

  const handleAddNewColumn = () => {
    const newStatusName = `New Status ${statuses.length + 1}`;
    const randomColor = STATUS_COLORS[statuses.length % STATUS_COLORS.length];
    onUpdateStatuses([...statuses, { name: newStatusName, color: randomColor.color }]);
  }

  const handleRenameColumn = (oldName: string) => {
    if (!newColumnName || newColumnName === oldName) {
        setEditingColumn(null);
        return;
    }
    if (statuses.find(s => s.name === newColumnName)) {
        toast({ variant: 'destructive', title: 'Status name already exists.'});
        return;
    }
    onUpdateTasks(tasks.map(t => t.status === oldName ? { ...t, status: newColumnName } : t));
    onUpdateStatuses(statuses.map(s => s.name === oldName ? { ...s, name: newColumnName } : s));
    setEditingColumn(null);
    setNewColumnName("");
  }

  const handleDeleteColumn = (columnToDelete: string) => {
    if (statuses.length <= 1) {
        toast({ variant: 'destructive', title: 'Cannot delete the last column.'});
        return;
    }
    const defaultColumn = statuses.find(s => s.name !== columnToDelete)!;
    onUpdateTasks(tasks.map(t => t.status === columnToDelete ? { ...t, status: defaultColumn.name } : t));
    onUpdateStatuses(statuses.filter(s => s.name !== columnToDelete));
  }

  const handleChangeColor = (statusName: string, color: string) => {
    onUpdateStatuses(statuses.map(s => s.name === statusName ? { ...s, color: color } : s));
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
        {statuses.map(status => (
          <div
            key={status.name}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => { 
                if (tasks.filter(t => t.status === status.name).length === 0) {
                    handleDrop(e, status.name);
                }
            }}
          >
            <div className="flex justify-between items-center mb-4 px-1">
                 {editingColumn === status.name ? (
                    <Input 
                        defaultValue={status.name}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onBlur={() => handleRenameColumn(status.name)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameColumn(status.name)}}
                        autoFocus
                        className="h-8"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.color }}
                        />
                        <h2 className="text-lg font-semibold">{status.name}</h2>
                    </div>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setEditingColumn(status.name); setNewColumnName(status.name); }}>
                            <Edit className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Palette className="mr-2 h-4 w-4" />
                                <span>Change Color</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <div className="grid grid-cols-5 gap-2 p-2 w-48">
                                    {STATUS_COLORS.map(color => (
                                        <button
                                            key={color.name}
                                            onClick={() => handleChangeColor(status.name, color.color)}
                                            className="w-6 h-6 rounded-full border"
                                            style={{ backgroundColor: color.color }}
                                            aria-label={color.name}
                                        />
                                    ))}
                                    </div>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> <span>Delete</span>
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete the "{status.name}" column. All tasks in this column will be moved to the first column. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteColumn(status.name)} className={cn(buttonVariants({ variant: "destructive" }))}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="bg-primary/5 rounded-lg p-2 min-h-[500px]">
              {tasks
                .filter(task => task.status === status.name)
                .map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => {
                        e.stopPropagation();
                        handleDrop(e, status.name, task.id);
                    }}
                     onDragOver={(e) => {
                        e.preventDefault();
                        // This allows dropping ON the item
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
        statuses={statuses.map(s => s.name)}
      />
      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          isOpen={!!selectedTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTask(null);
          }}
          onUpdateTask={handleUpdateTask}
          statuses={statuses.map(s => s.name)}
        />
      )}
    </>
  );
}
