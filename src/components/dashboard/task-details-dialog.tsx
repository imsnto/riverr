
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
import { cn, getInitials } from '@/lib/utils';
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

const formatDuration = (hours: number | null) => {
    if (hours === null || hours === undefined || hours === 0) return '';
    const totalMinutes = Math.round(hours * 60);
    if (totalMinutes < 1) return `< 1 min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} hr`);
    if (m > 0) parts.push(`${m} min`);
    return parts.join(' ');
};

const parseDuration = (durationStr: string): number => {
    if (!durationStr) return 0;
    let totalHours = 0;
    const duration = durationStr.toLowerCase().trim();
    const matches = duration.match(/(\d*\.?\d+)\s*(h|m)?/g) || [];
    if (matches.length === 0 && !isNaN(parseFloat(duration))) return parseFloat(duration);
    matches.forEach(match => {
        const parts = match.match(/(\d*\.?\d+)\s*(h|m)?/);
        if (parts) {
            const value = parseFloat(parts[1]);
            const unit = parts[2];
            if (unit === 'h') totalHours += value;
            else if (unit === 'm') totalHours += value / 60;
            else if (!unit) totalHours += matches.length === 1 ? value : value / 60;
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
                return (<div><span className="font-semibold">{user?.name || 'Unknown'}</span> created this task.</div>);
            case 'status_change':
                return (<div><span className="font-semibold">{user?.name}</span> changed status from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></div>);
            case 'assignee_change':
                const fromUser = allUsers.find(u => u.name === activity.from)?.name || activity.from || 'Unassigned';
                const toUser = allUsers.find(u => u.name === activity.to)?.name || activity.to || 'Unassigned';
                return (<div><span className="font-semibold">{user?.name}</span> changed assignee from <Badge variant="outline">{fromUser}</Badge> to <Badge variant="outline">{toUser}</Badge></div>);
            case 'comment':
                return (
                    <div>
                        <p><span className="font-semibold">{user?.name}</span> left a comment.</p>
                        {activity.comment && <div className="text-muted-foreground text-xs p-2 border rounded-md mt-1">{activity.comment}</div>}
                    </div>
                );
            case 'subtask_completion':
                return (<div><span className="font-semibold">{user?.name}</span> marked subtask <Badge variant="outline">{activity.subtask_name}</Badge> as complete.</div>);
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
    const isMobile = useIsMobile();
    const [task, setTask] = useState(initialTask);
    const [mobileTab, setMobileTab] = useState<'details' | 'activity'>('details');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [newTag, setNewTag] = useState('');
    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string | null>(null);
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | null>(null);
    const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);
    const [estTime, setEstTime] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isCreating = initialTask?.id.startsWith('new-task-');

    useEffect(() => {
        setTask(initialTask);
        if (initialTask) {
            setEstTime(formatDuration(initialTask.time_estimate));
            if (appUser && isCreating) {
                if (!initialTask.assigned_to) setTask(t => t ? { ...t, assigned_to: appUser.id } : t);
                if (!initialTask.createdBy) setTask(t => t ? { ...t, createdBy: appUser.id } : t);
            }
        }
    }, [initialTask, appUser, isCreating]);

    if (!appUser || !task) return null;
    
    const project = projects.find(p => p.id === task.project_id);
    const subtasks = allTasks.filter(t => t.parentId === task.id);
    const totalTimeTracked = timeEntries.reduce((acc, entry) => acc + entry.duration, 0);
    
    const handleCreateTask = async () => {
        if (!task || !appUser) return;
        if (!task.name.trim()) {
            toast({ variant: 'destructive', title: "Task name is required" });
            return;
        }
        // @ts-ignore
        const { id, isNew, ...taskData } = task; 
        const newTaskData = { ...taskData, createdAt: new Date().toISOString(), createdBy: appUser.id };
        const createdTask = await onAddTask(newTaskData, id);
        if (createdTask) {
            toast({ title: "Task Created" });
            onOpenChange(false);
        }
    };

    const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement;
        const commentText = commentInput.value;
        if (!commentText.trim() && attachments.length === 0) return;
        const newAttachments: Attachment[] = attachments.map(file => ({
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'file',
        }));
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
        };
        onUpdateTask({ ...task, comments: [...(task.comments || []), newComment], activities: [...(task.activities || []), newActivity] });
        form.reset();
        setAttachments([]);
    };

    const handleFieldChange = (field: keyof Task, value: any) => {
        if (!task) return;
        if (isCreating) {
            setTask(prev => prev ? { ...prev, [field]: value } : null);
            return;
        }
        let newActivity: Activity | undefined;
        if (field === 'status' && task.status !== value) {
            newActivity = { id: `act-${Date.now()}`, user_id: appUser.id, timestamp: new Date().toISOString(), type: 'status_change', from: task.status, to: value };
        }
        if (field === 'assigned_to' && task.assigned_to !== value) {
            const fromUser = allUsers.find(u => u.id === task.assigned_to)?.name || 'Unassigned';
            const toUser = allUsers.find(u => u.id === value)?.name || 'Unassigned';
            newActivity = { id: `act-${Date.now()}`, user_id: appUser.id, timestamp: new Date().toISOString(), type: 'assignee_change', from: fromUser, to: toUser };
        }
        onUpdateTask({ ...task, [field]: value, ...(newActivity ? { activities: [...(task.activities || []), newActivity] } : {}) });
    };

    const handleAddSubtask = async () => {
        if (!newSubtaskName.trim() || !appUser) return;
        const now = new Date().toISOString();
        const creationActivity: Activity = { id: `act-creation-${Date.now()}`, user_id: appUser.id, timestamp: now, type: 'task_creation' };
        const newSubtaskData: Omit<Task, 'id'> = {
            project_id: task.project_id, hubId: task.hubId, spaceId: task.spaceId,
            name: newSubtaskName.trim(), description: '', status: 'Backlog',
            createdBy: appUser.id, createdAt: now, assigned_to: newSubtaskAssignee || appUser.id,
            due_date: newSubtaskDueDate ? newSubtaskDueDate.toISOString() : new Date().toISOString(),
            priority: null, sprint_points: null, tags: [], time_estimate: null, relationships: [],
            activities: [creationActivity], comments: [], attachments: [], parentId: task.id,
        };
        setNewSubtaskName('');
        await onAddTask(newSubtaskData, `temp-${Date.now()}`);
    };

    const handleUpdateSubtaskStatus = (subtask: Task, checked: boolean) => {
        const newStatus = checked ? 'Done' : 'Backlog';
        onUpdateTask({ ...subtask, status: newStatus });
        if (newStatus === 'Done') {
            const newActivity: Activity = { id: `act-${Date.now()}`, user_id: appUser.id, timestamp: new Date().toISOString(), type: 'subtask_completion', subtask_name: subtask.name };
            onUpdateTask({ ...task, activities: [...(task.activities || []), newActivity] });
        }
    };

    const sortedActivities = [
        ...(task.activities || []), 
        ...(timeEntries || []).map(t => ({
            id: `time-${t.id}`, user_id: t.user_id, timestamp: t.end_time, type: 'comment',
            comment_id: `time-${t.id}`, comment: `Logged ${formatDuration(t.duration)}. ${t.notes ? `Notes: ${t.notes}` : ''}`
        } as Activity)),
    ].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const assignee = allUsers.find(u=>u.id === task.assigned_to);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden", isMobile && "h-screen w-screen max-w-full")} onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="flex items-center gap-2">
                            {isCreating ? 'Create New Task' : 'Task Details'}
                            {!isCreating && task.taskKey && (
                                <span className="font-mono text-lg font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{task.taskKey}</span>
                            )}
                        </DialogTitle>
                        {!isCreating && <DialogDescription>Created by {allUsers.find(u => u.id === task.createdBy)?.name || 'Unknown'}</DialogDescription>}
                    </div>
                    {isMobile && !isCreating && (
                        <div className="mt-3 inline-flex w-full rounded-lg bg-muted p-1">
                            <button type="button" onClick={() => setMobileTab("details")} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition", mobileTab === "details" ? "bg-background shadow" : "text-muted-foreground")}>Details</button>
                            <button type="button" onClick={() => setMobileTab("activity")} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition", mobileTab === "activity" ? "bg-background shadow" : "text-muted-foreground")}>Activity</button>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-0">
                    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-x-12 p-6 overflow-hidden">
                        {/* LEFT COLUMN (Details) */}
                        <div className={cn("min-h-0", isMobile && mobileTab !== "details" && "hidden")}>
                            <ScrollArea className="h-full pr-6 -mr-6">
                                <div className="space-y-6">
                                    <Input value={task.name} onChange={e => setTask(t => t ? { ...t, name: e.target.value } : null)} onBlur={() => { if (!isCreating) onUpdateTask(task); }} placeholder="What needs to be done?" className="text-2xl font-bold border-none focus-visible:ring-0 p-0 h-auto" />
                                    <div className="space-y-4">
                                        {project && (
                                            <DetailRow icon={Folder} label="Project">
                                                <Select value={task.project_id || ''} onValueChange={(v) => handleFieldChange('project_id', v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                            </DetailRow>
                                        )}
                                        <DetailRow icon={CircleDot} label="Status">
                                            <Select value={task.status} onValueChange={(v) => handleFieldChange('status', v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                                        </DetailRow>
                                        <DetailRow icon={Users} label="Assignees">
                                            <Select value={task.assigned_to || ''} onValueChange={(v) => handleFieldChange('assigned_to', v)}><SelectTrigger className="h-8"><SelectValue>{assignee ? <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback>{getInitials(assignee.name)}</AvatarFallback></Avatar>{assignee.name}</div> : 'Select user'}</SelectValue></SelectTrigger><SelectContent>{allUsers.map(u => <SelectItem key={u.id} value={u.id}><div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={u.avatarUrl} /><AvatarFallback>{getInitials(u.name)}</AvatarFallback></Avatar>{u.name}</div></SelectItem>)}</SelectContent></Select>
                                        </DetailRow>
                                        <DetailRow icon={Calendar} label="Due Date">
                                            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("h-8 w-full justify-start text-left font-normal", !task.due_date && "text-muted-foreground")}>{task.due_date ? format(parseISO(task.due_date), "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><CalendarPicker mode="single" selected={task.due_date ? parseISO(task.due_date) : undefined} onSelect={(d) => handleFieldChange('due_date', d?.toISOString())} initialFocus /></PopoverContent></Popover>
                                        </DetailRow>
                                        <DetailRow icon={Flag} label="Priority">
                                            <Select value={task.priority || ''} onValueChange={(v) => handleFieldChange('priority', v)}><SelectTrigger className="h-8"><SelectValue placeholder="Set priority" /></SelectTrigger><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Urgent">Urgent</SelectItem></SelectContent></Select>
                                        </DetailRow>
                                        <DetailRow icon={Clock} label="Time Est.">
                                            <Input className="h-8" value={estTime} onChange={(e) => setEstTime(e.target.value)} onBlur={() => { const p = parseDuration(estTime); setEstTime(formatDuration(p)); handleFieldChange('time_estimate', p); }} />
                                        </DetailRow>
                                        <DetailRow icon={Clock} label="Time Logged">
                                            <div className="flex items-center justify-between h-8"><span className="text-sm">{formatDuration(totalTimeTracked)}</span><Button variant="outline" size="sm" onClick={() => setIsLogTimeOpen(true)}>Log Time</Button></div>
                                        </DetailRow>
                                        <DetailRow icon={Tag} label="Tags">
                                            <div className="space-y-2"><div className="flex flex-wrap gap-1">{(task.tags || []).map(t => <Badge key={t} variant="secondary">{t}<button onClick={() => handleRemoveTag(t)} className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"><X className="h-3 w-3" /></button></Badge>)}</div><div className="flex gap-2"><Input className="h-8" placeholder="Add a tag..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }} /><Button variant="outline" size="sm" onClick={handleAddTag}>Add</Button></div></div>
                                        </DetailRow>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                                        <Textarea value={task.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="Add a more detailed description..." className="prose prose-sm dark:prose-invert max-w-none w-full min-h-[80px] p-2 border rounded-md" />
                                    </div>
                                    {!isCreating && (
                                        <div className="space-y-2">
                                            <Separator /><h3 className="font-semibold text-sm text-muted-foreground">Subtasks ({subtasks.length})</h3>
                                            <div className="space-y-2">{subtasks.map(st => <div key={st.id} className="flex items-center gap-2 group"><Checkbox id={`st-${st.id}`} checked={st.status === 'Done'} onCheckedChange={(c) => handleUpdateSubtaskStatus(st, !!c)} /><label htmlFor={`st-${st.id}`} className={cn("flex-1 text-sm", st.status === 'Done' && 'line-through text-muted-foreground')}>{st.name}</label><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onRemoveTask(st.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>)}</div>
                                            <form onSubmit={(e) => { e.preventDefault(); handleAddSubtask(); }} className="flex gap-2 mt-2"><Input value={newSubtaskName} onChange={(e) => setNewSubtaskName(e.target.value)} placeholder="Add a subtask..." className="h-8" /><Button variant="outline" size="sm" type="submit">Add</Button></form>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* RIGHT COLUMN (Activity) */}
                        <div className={cn("mt-6 lg:mt-0 flex flex-col min-h-0 overflow-hidden", isMobile && mobileTab !== "activity" && "hidden")}>
                            {!isCreating && (
                                <>
                                    <h3 className="font-semibold mb-4 shrink-0">Activity</h3>
                                    <ScrollArea className="flex-1 min-h-0 pr-6 -mr-6">
                                        <div className="space-y-4 pr-6">
                                            {sortedActivities.map(activity => {
                                                if (activity.type === 'comment' && activity.comment_id) {
                                                    const user = allUsers.find(u => u.id === activity.user_id);
                                                    const isTimeLog = activity.comment_id.startsWith('time-');
                                                    const comment = isTimeLog ? null : (task.comments || []).find(c => c.id === activity.comment_id);
                                                    if (!user || (!isTimeLog && !comment)) return null;
                                                    return (
                                                        <div key={activity.id} className="flex items-start gap-3">
                                                            <Avatar className="h-6 w-6 mt-1"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                                            <div className="text-sm flex-1"><div className="flex justify-between"><div><span className="font-semibold">{user.name}</span><span className="text-xs text-muted-foreground ml-2">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span></div>{!isTimeLog && <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button>}</div><p className={cn("mt-1", isTimeLog && 'italic text-muted-foreground')}>{isTimeLog ? activity.comment : comment?.comment}</p></div>
                                                        </div>
                                                    );
                                                }
                                                return <ActivityItem key={activity.id} activity={activity} allUsers={allUsers} />;
                                            })}
                                        </div>
                                    </ScrollArea>
                                    {!isMobile && (
                                        <form onSubmit={handleAddComment} className="relative mt-4 shrink-0">
                                            <div className="border rounded-lg">
                                                <Textarea name="comment" placeholder="Ask a question or post an update..." minRows={3} className="border-0 focus-visible:ring-0" />
                                                <div className="p-2 border-t flex justify-between items-center">
                                                    <div className="flex items-center gap-1"><input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} /><Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button></div><Button type="submit">Comment</Button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {isCreating ? (
                    <DialogFooter className="p-6 pt-4 border-t shrink-0"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleCreateTask}>Create Task</Button></DialogFooter>
                ) : isMobile && mobileTab === "activity" && (
                    <div className="p-2 border-t bg-card shrink-0">
                        <form onSubmit={handleAddComment} className="relative flex items-center gap-2">
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                            <Textarea name="comment" placeholder="Add update..." className="pr-10" minRows={1} />
                            <div className="flex flex-col"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button><Button type="submit" variant="ghost" size="icon" className="h-8 w-8"><Send className="h-4 w-4" /></Button></div>
                        </form>
                    </div>
                )}
                {isLogTimeOpen && <LogTimeDialog isOpen={isLogTimeOpen} onOpenChange={setIsLogTimeOpen} task={task} allUsers={allUsers} appUser={appUser} onLogTime={onLogTime} />}
            </DialogContent>
        </Dialog>
    );
}
