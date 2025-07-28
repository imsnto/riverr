
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Task, users, projects, Comment, Activity, User, timeEntries, currentUser } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bot, Calendar, CircleDot, Clock, Flag, Search, Tag, Users, Zap, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
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
}

export default function TaskDetailsDialog({ task, isOpen, onOpenChange, onUpdateTask }: TaskDetailsDialogProps) {
    const project = projects.find(p => p.id === task.project_id);
    const totalTimeTracked = timeEntries
      .filter(t => t.task_id === task.id)
      .reduce((acc, entry) => acc + entry.duration, 0);

    const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement;
        const newComment: Comment = {
            id: `comment-${Date.now()}`,
            user_id: currentUser.id,
            comment: commentInput.value,
            timestamp: new Date().toISOString(),
        };
        const newActivity: Activity = {
            id: `act-${Date.now()}`,
            user_id: currentUser.id,
            timestamp: new Date().toISOString(),
            type: 'comment',
            comment_id: newComment.id,
        }
        const updatedTask = { 
            ...task, 
            comments: [...task.comments, newComment],
            activities: [...task.activities, newActivity]
        };
        onUpdateTask(updatedTask);
        form.reset();
    };

    const handleFieldChange = (field: keyof Task, value: any) => {
        let newActivity: Activity | undefined = undefined;
        if (field === 'status') {
            newActivity = {
                id: `act-${Date.now()}`,
                user_id: currentUser.id,
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
                                        <SelectItem value="Backlog">Backlog</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Review">Review</SelectItem>
                                        <SelectItem value="Done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </DetailRow>
                             <DetailRow icon={Users} label="Assignees">
                                <Select value={task.assigned_to} onValueChange={(value) => handleFieldChange('assigned_to', value)}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue asChild>
                                           <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                              <AvatarImage src={users.find(u=>u.id === task.assigned_to)?.avatarUrl} />
                                              <AvatarFallback>{getInitials(users.find(u=>u.id === task.assigned_to)?.name || '')}</AvatarFallback>
                                            </Avatar>
                                            {users.find(u=>u.id === task.assigned_to)?.name}
                                          </div>
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {users.map(user => (
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
                                        const user = users.find(u => u.id === activity.user_id);
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
                                                    <p className="text-sm text-muted-foreground mt-1">{comment.comment}</p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return <ActivityItem key={activity.id} activity={activity} allUsers={users} />;
                                })}
                            </div>
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <form onSubmit={handleAddComment} className="relative">
                                <Textarea name="comment" placeholder="Write a comment..." required className="pr-20" />
                                <Button type="submit" size="sm" className="absolute right-2 bottom-2">Send</Button>
                            </form>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

    