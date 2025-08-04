
'use client';

import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Task, Comment, Activity, User, Project, Attachment } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bot, Calendar, CircleDot, Clock, Flag, Search, Tag, Users, Zap, Link as LinkIcon, ArrowRight, Paperclip, File, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

interface DetailRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
}
const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, children }) => (
    <div className="grid grid-cols-3 items-center gap-2">
        <div className="col-span-1 flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span className="text-sm">{label}</span>
        </div>
        <div className="col-span-2">{children}</div>
    </div>
);


const ActivityItem = ({ activity, allUsers }: { activity: Activity; allUsers: User[] }) => {
    const user = allUsers.find(u => u.id === activity.user_id);
    const renderContent = () => {
        switch (activity.type) {
            case 'status_change':
                return (
                    <p><span className="font-semibold">{user?.name}</span> changed status from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></p>
                );
            case 'comment':
                return (
                    <p><span className="font-semibold">{user?.name}</span> left a comment.</p>
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
    task: Task;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateTask: (task: Task) => void;
    statuses: string[];
    allUsers: User[];
    projects: Project[];
}

export default function TaskDetailsDialog({ task, isOpen, onOpenChange, onUpdateTask, statuses, allUsers, projects }: TaskDetailsDialogProps) {
    const { toast } = useToast();
    const { appUser } = useAuth();
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    if (!appUser) return null;

    const project = projects.find(p => p.id === task.project_id);
    
    // In a real app, time entries would be fetched from the DB
    const totalTimeTracked = 0; // timeEntries.filter(t => t.task_id === task.id).reduce((acc, entry) => acc + entry.duration, 0);

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
        }
        
        let updatedActivities = [...task.activities];
        if (newComment.comment || (newComment.attachments && newComment.attachments.length > 0)) {
            updatedActivities.push(newActivity);
        }

        const updatedTask = { 
            ...task, 
            comments: [...task.comments, newComment],
            activities: updatedActivities,
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
             ...(newActivity ? { activities: [...task.activities, newActivity] } : {})
        };
        onUpdateTask(updatedTask);
    }
    
    const sortedActivities = [...task.activities].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
          setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const assignee = allUsers.find(u=>u.id === task.assigned_to);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh]">
                <div className="grid grid-cols-3 h-full">
                    {/* Left Panel: Task Details */}
                    <div className="col-span-2 p-6 flex flex-col gap-6 overflow-y-auto">
                        <DialogHeader className="gap-4">
                           <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Button variant="outline" size="sm" className="pointer-events-none">
                                    <CircleDot className="mr-2" /> Task
                                </Button>
                                <span>{task.id}</span>
                                <Button variant="ghost" size="sm">
                                    <Bot className="mr-2" /> Ask AI
                                </Button>
                           </div>
                           <DialogTitle className="text-2xl">{task.name}</DialogTitle>
                           <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary-foreground">
                                <Bot className="h-5 w-5 text-primary" />
                                <p className="text-sm font-medium text-primary">Ask Brain to <a href="#" className="underline">create a summary</a> · <a href="#" className="underline">generate subtasks</a> · <a href="#" className="underline">find similar tasks</a> · <a href="#" className="underline">or ask about this task</a></p>
                           </div>
                        </DialogHeader>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
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
                            <DetailRow icon={Calendar} label="Dates">
                                <div className="flex items-center gap-2 text-sm h-8">
                                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground"/>
                                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                </div>
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
                             <DetailRow icon={Clock} label="Time Estimate">
                                <p className="text-sm h-8 flex items-center">{task.time_estimate ? `${task.time_estimate}h` : 'Empty'}</p>
                            </DetailRow>
                             <DetailRow icon={Zap} label="Sprint Points">
                                 <p className="text-sm h-8 flex items-center">{task.sprint_points ? `${task.sprint_points}` : 'Empty'}</p>
                            </DetailRow>
                            <DetailRow icon={Clock} label="Track Time">
                                <p className="text-sm font-medium h-8 flex items-center">{totalTimeTracked}h</p>
                            </DetailRow>
                             <DetailRow icon={Tag} label="Tags">
                                <p className="text-sm h-8 flex items-center">Empty</p>
                            </DetailRow>
                            <DetailRow icon={LinkIcon} label="Relationships">
                                <p className="text-sm h-8 flex items-center">Empty</p>
                            </DetailRow>
                        </div>

                        <Separator />

                        <div>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                        </div>
                    </div>

                    {/* Right Panel: Activity & Comments */}
                    <div className="col-span-1 border-l bg-card flex flex-col">
                        <div className="p-4 border-b">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">Activity</p>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                    <Users className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {sortedActivities.map(activity => {
                                    if (activity.type === 'comment' && activity.comment_id) {
                                        const comment = task.comments.find(c => c.id === activity.comment_id);
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
                        <div className="p-4 border-t bg-card">
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
            </DialogContent>
        </Dialog>
    );
}
