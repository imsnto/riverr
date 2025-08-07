

'use client';

import React, { useState, DragEvent } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Task, Project, Space, Status } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2, Palette, Calendar, MessageSquare, Archive, CheckCircle } from 'lucide-react';
import { Button, buttonVariants } from '../ui/button';
import { cn } from '@/lib/utils';
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

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
}

const STATUS_COLORS = [
    // Grays
    { name: 'Gray', color: '#6b7280' },
    { name: 'Stone', color: '#78716c' },
    { name: 'Zinc', color: '#71717a' },
    
    // Reds
    { name: 'Red', color: '#ef4444' },
    { name: 'Rose', color: '#f43f5e' },

    // Oranges
    { name: 'Orange', color: '#f97316' },
    { name: 'Amber', color: '#f59e0b' },
    
    // Yellows
    { name: 'Yellow', color: '#eab308' },
    { name: 'Lime', color: '#84cc16' },

    // Greens
    { name: 'Green', color: '#22c55e' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Teal', color: '#14b8a6' },

    // Blues
    { name: 'Cyan', color: '#06b6d4' },
    { name: 'Sky', color: '#0ea5e9' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Indigo', color: '#6366f1' },

    // Purples
    { name: 'Violet', color: '#8b5cf6' },
    { name: 'Purple', color: '#a855f7' },
    { name: 'Fuchsia', color: '#d946ef' },

    // Pinks
    { name: 'Pink', color: '#ec4899' },
];


const TaskCard = ({ task, project, onClick, isDragging, allUsers }: { task: Task, project?: Project, onClick: () => void, isDragging: boolean, allUsers: User[] }) => {
  const assignee = allUsers.find(u => u.id === task.assigned_to);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <CardHeader className="p-3 cursor-grab">
        <CardTitle className="text-sm font-medium">{task.name}</CardTitle>
      </CardHeader>
      <CardFooter className="flex justify-between items-center p-3 pt-0">
         <div className="flex items-center gap-2 text-muted-foreground">
            {task.comments?.length > 0 && 
                <div className="flex items-center gap-1 text-xs">
                    <MessageSquare className="h-3 w-3" />
                    {task.comments.length}
                </div>
            }
         </div>
        <Avatar className="h-6 w-6">
            <AvatarImage src={assignee?.avatarUrl} alt={assignee?.name} />
            <AvatarFallback>{assignee ? getInitials(assignee.name) : 'U'}</AvatarFallback>
        </Avatar>
      </CardFooter>
    </Card>
  );
};

interface ProjectBoardProps {
  project: Project;
  projects: Project[];
  allTasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  activeSpace: Space;
  allUsers: User[];
  onUpdateActiveSpace: (updatedSpace: Partial<Space>) => void;
  onNewTaskRequest: () => void;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
}

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: '#6b7280' },
    { name: 'In Progress', color: '#3b82f6' },
    { name: 'Review', color: '#f59e0b' },
    { name: 'Done', color: '#22c55e' },
]

