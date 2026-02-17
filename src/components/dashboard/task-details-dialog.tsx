

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Task, Comment, Activity, User, Project, Attachment, TimeEntry } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bot, Calendar, CircleDot, Clock, Flag, Folder, Search, Tag, Users, Zap, Link as LinkIcon, ArrowRight, Paperclip, File, Image as ImageIcon, Plus, Trash2, CheckCircle2, X, ArrowLeft, ThumbsUp, MoreHorizontal, Edit, AtSign, Star, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarPicker } from '../ui/calendar';
import { format, parseISO } from 'date-fns';
import { Checkbox } from '../ui/checkbox';
import LogTimeDialog from './log-time-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { marked } from 'marked';


const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

const formatDuration = (hours: number | null) => {
    if (hours === null || hours === undefined || hours === 0) return '';
    
    const totalMinutes = Math.round(hours * 60);

    if (totalMinutes < 1) {
        return `< 1 min`;
    }

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const parts = [];
    if (h > 0) {
        parts.push(`${h} hr`);
    }
    if (m > 0) {
        parts.push(`${m} min`);
    }
    return parts.join(' ');
  };

  const parseDuration = (durationStr: string): number => {
    if (!durationStr) return 0;
    let totalHours = 0;
    const duration = durationStr.toLowerCase().trim();

    const matches = duration.match(/(\d*\.?\d+)\s*(h|m)?/g) || [];

    if (matches.length === 0 && !isNaN(parseFloat(duration))) {
        return parseFloat(duration);
    }
    
    matches.forEach(match => {
        const parts = match.match(/(\d*\.?\d+)\s*(h|m)?/);
        if (parts) {
            const value = parseFloat(parts[1]);
            const unit = parts[2];
            
            if (unit === 'h') {
                totalHours += value;
            } else if (unit === 'm') {
                totalHours += value / 60;
            } else if (!unit) {
                // If no unit, assume hours if it's the only number, otherwise minutes
                if (matches.length === 1) {
                    totalHours += value;
                } else {
                    totalHours += value / 60;
                }
            }
        }
    });

    return totalHours;
};



interface DetailRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    className?: string;
}
const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, children, className }) => (
    <div className={cn("space-y-2 md:grid md:grid-cols-[8rem_1fr] md:items-start md:gap-4 md:space-y-0", className)}>
        <div className="flex items-center gap-2 text-muted-foreground md:pt-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="md:col-span-1">{children}</div>
    </div>
);


const ActivityItem = ({ activity, allUsers }: { activity: Activity; allUsers: User[] }) => {
    const user = allUsers.find(u => u.id === activity.user_id);
    const renderContent = () => {
        switch (activity.type) {
            case 'task_creation':
                return (
                    <div><span className="font-semibold">{user?.name || 'Unknown'}</span> created this task.</div>
                );
            case 'status_change':
                return (
                    <div><span className="font-semibold">{user?.name}</span> changed status from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></div>
                );
            case 'assignee_change':
                const fromUser = allUsers.find(u => u.name === activity.from)?.name || activity.from || 'Unassigned';
                const toUser = allUsers.find(u => u.name === activity.to)?.name || activity.to || 'Unassigned';
                return (
                    <div><span className="font-semibold">{user?.name}</span> changed assignee from <Badge variant="outline">{fromUser}</Badge> to <Badge variant="outline">{toUser}</Badge></div>
                );
            case 'comment':
                 const commentText = activity.comment
                return (
                    <div>
                        <p><span className="font-semibold">{user?.name}</span> left a comment.</p>
                        {commentText && <div className="text-muted-foreground text-xs p-2 border rounded-md mt-1">{commentText}</div>}
                    </div>
                );
            case 'subtask_completion':
                return (
                     <div><span className="font-semibold">{user?.name}</span> marked subtask <Badge variant="outline">{activity.subtask_name}</Badge> as complete.</div>
                )
            default:
                return null;
        }
    }
    return (
        <div className="flex items-start gap-3">
            <Avatar className="h-6 w-6 mt-1">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback>{user ? getInitials(user.name) : 'U'}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
                {renderContent()}
                <p className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleString()}</p>
            </div>
        </div>
    )
}


