'use client';

import React, { useState, DragEvent, useRef, useEffect, useMemo } from 'react';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Task, Project, Hub, Status, Activity } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import {
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Palette,
  Archive,
  ChevronDown,
  Calendar as CalendarIcon,
  Flag,
  Share2,
  LayoutList,
  LayoutGrid,
  Table as TableIcon,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import { Button, buttonVariants } from '../ui/button';
import { cn, getInitials } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '../ui/dropdown-menu';
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
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '../ui/calendar';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const STATUS_COLORS = [
  { name: 'Gray', color: '#6b7280' },
  { name: 'Stone', color: '#78716c' },
  { name: 'Zinc', color: '#71717a' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Lime', color: '#84cc16' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Sky', color: '#0ea5e9' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Fuchsia', color: '#d946ef' },
  { name: 'Pink', color: '#ec4899' },
];

const TaskCard = ({
  task,
  onClick,
  isDragging,
  allUsers,
}: {
  task: Task;
  onClick: () => void;
  isDragging: boolean;
  allUsers: User[];
}) => {
  const assignee = allUsers.find((u) => u.id === task.assigned_to);

  return (
    <Card
      onClick={onClick}
      className={cn(
        'mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer border-[#2a2a2a]',
        isDragging && 'opacity-50 ring-2 ring-primary'
      )}
    >
      <CardHeader className="p-3 cursor-grab space-y-1.5">
        <div className="flex items-center justify-between">
          {task.taskKey && (
            <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider">
              {task.taskKey}
            </span>
          )}
          {task.priority && <PriorityIcon priority={task.priority} />}
        </div>
        <CardTitle className="text-sm font-medium leading-snug">{task.name}</CardTitle>
      </CardHeader>
      <CardFooter className="flex justify-end items-center p-3 pt-0">
        <Avatar className="h-5 w-5 border border-white/10">
          <AvatarImage src={assignee?.avatarUrl} alt={assignee?.name} />
          <AvatarFallback className="text-[8px]">{assignee ? getInitials(assignee.name) : '?'}</AvatarFallback>
        </Avatar>
      </CardFooter>
    </Card>
  );
};

const PriorityIcon = ({ priority }: { priority: Task['priority'] }) => {
    const styles = {
        'Low': 'text-slate-400',
        'Medium': 'text-blue-400',
        'High': 'text-orange-400',
        'Urgent': 'text-red-500',
    };
    return <Flag className={cn("h-3 w-3", priority ? (styles as any)[priority] : 'text-muted-foreground/20')} />;
}

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
  onBack: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

const defaultStatuses: Status[] = [
  { name: 'Backlog', color: '#6b7280' },
  { name: 'In Progress', color: '#3b82f6' },
  { name: 'In Review', color: '#f59e0b' },
  { name: 'Done', color: '#22c55e' },
];

export default function ProjectBoard({
  project,
  projects,
  allTasks,
  onUpdateTasks,
  activeHub,
  allUsers,
  onUpdateActiveHub,
  onNewTaskRequest,
  onTaskClick,
  onUpdateTask,
  onBack,
  onEditProject,
  onDeleteProject,
}: ProjectBoardProps) {
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'table'>(project.defaultView || 'board');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  const [columnWidths, setColumnWidths] = useState<Record<string, number | string>>({
    key: 90,
    name: 'clamp(180px, 28vw, 260px)',
    assignee: 180,
    status: 160,
    dueDate: 140,
    priority: 130
  });

  const [sortConfig, setSortConfig] = useState<{ key: keyof Task | 'assigneeName'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  useEffect(() => {
    setViewMode(project.defaultView || 'board');
  }, [project.id, project.defaultView]);

  const tasks = allTasks.filter((t) => t.project_id === project.id && !t.parentId);
  const statuses = activeHub.statuses || defaultStatuses;

  const closingStatusName = activeHub.closingStatusName;
  const activeStatuses = statuses.filter((s) => s.name !== closingStatusName);
  const closingStatus = statuses.find((s) => s.name === closingStatusName);

  const [dropIndicator, setDropIndicator] = useState<{ status: string; index: number } | null>(null);
  const taskCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const projectMembers = useMemo(() => {
    return allUsers.filter(u => project.members.includes(u.id));
  }, [allUsers, project.members]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault();
    const columnTasks = tasks.filter((t) => t.status === status);
    const mouseY = e.clientY;
    let closestTaskIndex = columnTasks.length;

    for (let i = 0; i < columnTasks.length; i++) {
      const t = columnTasks[i];
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !dropIndicator) return;

    const taskToMove = allTasks.find((t) => t.id === taskId);
    if (!taskToMove) return;

    const sameColumn = taskToMove.status === newStatus;
    const projectTasks = allTasks.filter((t) => t.project_id === project.id && !t.parentId);
    const otherTasks = allTasks.filter((t) => !(t.project_id === project.id && !t.parentId));

    const fromIndex = projectTasks.filter(t => t.status === taskToMove.status).findIndex((t) => t.id === taskId);

    let insertIndex = dropIndicator.index;
    if (sameColumn && fromIndex !== -1 && fromIndex < insertIndex) {
      insertIndex -= 1;
    }

    const projectTasksWithoutDragged = projectTasks.filter((t) => t.id !== taskId);
    const newUpdatedTask = { ...taskToMove, status: newStatus };

    const newTargetColumn = projectTasksWithoutDragged.filter((t) => t.status === newStatus);
    newTargetColumn.splice(insertIndex, 0, newUpdatedTask);

    const rebuiltProjectTasks = [
      ...projectTasksWithoutDragged.filter((t) => t.status !== newStatus),
      ...newTargetColumn,
    ];

    const newAllTasks = [...otherTasks, ...rebuiltProjectTasks];

    if (!sameColumn && appUser) {
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        user_id: appUser.id,
        timestamp: new Date().toISOString(),
        type: 'status_change',
        from: taskToMove.status,
        to: newStatus,
      };
      const taskWithActivity = {
        ...newUpdatedTask,
        activities: [...(newUpdatedTask.activities || []), newActivity],
      };
      onUpdateTask(taskWithActivity);
      onUpdateTasks(newAllTasks.map(t => t.id === taskId ? taskWithActivity : t));
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
    
    // Immediately enter editing mode for the new status
    setEditingColumn(newStatusName);
    setNewColumnName(newStatusName);
  };

  const handleRenameColumn = (oldName: string) => {
    if (!newColumnName || newColumnName === oldName) {
      setEditingColumn(null);
      return;
    }
    if (statuses.find((s) => s.name === newColumnName)) {
      toast({ variant: 'destructive', title: 'Status name already exists.' });
      return;
    }

    onUpdateTasks(allTasks.map((t) => (t.status === oldName ? { ...t, status: newColumnName } : t)));

    const newHubData: Partial<Hub> = {
      statuses: statuses.map((s) => (s.name === oldName ? { ...s, name: newColumnName } : s)),
    };
    if (activeHub.closingStatusName === oldName) {
      newHubData.closingStatusName = newColumnName;
    }
    onUpdateActiveHub(newHubData);

    setEditingColumn(null);
    setNewColumnName('');
  };

  const handleDeleteColumn = (columnToDelete: string) => {
    if (statuses.length <= 1) {
      toast({ variant: 'destructive', title: 'Cannot delete the last column.' });
      return;
    }

    const defaultColumn = statuses.find((s) => s.name !== columnToDelete)!;

    onUpdateTasks(allTasks.map((t) => (t.status === columnToDelete ? { ...t, status: defaultColumn.name } : t)));

    const newHubData: Partial<Hub> = {
      statuses: statuses.filter((s) => s.name !== columnToDelete),
    };

    if (activeHub.closingStatusName === columnToDelete) {
      newHubData.closingStatusName = undefined;
    }
    onUpdateActiveHub(newHubData);
  };

  const handleChangeColor = (statusName: string, color: string) => {
    onUpdateActiveHub({ statuses: statuses.map((s) => (s.name === statusName ? { ...s, color } : s)) });
  };

  const handleSetClosingStatus = (statusName: string) => {
    onUpdateActiveHub({
      closingStatusName: activeHub.closingStatusName === statusName ? undefined : statusName,
    });
  };

  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const currentWidth = columnWidths[col];
    const startWidth = typeof currentWidth === 'number' ? currentWidth : 200;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths(prev => ({ ...prev, [col]: Math.max(50, startWidth + deltaX) }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const sortedTasks = useMemo(() => {
    const data = [...tasks];
    if (sortConfig !== null) {
      data.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Task];
        let bValue: any = b[sortConfig.key as keyof Task];
        if (sortConfig.key === 'assigneeName') {
            aValue = allUsers.find(u => u.id === a.assigned_to)?.name || '';
            bValue = allUsers.find(u => u.id === b.assigned_to)?.name || '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [tasks, sortConfig, allUsers]);

  const requestSort = (key: keyof Task | 'assigneeName') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFieldChange = (field: keyof Task, value: any) => {
      // Placeholder for table view updates
  }

  const renderStatusColumn = (status: Status) => {
    const columnTasks = tasks.filter((task) => task.status === status.name);

    return (
      <div
        key={status.name}
        className="flex-shrink-0 w-64 md:w-72 h-full min-h-0 flex flex-col"
        onDrop={(e) => handleDrop(e, status.name)}
        onDragOver={(e) => handleDragOver(e, status.name)}
        onDragLeave={handleColumnDragLeave}
      >
        <div className="flex justify-between items-center mb-4 px-1 shrink-0">
          {editingColumn === status.name ? (
            <Input
              defaultValue={status.name}
              onChange={(e) => setNewColumnName(e.target.value)}
              onBlur={() => handleRenameColumn(status.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameColumn(status.name);
              }}
              autoFocus
              className="h-8"
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
              <h2 className="text-sm font-semibold uppercase tracking-tight truncate text-muted-foreground">{status.name}</h2>
              <span className="text-xs text-muted-foreground/50 font-medium ml-1">{columnTasks.length}</span>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onNewTaskRequest(status.name)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setEditingColumn(status.name); setNewColumnName(status.name); }}>
                  <Edit className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Palette className="mr-2 h-4 w-4" /><span>Change Color</span></DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-60 p-2">
                      <div className="grid grid-cols-5 gap-2 mb-2">{STATUS_COLORS.map((color) => (<button key={color.name} onClick={() => handleChangeColor(status.name, color.color)} className={cn('w-8 h-8 rounded-md border-2', status.color === color.color ? 'border-primary' : 'border-transparent')} style={{ backgroundColor: color.color }} aria-label={color.name} />))}</div>
                      <Input type="text" defaultValue={status.color} className="h-8" onBlur={(e) => handleChangeColor(status.name, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleChangeColor(status.name, e.currentTarget.value); }} />
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSetClosingStatus(status.name)}><Archive className="mr-2 h-4 w-4" />{closingStatusName === status.name ? 'Unset as closing status' : 'Set as closing status'}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> <span>Delete</span></DropdownMenuItem></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will delete the &quot;{status.name}&quot; column. All tasks in this column will be moved to the first column. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteColumn(status.name)} className={cn(buttonVariants({ variant: 'destructive' }))}>Continue</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-0.5">
            {columnTasks.map((task, index) => {
              const showIndicator = dropIndicator?.status === status.name && dropIndicator.index === index;
              const isTaskBeingDragged = draggedTask === task.id;
              return (
                <React.Fragment key={task.id}>
                  {showIndicator && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                  <div ref={(el) => { taskCardRefs.current[task.id] = el; }} draggable onDragStart={(e) => handleDragStart(e, task.id)} onDragEnd={handleDragEnd} className={cn('transition-all duration-200', isTaskBeingDragged ? 'opacity-30' : 'opacity-100')}>
                    <TaskCard task={task} onClick={() => onTaskClick(task)} isDragging={isTaskBeingDragged} allUsers={allUsers} />
                  </div>
                </React.Fragment>
              );
            })}
            {dropIndicator?.status === status.name && dropIndicator.index === columnTasks.length && (<div className="h-10 border-2 border-dashed border-primary rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    return (
        <div className="flex flex-col gap-8 pb-20 max-w-6xl w-full overflow-x-auto">
            {statuses.map(status => {
                const statusTasks = tasks.filter(t => t.status === status.name);
                return (
                    <div key={status.name} className="space-y-2 min-w-[800px]">
                        <div className="flex items-center gap-3 px-2 py-1.5 bg-muted/20 rounded-md shrink-0 border-b border-white/5">
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            <Badge style={{ backgroundColor: status.color, color: 'white' }} className="uppercase px-2 py-0.5 text-[10px] font-bold rounded-sm tracking-wider border-none">{status.name}</Badge>
                            <span className="text-xs text-muted-foreground font-medium">{statusTasks.length}</span>
                            <div className="flex items-center gap-1 ml-auto">
                                <button className="h-7 px-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => onNewTaskRequest(status.name)}><Plus className="h-3.5 w-3.5" /> Add Task</button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <div className="w-full">
                            <div className="grid grid-cols-[100px_1fr_80px_100px_100px_40px] gap-4 px-4 py-2 text-[11px] font-semibold text-muted-foreground border-b border-white/5 uppercase tracking-normal">
                                <div className="pl-1">Key</div>
                                <div>Name</div>
                                <div className="text-center">User</div>
                                <div className="text-center">Due</div>
                                <div className="text-center">Pri</div>
                                <div />
                            </div>
                            <div className="divide-y divide-white/5">
                                {statusTasks.map(task => {
                                    const assignee = allUsers.find(u => u.id === task.assigned_to);
                                    return (
                                        <div key={task.id} className="grid grid-cols-[100px_1fr_80px_100px_100px_40px] gap-4 px-4 py-3 hover:bg-white/[0.03] cursor-pointer items-center group transition-colors" onClick={() => onTaskClick(task)}>
                                            <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded shrink-0 w-fit whitespace-nowrap">{task.taskKey || '---'}</div>
                                            <div className="flex items-center min-w-0"><span className="text-sm truncate font-medium group-hover:text-primary transition-colors">{task.name}</span></div>
                                            <div className="flex justify-center">{assignee ? (<Avatar className="h-6 w-6 border border-white/10"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback className="text-[10px] bg-indigo-600 text-white border-none">{getInitials(assignee.name)}</AvatarFallback></Avatar>) : (<div className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center"><Plus className="h-3 w-3 text-muted-foreground/30" /></div>)}</div>
                                            <div className="flex justify-center">{task.due_date ? (<div className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5 opacity-60" />{format(parseISO(task.due_date), 'MMM d')}</div>) : (<CalendarIcon className="h-4 w-4 text-muted-foreground/20" />)}</div>
                                            <div className="flex justify-center"><PriorityIcon priority={task.priority} /></div>
                                            <div className="flex justify-center opacity-0 group-hover:opacity-100"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></div>
                                        </div>
                                    );
                                })}
                                <button className="w-full text-left px-4 py-2.5 text-xs text-muted-foreground hover:bg-white/[0.03] flex items-center gap-3 transition-colors group" onClick={() => onNewTaskRequest(status.name)}><Plus className="h-4 w-4 group-hover:text-foreground" /><span className="group-hover:text-foreground font-medium">Add Task</span></button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderTableView = () => {
    return (
        <div className="w-full h-full overflow-auto border rounded-md bg-card">
            <table className="min-w-max w-fit text-left border-collapse table-fixed">
                <thead>
                    <tr className="bg-muted/50 border-b border-white/5">
                        <th style={{ width: columnWidths.key }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 group">Key<div onMouseDown={(e) => handleResize('key', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                        <th style={{ width: columnWidths.name }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('name')}><div className="flex items-center gap-2">Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div><div onMouseDown={(e) => handleResize('name', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                        <th style={{ width: columnWidths.assignee }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('assigneeName')}><div className="flex items-center gap-2">Assignee {sortConfig.key === 'assigneeName' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div><div onMouseDown={(e) => handleResize('assignee', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                        <th style={{ width: columnWidths.status }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('status')}><div className="flex items-center gap-2">Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div><div onMouseDown={(e) => handleResize('status', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                        <th style={{ width: columnWidths.dueDate }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('due_date')}><div className="flex items-center gap-2">Due date {sortConfig.key === 'due_date' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div><div onMouseDown={(e) => handleResize('dueDate', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                        <th style={{ width: columnWidths.priority }} className="relative px-4 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors group" onClick={() => requestSort('priority')}><div className="flex items-center gap-2">Priority {sortConfig.key === 'priority' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</div><div onMouseDown={(e) => handleResize('priority', e)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" /></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sortedTasks.map((task) => {
                        const assignee = allUsers.find(u => u.id === task.assigned_to);
                        const statusObj = statuses.find(s => s.name === task.status);
                        const isDone = task.status === activeHub.closingStatusName;
                        return (
                            <tr key={task.id} className="hover:bg-white/[0.02] group h-11">
                                <td className="px-4 py-2 text-muted-foreground/50 font-mono text-[11px] whitespace-nowrap overflow-hidden">
                                    <button 
                                        className="hover:text-primary hover:underline transition-colors uppercase tracking-tight"
                                        onClick={() => onTaskClick(task)}
                                    >
                                        {task.taskKey || '---'}
                                    </button>
                                </td>
                                <td className="px-4 py-2"><div className="flex items-center gap-2 min-w-0"><Input defaultValue={task.name} className={cn("h-7 text-sm font-medium border-transparent bg-transparent hover:bg-white/5 focus:bg-background focus:border-input transition-all w-full truncate text-ellipsis whitespace-nowrap", isDone && "line-through text-muted-foreground")} onBlur={(e) => { if (e.target.value !== task.name) { onUpdateTask({ ...task, name: e.target.value }); } }} /></div></td>
                                <td className="px-4 py-2"><Select value={task.assigned_to || 'unassigned'} onValueChange={(val) => onUpdateTask({ ...task, assigned_to: val === 'unassigned' ? null : val })}><SelectTrigger className="h-7 border-transparent bg-transparent hover:bg-white/5 w-full gap-2 px-1"><SelectValue>{assignee ? (<div className="flex items-center gap-1.5 overflow-hidden"><Avatar className="h-5 w-5 border border-white/10 shrink-0"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback className="text-[8px]">{getInitials(assignee.name)}</AvatarFallback></Avatar><span className="text-xs truncate">{assignee.name}</span></div>) : <span className="text-muted-foreground/50 text-xs">Unassigned</span>}</SelectValue></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{allUsers.map(u => (<SelectItem key={u.id} value={u.id}><div className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarImage src={u.avatarUrl}/></Avatar>{u.name}</div></SelectItem>))}</SelectContent></Select></td>
                                <td className="px-4 py-2"><Select value={task.status} onValueChange={(val) => onUpdateTask({ ...task, status: val })}><SelectTrigger className="h-7 border-transparent bg-transparent hover:bg-white/5 w-full gap-2 px-1"><SelectValue>{statusObj && (<Badge style={{ backgroundColor: statusObj.color + '20', color: statusObj.color, borderColor: statusObj.color + '40' }} className="uppercase text-[10px] font-bold px-2 py-0 rounded-sm tracking-tight h-5 whitespace-nowrap">{statusObj.name}</Badge>)}</SelectValue></SelectTrigger><SelectContent>{statuses.map(s => (<SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>))}</SelectContent></Select></td>
                                <td className="px-4 py-2"><Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className={cn("h-7 px-1 text-xs font-normal w-full justify-start", !task.due_date && "text-muted-foreground/30")}>{task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'Set date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarPicker mode="single" selected={task.due_date ? parseISO(task.due_date) : undefined} onSelect={(d) => handleFieldChange('due_date', d?.toISOString())} initialFocus /></PopoverContent></Popover></td>
                                <td className="px-4 py-2"><Select value={task.priority || 'none'} onValueChange={(val) => onUpdateTask({ ...task, priority: val === 'none' ? null : val as any })}><SelectTrigger className="h-7 border-transparent bg-transparent hover:bg-white/5 w-full gap-2 px-1"><SelectValue>{task.priority ? (<div className="flex items-center gap-1.5"><PriorityIcon priority={task.priority} /><span className="text-[11px] capitalize">{task.priority}</span></div>) : <span className="text-muted-foreground/30 text-[11px]">None</span>}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Urgent">Urgent</SelectItem></SelectContent></Select></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-col border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 -ml-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 hover:bg-white/5">
                  <span className="text-sm font-semibold">{project.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onEditProject(project)}><Edit className="mr-2 h-4 w-4" /><span>Edit Details</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteAlertOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Delete Project</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 mr-2">
                {projectMembers.slice(0, 5).map(member => (
                    <Avatar key={member.id} className="h-7 w-7 border-2 border-background ring-1 ring-white/5"><AvatarImage src={member.avatarUrl} alt={member.name} /><AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback></Avatar>
                ))}
                {projectMembers.length > 5 && (<Avatar className="h-7 w-7 border-2 border-background bg-muted flex items-center justify-center ring-1 ring-white/5"><AvatarFallback className="text-[10px]">+{projectMembers.length - 5}</AvatarFallback></Avatar>)}
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground"><Share2 className="h-4 w-4" /><span className="text-xs">Share</span></Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <button onClick={() => setViewMode('list')} className={cn("flex items-center gap-2 py-3 text-xs font-medium border-b-2 transition-all", viewMode === 'list' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><LayoutList className="h-4 w-4" />List</button>
            <button onClick={() => setViewMode('board')} className={cn("flex items-center gap-2 py-3 text-xs font-medium border-b-2 transition-all", viewMode === 'board' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><LayoutGrid className="h-4 w-4" />Board</button>
            <button onClick={() => setViewMode('table')} className={cn("flex items-center gap-2 py-3 text-xs font-medium border-b-2 transition-all", viewMode === 'table' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}><TableIcon className="h-4 w-4" />Table</button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><div className="flex items-center"><Button size="sm" className="h-8 rounded-r-none" onClick={() => onNewTaskRequest()}>Add Task</Button><Button size="sm" className="h-8 rounded-l-none border-l border-white/10 px-2"><ChevronDown className="h-4 w-4" /></Button></div></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onNewTaskRequest()}>New Task</DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddNewColumn}>Add Status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {viewMode === 'board' ? (
          <div className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
            <div className="flex min-w-max items-start gap-4 p-4 md:p-6 md:pt-4 h-full">
              {activeStatuses.map(renderStatusColumn)}
              {closingStatus && renderStatusColumn(closingStatus)}
              <div className="flex-shrink-0 w-72"><Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground h-10 border border-dashed border-[#2a2a2a] hover:border-muted-foreground/50" onClick={handleAddNewColumn}><Plus className="mr-2 h-4 w-4" /> Add Status</Button></div>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="h-full w-full overflow-hidden flex flex-col"><div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-hidden overscroll-x-contain"><div className="p-4 md:p-6 h-full flex flex-col"><div className="flex-1 overflow-y-auto">{renderListView()}</div></div></div></div>
        ) : (
          <div className="h-full w-full overflow-hidden flex flex-col"><div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto overscroll-x-contain"><div className="p-4 md:p-6 h-full flex flex-col"><div className="flex-1">{renderTableView()}</div></div></div></div>
        )}
      </div>
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the &quot;{project.name}&quot; project and all of its tasks. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteProject(project.id)} className={cn(buttonVariants({ variant: 'destructive' }))}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