export default function ProjectBoard({ project, projects, allTasks, onUpdateTasks, activeSpace, allUsers, onUpdateActiveSpace, onNewTaskRequest, onTaskClick, onUpdateTask }: ProjectBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const { toast } = useToast();
  
  const tasks = allTasks.filter(t => t.project_id === project.id && !t.parentId);
  const statuses = activeSpace.statuses || defaultStatuses;
  const setStatuses = (newStatuses: Status[]) => {
    onUpdateActiveSpace({ statuses: newStatuses });
  }

  const closingStatusName = activeSpace.closingStatusName;
  const activeStatuses = statuses.filter(s => s.name !== closingStatusName);
  const closingStatus = statuses.find(s => s.name === closingStatusName);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = allTasks.find(t => t.id === taskId);
    
    if (task && task.status !== newStatus) {
        onUpdateTask({ ...task, status: newStatus });
    }

    setDraggedTask(null);
  };


  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleAddNewColumn = () => {
    const newStatusName = `New Status ${statuses.length + 1}`;
    const randomColor = STATUS_COLORS[statuses.length % STATUS_COLORS.length];
    setStatuses([...statuses, { name: newStatusName, color: randomColor.color }]);
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
    onUpdateTasks(allTasks.map(t => t.status === oldName ? { ...t, status: newColumnName } : t));
    
    const newSpaceData: Partial<Space> = {
        statuses: statuses.map(s => s.name === oldName ? { ...s, name: newColumnName } : s)
    };
    if (activeSpace.closingStatusName === oldName) {
        newSpaceData.closingStatusName = newColumnName;
    }
    onUpdateActiveSpace(newSpaceData);

    setEditingColumn(null);
    setNewColumnName("");
  }

  const handleDeleteColumn = (columnToDelete: string) => {
    if (statuses.length <= 1) {
        toast({ variant: 'destructive', title: 'Cannot delete the last column.'});
        return;
    }
    if (activeSpace.closingStatusName === columnToDelete) {
        onUpdateActiveSpace({ closingStatusName: undefined });
    }
    const defaultColumn = statuses.find(s => s.name !== columnToDelete)!;
    onUpdateTasks(allTasks.map(t => t.status === columnToDelete ? { ...t, status: defaultColumn.name } : t));
    setStatuses(statuses.filter(s => s.name !== columnToDelete));
  }

  const handleChangeColor = (statusName: string, color: string) => {
    onUpdateActiveSpace({ statuses: statuses.map(s => s.name === statusName ? { ...s, color: color } : s) });
  }

  const handleSetClosingStatus = (statusName: string) => {
    onUpdateActiveSpace({ closingStatusName: activeSpace.closingStatusName === statusName ? undefined : statusName });
  }

  const renderStatusColumn = (status: Status) => (
      <div
        key={status.name}
        className="flex-shrink-0 w-80"
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
                    {closingStatusName === status.name && (
                       <CheckCircle className="h-4 w-4 text-primary" />
                    )}
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
                            <DropdownMenuSubContent className="w-60 p-2">
                                 <div className="grid grid-cols-5 gap-2 mb-2">
                                    {STATUS_COLORS.map(color => (
                                        <button
                                            key={color.name}
                                            onClick={() => handleChangeColor(status.name, color.color)}
                                            className={cn("w-8 h-8 rounded-md border-2", status.color === color.color ? 'border-primary' : 'border-transparent')}
                                            style={{ backgroundColor: color.color }}
                                            aria-label={color.name}
                                        />
                                    ))}
                                </div>
                                <Input
                                    type="text"
                                    defaultValue={status.color}
                                    className="h-8"
                                    onBlur={(e) => handleChangeColor(status.name, e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleChangeColor(status.name, e.currentTarget.value)}}
                                />
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => handleSetClosingStatus(status.name)}>
                        <Archive className="mr-2 h-4 w-4" /> 
                        {closingStatusName === status.name ? "Unset as closing status" : "Set as closing status"}
                    </DropdownMenuItem>
                    
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
        <div 
          className="bg-primary/5 rounded-lg p-2 max-h-[calc(100vh-16rem)] overflow-y-auto min-h-[5rem]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status.name)}
        >
          {tasks
            .filter(task => task.status === status.name)
            .map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
              >
                <TaskCard 
                  task={task} 
                  project={project}
                  onClick={() => onTaskClick(task)} 
                  isDragging={draggedTask === task.id}
                  allUsers={allUsers}
                />
              </div>
            ))}
        </div>
      </div>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <Button onClick={onNewTaskRequest}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {activeStatuses.map(renderStatusColumn)}
        {closingStatus && renderStatusColumn(closingStatus)}
        <div className="flex-shrink-0 w-80">
            <Button variant="outline" className="w-full" onClick={handleAddNewColumn}>
                <Plus className="mr-2 h-4 w-4" /> Add Status
            </Button>
        </div>
      </div>
    </>
  );
}