interface TaskDetailsDialogProps {
    task: Task | null;
    timeEntries: TimeEntry[];
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateTask: (task: Task) => void;
    onAddTask: (task: Omit<Task, 'id'>, tempId: string) => Promise<Task | null>;
    onRemoveTask: (taskId: string) => void;
    onTaskSelect: (task: Task) => void;
    onLogTime: (timeData: Omit<TimeEntry, 'id'>) => void;
    statuses: string[];
    allUsers: User[];
    allTasks: Task[];
    projects: Project[];
}

export default function TaskDetailsDialog({ task: initialTask, timeEntries = [], isOpen, onOpenChange, onUpdateTask, onAddTask, onRemoveTask, onTaskSelect, onLogTime, statuses, allUsers, allTasks, projects }: TaskDetailsDialogProps) {
    const { toast } = useToast();
    const { appUser } = useAuth();
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newTag, setNewTag] = useState('');
    const [task, setTask] = useState(initialTask);
    const isCreating = initialTask?.id.startsWith('new-task-');
    
    // State for creating a new subtask
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string | null>(null);
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | null>(null);

    const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);
    const isMobile = useIsMobile();

    const [estTime, setEstTime] = useState<string>('');
    const [showEstTimeSuggestion, setShowEstTimeSuggestion] = useState(false);
    
    useEffect(() => {
        setTask(initialTask);
        if (initialTask) {
            setEstTime(formatDuration(initialTask.time_estimate));
            if (appUser && isCreating) {
                if (!initialTask.assigned_to) {
                    setTask(t => t ? { ...t, assigned_to: appUser.id } : t);
                }
                if (!initialTask.createdBy) {
                    setTask(t => t ? { ...t, createdBy: appUser.id } : t);
                }
            }
        }
    }, [initialTask, appUser, isCreating]);


    if (!appUser || !task) {
        return null;
    }
    
    const project = projects.find(p => p.id === task.project_id);
    const isFlowTask = !project;
    const subtasks = allTasks.filter(t => t.parentId === task.id);
    
    const totalTimeTracked = timeEntries.reduce((acc, entry) => acc + entry.duration, 0);
    
    const handleCreateTask = async () => {
        if (!task || !appUser) return;
        
        if (!task.name.trim()) {
            toast({ variant: 'destructive', title: "Task name is required" });
            return;
        }

        // @ts-ignore - isNew is a temp property
        const { id, isNew, ...taskData } = task; 

        const newTaskData = {
            ...taskData,
            createdAt: new Date().toISOString(),
            createdBy: appUser.id,
            activities: [...(taskData.activities || [])],
        };
        
        const createdTask = await onAddTask(newTaskData, id);
        if (createdTask) {
            toast({ title: "Task Created" });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: "Failed to create task" });
        }
    };


    const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement | HTMLInputElement;
        const commentText = commentInput.value;

        if (!commentText.trim() && attachments.length === 0) return;

        const newAttachments: Attachment[] = attachments.map(file => ({
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'file',
        }))

        const newComment: Comment = {
            id: `comment-${Date.now()}`,
            user_id: appUser.id,
            comment: commentText,
            timestamp: new Date().toISOString(),
            attachments: newAttachments,
        };
        const newActivity: Activity = {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            user_id: appUser.id,
            timestamp: new Date().toISOString(),
            type: 'comment',
            comment_id: newComment.id,
            comment: newComment.comment,
        }
        
        const updatedTask = { 
            ...task, 
            comments: [...(task.comments || []), newComment],
            activities: [...(task.activities || []), newActivity],
        };
        onUpdateTask(updatedTask);
        form.reset();
        setAttachments([]);
    };

    const handleFieldChange = (field: keyof Task, value: any) => {
        if (!task) return;

        if (isCreating) {
            setTask(prev => prev ? { ...prev, [field]: value } : null);
            return;
        }

        let newActivity: Activity | undefined = undefined;
        if (field === 'status' && task.status !== value) {
            newActivity = {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                user_id: appUser.id,
                timestamp: new Date().toISOString(),
                type: 'status_change',
                from: task.status,
                to: value,
            };
        }

        if (field === 'assigned_to' && task.assigned_to !== value) {
            const fromUser = allUsers.find(u => u.id === task.assigned_to)?.name || 'Unassigned';
            const toUser = allUsers.find(u => u.id === value)?.name || 'Unassigned';
            newActivity = {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                user_id: appUser.id,
                timestamp: new Date().toISOString(),
                type: 'assignee_change',
                from: fromUser,
                to: toUser,
            };
        }
        
        const updatedTask = {
             ...task,
             [field]: value,
             ...(newActivity ? { activities: [...(task.activities || []), newActivity] } : {})
        };
        onUpdateTask(updatedTask);
    }

     const handleAddTag = () => {
        if (newTag && !task.tags.includes(newTag)) {
            handleFieldChange('tags', [...(task.tags || []), newTag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        handleFieldChange('tags', (task.tags || []).filter(tag => tag !== tagToRemove));
    };
    
    const handleAddSubtask = async () => {
        if (!newSubtaskName.trim() || !appUser) return;
    
        const now = new Date().toISOString();
        const creationActivity: Activity = {
            id: `act-creation-${Date.now()}`,
            user_id: appUser.id,
            timestamp: now,
            type: 'task_creation',
        };

        const tempId = `temp-${Date.now()}`;
        const newSubtaskData: Omit<Task, 'id'> = {
            project_id: task.project_id,
            hubId: task.hubId,
            spaceId: task.spaceId,
            name: newSubtaskName.trim(),
            description: '',
            status: 'Backlog',
            createdBy: appUser.id,
            createdAt: now,
            assigned_to: newSubtaskAssignee || appUser.id,
            due_date: newSubtaskDueDate ? newSubtaskDueDate.toISOString() : new Date().toISOString(),
            priority: null,
            sprint_points: null,
            tags: [],
            time_estimate: null,
            relationships: [],
            activities: [creationActivity],
            comments: [],
            attachments: [],
            parentId: task.id,
        };
    
        setNewSubtaskName('');
        setNewSubtaskAssignee(appUser.id);
        setNewSubtaskDueDate(null);

        await onAddTask(newSubtaskData, tempId);
    };


    const handleUpdateSubtaskStatus = (subtask: Task, checked: boolean) => {
        const newStatus = checked ? 'Done' : 'Backlog';
        const updatedSubtask = { ...subtask, status: newStatus };
        onUpdateTask(updatedSubtask);

        if (newStatus === 'Done') {
            const newActivity: Activity = {
                id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                user_id: appUser.id,
                timestamp: new Date().toISOString(),
                type: 'subtask_completion',
                subtask_name: subtask.name,
            }
            const updatedParentTask = {
                ...task,
                activities: [...(task.activities || []), newActivity]
            };
            onUpdateTask(updatedParentTask);
        }
    }
    
    const handleRemoveSubtask = async (subtaskId: string) => {
        onRemoveTask(subtaskId);
    }
    
    const sortedActivities = [
        ...(task.activities || []), 
        ...(timeEntries || []).map(t => ({
            id: `time-${t.id}`,
            user_id: t.user_id,
            timestamp: t.end_time,
            type: 'comment',
            comment_id: `time-${t.id}`,
            comment: `Logged ${formatDuration(t.duration)}. ${t.notes ? `Notes: ${t.notes}` : ''}`
        } as Activity)),
    ].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
          setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const assignee = allUsers.find(u=>u.id === task.assigned_to);
    
    const parsedEstTimeSuggestion = parseDuration(estTime);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className={cn(
                    "max-w-4xl h-[90vh] flex flex-col p-0 gap-0",
                    isMobile && "h-screen w-screen max-w-full"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        {isCreating ? 'Create New Task' : 'Task Details'}
                        {!isCreating && task.taskKey && (
                            <span className="font-mono text-lg font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{task.taskKey}</span>
                        )}
                    </DialogTitle>
                     {!isCreating && <DialogDescription>Created by {allUsers.find(u => u.id === task.createdBy)?.name || 'Unknown'}</DialogDescription>}
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-x-12 p-6 overflow-hidden">
                    {/* LEFT COLUMN */}
                    <ScrollArea className="h-full pr-6 -mr-6">
                        <div className="space-y-6">
                            <Input
                                value={task.name}
                                onChange={e => setTask(t => t ? { ...t, name: e.target.value } : null)}
                                onBlur={() => { if (!isCreating) onUpdateTask(task); }}
                                placeholder="What needs to be done?"
                                className="text-2xl font-bold border-none focus-visible:ring-0 p-0 h-auto"
                            />
                            
                            <div className={cn("space-y-4")}>
                            {project && (
                                <DetailRow icon={Folder} label="Project">
                                    <Select value={task.project_id || ''} onValueChange={(value) => handleFieldChange('project_id', value)}>
                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </DetailRow>
                            )}
                            <DetailRow icon={CircleDot} label="Status">
                                <Select value={task.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                                </Select>
                            </DetailRow>
                            <DetailRow icon={Users} label="Assignees">
                                <Select value={task.assigned_to} onValueChange={(value) => handleFieldChange('assigned_to', value)}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue>
                                            {assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback>{getInitials(assignee.name)}</AvatarFallback></Avatar>
                                                    {assignee.name}
                                                </div>
                                            ) : 'Select user'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                                    {user.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </DetailRow>
                            <DetailRow icon={Calendar} label="Due Date">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("h-8 w-full justify-start text-left font-normal", !task.due_date && "text-muted-foreground")}>
                                            {task.due_date ? format(parseISO(task.due_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarPicker
                                            mode="single"
                                            selected={parseISO(task.due_date)}
                                            onSelect={(date) => handleFieldChange('due_date', date?.toISOString())}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </DetailRow>
                            <DetailRow icon={Flag} label="Priority">
                                <Select value={task.priority || ''} onValueChange={(value) => handleFieldChange('priority', value)}>
                                    <SelectTrigger className="h-8"><SelectValue placeholder="Set priority" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </DetailRow>
                            <DetailRow icon={Clock} label="Time Est.">
                                    <Input
                                        className="h-8"
                                        value={estTime}
                                        onChange={(e) => {
                                            setEstTime(e.target.value);
                                            setShowEstTimeSuggestion(true);
                                        }}
                                        onBlur={() => {
                                            const parsed = parseDuration(estTime);
                                            setEstTime(formatDuration(parsed));
                                            handleFieldChange('time_estimate', parsed);
                                            setShowEstTimeSuggestion(false);
                                        }}
                                    />
                                </DetailRow>

                                <DetailRow icon={Clock} label="Time Logged">
                                    <div className="flex items-center justify-between h-8">
                                        <span className="text-sm">{formatDuration(totalTimeTracked)}</span>
                                        <Button variant="outline" size="sm" onClick={() => setIsLogTimeOpen(true)}>Log Time</Button>
                                    </div>
                                </DetailRow>

                                <DetailRow icon={Tag} label="Tags">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-1">
                                            {(task.tags || []).map(tag => (
                                                <Badge key={tag} variant="secondary">
                                                    {tag}
                                                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 rounded-full hover:bg-destructive/20 p-0.5">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-8"
                                                placeholder="Add a tag..."
                                                value={newTag}
                                                onChange={e => setNewTag(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                            />
                                            <Button variant="outline" size="sm" onClick={handleAddTag}>Add</Button>
                                        </div>
                                    </div>
                                </DetailRow>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                                <Textarea
                                    value={task.description || ''}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    placeholder="Add a more detailed description..."
                                    className="prose prose-sm dark:prose-invert max-w-none w-full min-h-[80px] p-2 border rounded-md"
                                />
                            </div>

                            {!isCreating && (
                            <>
                                <Separator />
                                
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-sm text-muted-foreground">Subtasks ({subtasks.length})</h3>
                                    <div className="space-y-2">
                                        {subtasks.map(st => (
                                            <div key={st.id} className="flex items-center gap-2 group">
                                                <Checkbox 
                                                    id={`subtask-${st.id}`} 
                                                    checked={st.status === 'Done'}
                                                    onCheckedChange={(checked) => handleUpdateSubtaskStatus(st, !!checked)}
                                                />
                                                <label htmlFor={`subtask-${st.id}`} className={cn("flex-1 text-sm", st.status === 'Done' && 'line-through text-muted-foreground')}>{st.name}</label>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSubtask(st.id)}>
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={(e) => { e.preventDefault(); handleAddSubtask(); }} className="flex gap-2 mt-2">
                                        <Input value={newSubtaskName} onChange={(e) => setNewSubtaskName(e.target.value)} placeholder="Add a subtask..." className="h-8" />
                                        <Button variant="outline" size="sm" type="submit">Add</Button>
                                    </form>
                                </div>
                            </>
                            )}
                        </div>
                    </ScrollArea>
                    
                    {/* RIGHT COLUMN */}
                    <div className="mt-6 lg:mt-0 flex flex-col h-full overflow-hidden">
                        {!isCreating && (
                            <>
                                <h3 className="font-semibold mb-4 shrink-0">Activity</h3>
                                <ScrollArea className="flex-1 -mr-6">
                                    <div className="space-y-4 pr-6">
                                        {sortedActivities.map((activity) => {
                                        if (activity.type === 'comment' && activity.comment_id) {
                                            const user = allUsers.find(u => u.id === activity.user_id);
                                            const isTimeLog = activity.comment_id.startsWith('time-');
                                            const comment = isTimeLog ? null : (task.comments || []).find(c => c.id === activity.comment_id);
                                            
                                            if (!user || (!isTimeLog && !comment)) return null;

                                            return (
                                                <div key={activity.id} className="flex items-start gap-3">
                                                <Avatar className="h-6 w-6 mt-1">
                                                    <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                                                    <AvatarFallback>{user ? getInitials(user.name) : 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div className="text-sm flex-1">
                                                        <div className="flex justify-between">
                                                            <div>
                                                                <span className="font-semibold">{user?.name}</span>
                                                                <span className="text-xs text-muted-foreground ml-2">{new Date(activity.timestamp).toLocaleString()}</span>
                                                            </div>
                                                            {!isTimeLog && <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button>}
                                                        </div>
                                                    
                                                        <p className={cn("mt-1", isTimeLog && 'italic text-muted-foreground')}>{isTimeLog ? activity.comment : comment?.comment}</p>
                                                        
                                                        {!isTimeLog && comment?.attachments && comment.attachments.length > 0 && (
                                                            <div className="mt-2 space-y-2">
                                                            {comment.attachments.map(att => (
                                                                <div key={att.id}>
                                                                    {att.type === 'image' ? (
                                                                        <img src={att.url} alt={att.name} className="rounded-lg max-w-xs max-h-64 object-cover" />
                                                                    ) : (
                                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline bg-primary/10 p-2 rounded-md max-w-xs">
                                                                            <File className="h-4 w-4" />
                                                                            <span className="truncate">{att.name}</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            </div>
                                                        )}
                                                </div>
                                                </div>
                                            )
                                        }
                                        return <ActivityItem key={activity.id} activity={activity} allUsers={allUsers} />;
                                        })}
                                    </div>
                                </ScrollArea>
                                
                                {!isMobile && (
                                    <form onSubmit={handleAddComment} className="relative mt-4 shrink-0">
                                        <div className="border rounded-lg">
                                            <Textarea 
                                                name="comment" 
                                                placeholder="Ask a question or post an update..."
                                                minRows={3}
                                                className="border-0 focus-visible:ring-0"
                                            />
                                            <div className="p-2 border-t flex justify-between items-center">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileSelect}
                                                    />
                                                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                                                        <Paperclip className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <Button type="submit">Comment</Button>
                                            </div>
                                        </div>
                                        {attachments.length > 0 && (
                                            <div className="mt-2 space-y-2">
                                                {attachments.map((file, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded-md">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 flex-shrink-0" /> : <File className="h-4 w-4 flex-shrink-0" />}
                                                        <span className="truncate">{file.name}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}
                                                    >
                                                    &times;
                                                    </Button>
                                                </div>
                                                ))}
                                            </div>
                                        )}
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>

                 {isCreating ? (
                    <DialogFooter className="p-6 pt-4 border-t shrink-0">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleCreateTask}>Create Task</Button>
                    </DialogFooter>
                ) : isMobile && (
                    <div className="p-2 border-t bg-card shrink-0">
                        {attachments.length > 0 && (
                            <div className="mb-2 space-y-1">
                                {attachments.map((file, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded-md">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        {file.type.startsWith("image/") ? <ImageIcon className="h-4 w-4 flex-shrink-0" /> : <File className="h-4 w-4 flex-shrink-0" />}
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                ))}
                            </div>
                        )}
                        <form onSubmit={handleAddComment} className="relative flex items-center gap-2">
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <Textarea 
                                name="comment" 
                                placeholder="Ask a question or post an update..." 
                                className="pr-10"
                                minRows={1}
                            />
                            <div className="flex flex-col">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                                <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
                 {isLogTimeOpen && (
                    <LogTimeDialog
                        isOpen={isLogTimeOpen}
                        onOpenChange={setIsLogTimeOpen}
                        task={task}
                        allUsers={allUsers}
                        appUser={appUser}
                        onLogTime={onLogTime}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
