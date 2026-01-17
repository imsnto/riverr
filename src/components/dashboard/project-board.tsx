

'use client';

import React, { useState, DragEvent, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Task, Project, Hub, Status, Activity } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2, Palette, Calendar, MessageSquare, Archive, CheckCircle, Folder, ChevronsUpDown } from 'lucide-react';
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
import { useAuth } from '@/hooks/use-auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';

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
  activeHub: Hub;
  allUsers: User[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onNewTaskRequest: (status?: string) => void;
  onTaskClick: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onSelectProject: (id: string) => void;
}

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: '#6b7280' },
    { name: 'In Progress', color: '#3b82f6' },
    { name: 'Review', color: '#f59e0b' },
    { name: 'Done', color: '#22c55e' },
]

export default function ProjectBoard({ project, projects, allTasks, onUpdateTasks, activeHub, allUsers, onUpdateActiveHub, onNewTaskRequest, onTaskClick, onUpdateTask, onSelectProject }: ProjectBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [isProjectSheetOpen, setIsProjectSheetOpen] = useState(false);
  
  const tasks = allTasks.filter(t => t.project_id === project.id && !t.parentId);
  const statuses = activeHub.statuses || defaultStatuses;
  
  const closingStatusName = activeHub.closingStatusName;
  const activeStatuses = statuses.filter(s => s.name !== closingStatusName);
  const closingStatus = statuses.find(s => s.name === closingStatusName);
  
  const [dropIndicator, setDropIndicator] = useState<{ status: string; index: number } | null>(null);
  const taskCardRefs = useRef<Record<string, HTMLDivElement | null>>({});


  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault();

    // Full visible list for THIS PROJECT + STATUS (no filtering out the dragged card)
    const columnTasks = tasks.filter(t => t.status === status);

    const mouseY = e.clientY;
    let closestTaskIndex = columnTasks.length;

    for (let i = 0; i < columnTasks.length; i++) {
        const t = columnTasks[i];

        // Skip comparing against the dragged card’s own midpoint
        if (t.id === draggedTask) continue;

        const el = taskCardRefs.current[t.id];
        if (!el) continue;

        const { top, height } = el.getBoundingClientRect();
        const mid = top + height / 2;
        if (mouseY < mid) {
        closestTaskIndex = i;
        break;
        }
    }

    if (dropIndicator?.status !== status || dropIndicator?.index !== closestTaskIndex) {
        setDropIndicator({ status, index: closestTaskIndex });
    }
    };
  
  const handleColumnDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Check if the relatedTarget (where the mouse entered) is outside the component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

    const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !dropIndicator) return;

    const taskToMove = allTasks.find(t => t.id === taskId);
    if (!taskToMove) return;

    const sameColumn = taskToMove.status === newStatus;

    // Project-scoped lists (avoid touching other projects)
    const projectTasks = allTasks.filter(t => t.project_id === project.id && !t.parentId);
    const otherTasks = allTasks.filter(t => !(t.project_id === project.id && !t.parentId));

    // Build per-column lists from projectTasks
    const sourceColumn = projectTasks.filter(t => t.status === taskToMove.status);
    const targetColumn = projectTasks.filter(t => t.status === newStatus);

    const fromIndex = sourceColumn.findIndex(t => t.id === taskId);

    // Insert index is based on the *visible list* (which includes the dragged card)
    // If dragging within the same column *downwards*, we need to shift by -1 after removal.
    let insertIndex = dropIndicator.index;
    if (sameColumn && fromIndex !== -1 && fromIndex < insertIndex) {
        insertIndex -= 1;
    }
    insertIndex = Math.max(0, Math.min(insertIndex, targetColumn.length));

    // Rebuild the new projectTasks order
    const projectTasksWithoutDragged = projectTasks.filter(t => t.id !== taskId);
    const newUpdatedTask = { ...taskToMove, status: newStatus };

    // Recreate targetColumn from the filtered list to keep order coherent
    const newTargetColumn = projectTasksWithoutDragged
        .filter(t => t.status === newStatus);

    newTargetColumn.splice(insertIndex, 0, newUpdatedTask);

    // Reassemble projectTasks in status order: put back all non-target statuses, then new target status list
    const rebuiltProjectTasks = [
        ...projectTasksWithoutDragged.filter(t => t.status !== newStatus),
        ...newTargetColumn,
    ];

    // Merge back with tasks from other projects unchanged
    const newAllTasks = [
        ...otherTasks,
        ...rebuiltProjectTasks,
    ];

    // Persist status change activity if needed
    if (!sameColumn && appUser) {
        const newActivity: Activity = {
        id: `act-${Date.now()}`,
        user_id: appUser.id,
        timestamp: new Date().toISOString(),
        type: 'status_change',
        from: taskToMove.status,
        to: newStatus,
        };
        const taskWithActivity = { ...newUpdatedTask, activities: [...(newUpdatedTask.activities || []), newActivity] };
        onUpdateTask(taskWithActivity); // Update task with new activity
        
        // Update the task in the reordered list as well
        const finalTasks = newAllTasks.map(t => t.id === taskId ? taskWithActivity : t);
        onUpdateTasks(finalTasks);
    } else {
        onUpdateTasks(newAllTasks);
    }

    setDropIndicator(null);
    setDraggedTask(null);
    };


  const handleDragEnd = () => {
    setDraggedTask(null);
    setDropIndicator(null);
  };

  const handleAddNewColumn = () => {
    const newStatusName = `New Status ${statuses.length + 1}`;
    const randomColor = STATUS_COLORS[statuses.length % STATUS_COLORS.length];
    onUpdateActiveHub({ statuses: [...statuses, { name: newStatusName, color: randomColor.color }] });
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
    
    const newHubData: Partial<Hub> = {
        statuses: statuses.map(s => s.name === oldName ? { ...s, name: newColumnName } : s)
    };
    if (activeHub.closingStatusName === oldName) {
        newHubData.closingStatusName = newColumnName;
    }
    onUpdateActiveHub(newHubData);

    setEditingColumn(null);
    setNewColumnName("");
  }

  const handleDeleteColumn = (columnToDelete: string) => {
    if (statuses.length <= 1) {
        toast({ variant: 'destructive', title: 'Cannot delete the last column.'});
        return;
    }
    
    const defaultColumn = statuses.find(s => s.name !== columnToDelete)!;
    
    onUpdateTasks(allTasks.map(t => t.status === columnToDelete ? { ...t, status: defaultColumn.name } : t));

    const newHubData: Partial<Hub> = {
        statuses: statuses.filter(s => s.name !== columnToDelete)
    };

    if (activeHub.closingStatusName === columnToDelete) {
        newHubData.closingStatusName = undefined;
    }
    onUpdateActiveHub(newHubData);
  }

  const handleChangeColor = (statusName: string, color: string) => {
    onUpdateActiveHub({ statuses: statuses.map(s => s.name === statusName ? { ...s, color: color } : s) });
  }

  const handleSetClosingStatus = (statusName: string) => {
    onUpdateActiveHub({ closingStatusName: activeHub.closingStatusName === statusName ? undefined : statusName });
  }

  const renderStatusColumn = (status: Status) => {
      const columnTasks = tasks.filter(task => task.status === status.name);
      
      return (
      <div
        key={status.name}
        className="flex-shrink-0 w-[280px]"
        onDrop={(e) => handleDrop(e, status.name)}
        onDragOver={(e) => handleDragOver(e, status.name)}
        onDragLeave={handleColumnDragLeave}
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
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onNewTaskRequest(status.name)}>
                    <Plus className="h-4 w-4" />
                </Button>
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
        </div>
        <div 
          className="bg-primary/5 rounded-lg p-2 max-h-[calc(100vh-16rem)] overflow-y-auto min-h-[5rem]"
        >
            <div className="space-y-0.5">
            {columnTasks.map((task, index) => {
                const showIndicator = dropIndicator?.status === status.name && dropIndicator.index === index;
                const isTaskBeingDragged = draggedTask === task.id;
                return (
                    <React.Fragment key={task.id}>
                        {showIndicator && (
                            <div className="h-10 border-2 border-dashed border-primary rounded-lg" />
                        )}
                        <div
                            ref={el => taskCardRefs.current[task.id] = el}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                                "transition-all duration-200",
                                isTaskBeingDragged ? "opacity-30" : "opacity-100"
                            )}
                        >
                            <TaskCard 
                            task={task} 
                            project={project}
                            onClick={() => onTaskClick(task)} 
                            isDragging={isTaskBeingDragged}
                            allUsers={allUsers}
                            />
                        </div>
                    </React.Fragment>
                );
            })}
             {dropIndicator?.status === status.name && dropIndicator.index === columnTasks.length && (
                <div className="h-10 border-2 border-dashed border-primary rounded-lg" />
            )}
            </div>
        </div>
      </div>
  )};

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <Button onClick={() => onNewTaskRequest()}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

       {/* Mobile Header */}
        <div className="md:hidden mb-4">
            <Button variant="outline" className="w-full justify-between" onClick={() => setIsProjectSheetOpen(true)}>
                <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <span className="font-semibold">{project.name}</span>
                </div>
                <ChevronsUpDown className="h-4 w-4" />
            </Button>
        </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {activeStatuses.map(renderStatusColumn)}
        {closingStatus && renderStatusColumn(closingStatus)}
        <div className="flex-shrink-0 w-72">
            <Button variant="outline" className="w-full" onClick={handleAddNewColumn}>
                <Plus className="mr-2 h-4 w-4" /> Add Status
            </Button>
        </div>
      </div>
      
      <Sheet open={isProjectSheetOpen} onOpenChange={setIsProjectSheetOpen}>
          <SheetContent side="left" className="p-0">
              <SheetHeader className="p-4 border-b text-left">
                  <SheetTitle>Switch Project</SheetTitle>
              </SheetHeader>
              <div className="p-2">
                  {projects.map(p => (
                      <Button
                          key={p.id}
                          variant={project.id === p.id ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => {
                              onSelectProject(p.id);
                              setIsProjectSheetOpen(false);
                          }}
                      >
                          {p.name}
                      </Button>
                  ))}
              </div>
          </SheetContent>
      </Sheet>
    </>
  );
}
