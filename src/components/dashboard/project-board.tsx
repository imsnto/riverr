'use client';

import React, { useState, DragEvent, useRef, useEffect } from 'react';
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
  CheckCircle,
  ChevronsUpDown,
  ArrowLeft,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { Button, buttonVariants } from '../ui/button';
import { cn } from '@/lib/utils';
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
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format, parseISO } from 'date-fns';
import { Checkbox } from '../ui/checkbox';

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0]?.toUpperCase() || '';
};

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
        'mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer',
        isDragging && 'opacity-50 ring-2 ring-primary'
      )}
    >
      <CardHeader className="p-3 cursor-grab">
        <CardTitle className="text-sm font-medium">{task.name}</CardTitle>
      </CardHeader>
      <CardFooter className="flex justify-between items-center p-3 pt-0">
        <div className="flex items-center gap-2 text-muted-foreground">
          {task.taskKey && <span className="text-xs font-semibold font-mono">{task.taskKey}</span>}
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
  onSelectProject,
  onBack,
  onEditProject,
  onDeleteProject,
}: ProjectBoardProps) {
  const [viewMode, setViewMode] = useState<'board' | 'list'>(project.defaultView || 'board');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

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

  const projectMembers = allUsers.filter((u) => project.members.includes(u.id));

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

    const sourceColumn = projectTasks.filter((t) => t.status === taskToMove.status);
    const targetColumn = projectTasks.filter((t) => t.status === newStatus);

    const fromIndex = sourceColumn.findIndex((t) => t.id === taskId);

    let insertIndex = dropIndicator.index;
    if (sameColumn && fromIndex !== -1 && fromIndex < insertIndex) {
      insertIndex -= 1;
    }
    insertIndex = Math.max(0, Math.min(insertIndex, targetColumn.length));

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
      const finalTasks = newAllTasks.map((t) => (t.id === taskId ? taskWithActivity : t));
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
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
              <h2 className="text-lg font-semibold truncate">{status.name}</h2>
              {closingStatusName === status.name && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
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
                <DropdownMenuItem
                  onClick={() => {
                    setEditingColumn(status.name);
                    setNewColumnName(status.name);
                  }}
                >
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
                        {STATUS_COLORS.map((color) => (
                          <button
                            key={color.name}
                            onClick={() => handleChangeColor(status.name, color.color)}
                            className={cn(
                              'w-8 h-8 rounded-md border-2',
                              status.color === color.color ? 'border-primary' : 'border-transparent'
                            )}
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleChangeColor(status.name, e.currentTarget.value);
                        }}
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => handleSetClosingStatus(status.name)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {closingStatusName === status.name ? 'Unset as closing status' : 'Set as closing status'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> <span>Delete</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the &quot;{status.name}&quot; column. All tasks in this column will be moved to the
                        first column. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteColumn(status.name)}
                        className={cn(buttonVariants({ variant: 'destructive' }))}
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-primary/5 rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-0.5">
            {columnTasks.map((task, index) => {
              const showIndicator = dropIndicator?.status === status.name && dropIndicator.index === index;
              const isTaskBeingDragged = draggedTask === task.id;

              return (
                <React.Fragment key={task.id}>
                  {showIndicator && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                  <div
                    ref={(el) => {
                      taskCardRefs.current[task.id] = el;
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn('transition-all duration-200', isTaskBeingDragged ? 'opacity-30' : 'opacity-100')}
                  >
                    <TaskCard
                      task={task}
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
    );
  };

  const renderListView = () => {
    return (
      <div className="w-full">
        <Table className="min-w-[1000px]">
          {/* Sticky header inside the scrollable list container */}
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="h-12">
              <TableHead className="w-12">
                <Checkbox />
              </TableHead>
              <TableHead className="w-32">Key</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {tasks.map((task) => {
              const assignee = allUsers.find((u) => u.id === task.assigned_to);
              const reporter = allUsers.find((u) => u.id === task.createdBy);
              const statusObj = statuses.find((s) => s.name === task.status);

              return (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-muted/40 h-12"
                  onClick={() => onTaskClick(task)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox />
                  </TableCell>

                  <TableCell className="font-mono text-muted-foreground">{task.taskKey}</TableCell>

                  <TableCell className="font-medium">
                    <span className="group-hover:text-primary transition-colors">{task.name}</span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={reporter?.avatarUrl} />
                        <AvatarFallback>{reporter ? getInitials(reporter.name) : '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate max-w-[140px]">{reporter?.name || 'Unknown'}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assignee?.avatarUrl} />
                        <AvatarFallback>{assignee ? getInitials(assignee.name) : '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate max-w-[140px]">{assignee?.name || 'Unassigned'}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: statusObj?.color,
                        color: statusObj?.color,
                        backgroundColor: `${statusObj?.color ?? '#000'}10`,
                      }}
                    >
                      {task.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {task.createdAt ? format(parseISO(task.createdAt), 'dd/MMM/yy') : '--'}
                  </TableCell>
                </TableRow>
              );
            })}

            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No tasks found in this project.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="p-3">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-primary"
            onClick={() => onNewTaskRequest()}
          >
            <Plus className="h-4 w-4 mr-2" /> Add task
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex h-full min-w-0 flex-col overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden md:flex w-full min-w-0 shrink-0 justify-between items-center px-6 pt-6 pb-2 border-b">
          <div className="flex items-center gap-4 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-2xl font-bold p-2 -ml-2 min-w-0">
                  <span className="truncate">{project.name}</span>
                  <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onEditProject(project)}>
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Edit Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteAlertOpen(true)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setViewMode('list')}
              >
                <LayoutList className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setViewMode('board')}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {projectMembers.slice(0, 5).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                  <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                </Avatar>
              ))}
              {projectMembers.length > 5 && (
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback>+{projectMembers.length - 5}</AvatarFallback>
                </Avatar>
              )}
            </div>
            <Button size="sm" onClick={() => onNewTaskRequest()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden w-full min-w-0 shrink-0 mb-4 space-y-4 p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold truncate">{project.name}</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('board')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onNewTaskRequest()}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content area: Handle scrolling here */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {viewMode === 'board' ? (
            /* Board: Standard native horizontal scroll */
            <div className="h-full w-full overflow-x-auto overflow-y-hidden">
              <div className="flex w-max items-start gap-4 p-4 md:p-6 md:pt-2 h-full">
                {activeStatuses.map(renderStatusColumn)}
                {closingStatus && renderStatusColumn(closingStatus)}
                <div className="flex-shrink-0 w-72">
                  <Button variant="outline" className="w-full" onClick={handleAddNewColumn}>
                    <Plus className="mr-2 h-4 w-4" /> Add Status
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* List: Horizontal scroll for columns + Vertical for rows */
            <div className="h-full w-full overflow-hidden">
              <div className="h-full w-full overflow-x-auto">
                <div className="min-w-[1000px] p-4 md:p-6 h-full">
                  <div className="h-full max-h-full overflow-y-auto rounded-lg border bg-card">
                    {renderListView()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{project.name}&quot; project and all of its tasks. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteProject(project.id)}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
