

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Task, Comment, Activity, User, Project, Attachment, TimeEntry } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bot, Calendar, CircleDot, Clock, Flag, Search, Tag, Users, Zap, Link as LinkIcon, ArrowRight, Paperclip, File, Image as ImageIcon, Plus, Trash2, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarPicker } from '../ui/calendar';
import { format, parseISO } from 'date-fns';
import { Checkbox } from '../ui/checkbox';
import { addTask as dbAddTask } from '@/lib/db';
import LogTimeDialog from './log-time-dialog';


const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

const formatDuration = (hours: number | null) => {
    if (hours === null || hours === undefined || hours === 0) return '0h';
    
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

    // Regex to capture numbers and units (h, m)
    const matches = duration.match(/(\d*\.?\d+)\s*(h|m)?/g) || [];

    if (matches.length === 0 && !isNaN(parseFloat(duration))) {
        // Handle case where only a number is entered (e.g., "2.5")
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
    <div className={cn("grid grid-cols-[8rem_1fr] items-start gap-4", className)}>
        <div className="col-span-1 flex items-center gap-2 text-muted-foreground pt-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="col-span-1">{children}</div>
    </div>
);


const ActivityItem = ({ activity, allUsers }: { activity: Activity; allUsers: User[] }) => {
    const user = allUsers.find(u => u.id === activity.user_id);
    const renderContent = () => {
        switch (activity.type) {
            case 'status_change':
                return (
                    <div><span className="font-semibold">{user?.name}</span> changed status from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></div>
                );
            case 'comment':
                 const comment = activity.comment;
                return (
                    <div>
                        <p><span className="font-semibold">{user?.name}</span> left a comment.</p>
                        {comment && <div className="text-muted-foreground text-xs p-2 border rounded-md mt-1">{comment}</div>}
                    </div>
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
    onUpdateTask: (task: Task, tempId?: string) => void;
    onAddTask: (task: Task) => void;
    onRemoveTask: (taskId: string) => void;
    onTaskSelect: (task: Task) => void;
    onLogTime: (timeData: Omit<TimeEntry, 'id'>) => void;
    statuses: string[];
    allUsers: User[];
    allTasks: Task[];
    projects: Project[];
}

export default function TaskDetailsDialog({ task, timeEntries = [], isOpen, onOpenChange, onUpdateTask, onAddTask, onRemoveTask, onTaskSelect, onLogTime, statuses, allUsers, allTasks, projects }: TaskDetailsDialogProps) {
    const { toast } = useToast();
    const { appUser } = useAuth();
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newTag, setNewTag] = useState('');
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);

    const [estTime, setEstTime] = useState<string>(formatDuration(task?.time_estimate || null));
    const [showEstTimeSuggestion, setShowEstTimeSuggestion] = useState(false);
    
    useEffect(() => {
        if (task) {
            setEstTime(formatDuration(task.time_estimate));
        }
    }, [task]);


    if (!appUser || !task) {
        return null;
    }
    
    const project = projects.find(p => p.id === task.project_id);
    const subtasks = allTasks.filter(t => t.parentId === task.id);
    
    const totalTimeTracked = timeEntries.reduce((acc, entry) => acc + entry.duration, 0);

    const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement;
        const commentText = commentInput.value;

        if (!commentText.trim() && attachments.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Empty Comment',
                description: 'Please write a comment or add an attachment.',
            });
            return;
        }

        const newAttachments: Attachment[] = attachments.map(file => ({
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            url: URL.createObjectURL(file), // In a real app, this would be an upload URL
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
            id: `act-${Date.now()}`,
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
        let newActivity: Activity | undefined = undefined;
        if (field === 'status' && task.status !== value) {
            newActivity = {
                id: `act-${Date.now()}`,
                user_id: appUser.id,
                timestamp: new Date().toISOString(),
                type: 'status_change',
                from: task.status,
                to: value,
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
    
      const tempId = `temp-${Date.now()}`;
      const optimisticSubtask: Task = {
        id: tempId,
        project_id: task.project_id,
        name: newSubtaskName.trim(),
        description: '',
        status: 'Backlog',
        assigned_to: appUser.id,
        due_date: new Date().toISOString(),
        priority: null,
        sprint_points: null,
        tags: [],
        time_estimate: null,
        relationships: [],
        activities: [],
        comments: [],
        attachments: [],
        parentId: task.id,
      };
    
      // 1. Optimistically add to UI
      onAddTask(optimisticSubtask);
      setNewSubtaskName('');
    
      try {
        // 2. Strip ID before saving to Firestore
        const { id: _omit, ...taskWithoutId } = optimisticSubtask;
        const savedTask = await dbAddTask(taskWithoutId);
    
        // 3. Patch UI with real ID
        onUpdateTask(savedTask, tempId);
    
      } catch (error) {
        // 4. Show toast
        toast({
          variant: 'destructive',
          title: 'Failed to create subtask',
          description: (error as Error).message,
        });
    
        // 5. Remove temp task from UI
        onRemoveTask(tempId);
      }
    };

    const handleUpdateSubtaskStatus = (subtask: Task, checked: boolean) => {
         const updatedSubtask = { ...subtask, status: checked ? 'Done' : 'Backlog' };
         onUpdateTask(updatedSubtask);
    }
    
    const handleRemoveSubtask = (subtaskId: string) => {
        onRemoveTask(subtaskId);
    }
    
    const sortedActivities = [...(task.activities || []), ...(timeEntries || []).map(t => ({
        id: t.id,
        user_id: t.user_id,
        timestamp: t.end_time,
        type: 'comment', // Treat as comment for display
        comment: `Logged ${formatDuration(t.duration)}. ${t.notes ? `Notes: ${t.notes}` : ''}`
    } as Activity))].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
          setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const assignee = allUsers.find(u=>u.id === task.assigned_to);
    
    const parsedEstTimeSuggestion = parseDuration(estTime);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                   <DialogTitle className="sr-only">Task Details: {task?.name}</DialogTitle>
                </DialogHeader>
                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
                    {/* Left Panel: Task Details */}
                    <ScrollArea className="md:col-span-2">
                        <div className="p-6 flex flex-col gap-6">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Button variant="outline" size="sm" className="pointer-events-none">
                                    {project?.name || 'Task'}
                                </Button>
                                <span>/ {task?.id?.substring(0,6)}...</span>
                           </div>
                           <Input 
                                defaultValue={task.name}
                                onBlur={(e) => handleFieldChange('name', e.target.value)}
                                className="text-2xl font-bold h-auto p-0 border-none focus-visible:ring-0"
                            />
                            
                            {/* AI Suggestion Box */}
                           <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary-foreground">
                                <Bot className="h-5 w-5 text-primary" />
                                <p className="text-sm font-medium text-primary">Ask Brain to <a href="#" className="underline">create a summary</a> or <a href="#" className="underline">generate subtasks</a></p>
                           </div>

                            {/* Details Grid */}
                            <div className="space-y-4">
                                <DetailRow icon={CircleDot} label="Status">
                                    <Select value={task.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statuses.map(status => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </DetailRow>
                                 <DetailRow icon={Users} label="Assignees">
                                    <Select value={task.assigned_to} onValueChange={(value) => handleFieldChange('assigned_to', value)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue asChild>
                                               <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                  <AvatarImage src={assignee?.avatarUrl} />
                                                  <AvatarFallback>{getInitials(assignee?.name || '')}</AvatarFallback>
                                                </Avatar>
                                                {assignee?.name}
                                              </div>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                              <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                                                  <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                                </Avatar>
                                                {user.name}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                    </Select>
                                </DetailRow>
                                 <DetailRow icon={Calendar} label="Due Date">
                                     <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal h-8", !task.due_date && "text-muted-foreground")}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {task.due_date ? format(parseISO(task.due_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarPicker
                                                mode="single"
                                                selected={parseISO(task.due_date)}
                                                onSelect={(date) => date && handleFieldChange('due_date', date.toISOString())}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </DetailRow>
                                 <DetailRow icon={Flag} label="Priority">
                                    <Select value={task.priority || 'null'} onValueChange={(value) => handleFieldChange('priority', value === 'null' ? null : value)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Set priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="null">No Priority</SelectItem>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </DetailRow>
                                <DetailRow icon={Clock} label="Time Est.">
                                    <div className="flex flex-col gap-2">
                                        <Input 
                                            placeholder="e.g., 2h 30m" 
                                            className="h-8" 
                                            value={estTime} 
                                            onChange={(e) => {
                                                setEstTime(e.target.value);
                                                setShowEstTimeSuggestion(true);
                                            }}
                                            onBlur={() => handleFieldChange('time_estimate', parseDuration(estTime))}
                                        />
                                        {showEstTimeSuggestion && parsedEstTimeSuggestion > 0 && formatDuration(parsedEstTimeSuggestion) !== estTime && (
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                className="w-full h-8 text-xs" 
                                                onClick={() => {
                                                    const formatted = formatDuration(parsedEstTimeSuggestion);
                                                    setEstTime(formatted);
                                                    handleFieldChange('time_estimate', parseDuration(formatted));
                                                    setShowEstTimeSuggestion(false);
                                                }}
                                            >
                                                Did you mean: <span className="font-semibold mx-1">{formatDuration(parsedEstTimeSuggestion)}</span>?
                                            </Button>
                                        )}
                                    </div>
                                </DetailRow>
                                 <DetailRow icon={Clock} label="Time Logged">
                                    <div className="flex items-center gap-2">
                                        <Input readOnly value={formatDuration(totalTimeTracked)} className="h-8 font-medium bg-muted" />
                                        <Button variant="outline" size="sm" className="h-8" onClick={() => setIsLogTimeOpen(true)}>Log Time</Button>
                                    </div>
                                </DetailRow>
                                <DetailRow icon={Tag} label="Tags" className="items-start">
                                    <div className="flex flex-col gap-2">
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
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Add tag..."
                                                className="h-8"
                                                value={newTag}
                                                onChange={(e) => setNewTag(e.target.value)}
                                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                            />
                                            <Button size="sm" onClick={handleAddTag}>Add</Button>
                                        </div>
                                    </div>
                                </DetailRow>
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-lg font-semibold mb-2">Description</h3>
                                <Textarea 
                                    defaultValue={task.description}
                                    onBlur={(e) => handleFieldChange('description', e.target.value)}
                                    placeholder="Add a more detailed description..."
                                    className="min-h-[120px]"
                                />
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-lg font-semibold mb-2">Subtasks</h3>
                                 <div className="space-y-2">
                                    {subtasks.map((subtask) => {
                                        const subtaskAssignee = allUsers.find(u => u.id === subtask.assigned_to);
                                        return (
                                            <div key={subtask.id} className={cn(
                                                "flex items-center gap-2 group p-1 rounded-md hover:bg-accent/50",
                                                subtask.id.startsWith('temp-') && "opacity-50 animate-pulse"
                                            )}>
                                                <Checkbox 
                                                    id={`subtask-${subtask.id}`}
                                                    checked={subtask.status === 'Done'}
                                                    onCheckedChange={(checked) => handleUpdateSubtaskStatus(subtask, !!checked)}
                                                />
                                                <Button variant="link" className="p-0 h-auto justify-start flex-1" onClick={() => onTaskSelect(subtask)}>
                                                    <label htmlFor={`subtask-${subtask.id}`} className={cn("flex-1 cursor-pointer", subtask.status === 'Done' && 'line-through text-muted-foreground')}>
                                                        {subtask.name}
                                                    </label>
                                                </Button>
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={subtaskAssignee?.avatarUrl} />
                                                    <AvatarFallback>{getInitials(subtaskAssignee?.name || '')}</AvatarFallback>
                                                </Avatar>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSubtask(subtask.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Add a new subtask..."
                                            className="h-8"
                                            value={newSubtaskName}
                                            onChange={(e) => setNewSubtaskName(e.target.value)}
                                            onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                                        />
                                        <Button size="sm" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-1"/> Add</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Right Panel: Activity & Comments */}
                    <div className="col-span-1 border-l bg-card flex flex-col h-full">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold">Activity</h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {sortedActivities.map((activity) => {
                                    if (activity.type === 'comment' && activity.comment_id) {
                                        const comment = (task.comments || []).find(c => c.id === activity.comment_id);
                                        const user = allUsers.find(u => u.id === activity.user_id);
                                        if (!comment || !user) return null;
                                        return (
                                             <div key={activity.id} className="flex items-start gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 rounded-md border bg-background p-3">
                                                    <div className="flex justify-between items-center">
                                                        <p className="font-semibold text-sm">{user.name}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(comment.timestamp).toLocaleDateString()}</p>
                                                    </div>
                                                    {comment.comment && <p className="text-sm text-muted-foreground mt-1">{comment.comment}</p>}
                                                    {comment.attachments && comment.attachments.length > 0 && (
                                                        <div className="mt-2 space-y-2">
                                                            {comment.attachments.map(att => (
                                                                <div key={att.id}>
                                                                    {att.type === 'image' ? (
                                                                        <img src={att.url} alt={att.name} className="rounded-lg max-w-full max-h-64 object-cover" />
                                                                    ) : (
                                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline bg-primary/10 p-2 rounded-md">
                                                                            <File className="h-4 w-4" />
                                                                            <span>{att.name}</span>
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
                        <div className="p-4 border-t bg-card mt-auto">
                             {attachments.length > 0 && (
                                <div className="mb-2 space-y-2">
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
                            <form onSubmit={handleAddComment} className="relative">
                                <Textarea name="comment" placeholder="Write a comment..." className="pr-24" />
                                <div className="absolute right-2 bottom-2 flex gap-1">
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
                                    <Button type="submit" size="sm">Send</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
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
