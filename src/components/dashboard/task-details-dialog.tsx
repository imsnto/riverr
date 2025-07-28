
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Task, users, projects, Comment } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

interface TaskDetailsDialogProps {
    task: Task;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateTask: (task: Task) => void;
}

export default function TaskDetailsDialog({ task, isOpen, onOpenChange, onUpdateTask }: TaskDetailsDialogProps) {
    const assignee = users.find(u => u.id === task.assigned_to);
    const project = projects.find(p => p.id === task.project_id);

    const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement;
        const newComment: Comment = {
            user_id: 'user-1', // Assuming current user is adding comment
            comment: commentInput.value,
            timestamp: new Date().toISOString(),
        };
        const updatedTask = { ...task, comments: [...task.comments, newComment] };
        onUpdateTask(updatedTask);
        form.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{task.name}</DialogTitle>
                    <DialogDescription>
                        in <Badge variant="outline">{project?.name}</Badge>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Status</Label>
                        <div className="col-span-3">
                            <Badge>{task.status}</Badge>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Assignee</Label>
                        <div className="col-span-3 flex items-center gap-2">
                           {assignee && <>
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                                    <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
                                </Avatar>
                                <span>{assignee.name}</span>
                           </>}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Due Date</Label>
                        <div className="col-span-3">
                            {new Date(task.due_date).toLocaleDateString()}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Description</Label>
                        <p className="col-span-3 text-sm text-muted-foreground">{task.description}</p>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Comments</Label>
                        <div className="col-span-3 space-y-4">
                            {task.comments.map((comment, index) => {
                                const commentUser = users.find(u => u.id === comment.user_id);
                                return (
                                    <div key={index} className="flex items-start gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={commentUser?.avatarUrl} alt={commentUser?.name} />
                                            <AvatarFallback>{commentUser ? getInitials(commentUser.name) : 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium text-sm">{commentUser?.name}</p>
                                            <p className="text-sm text-muted-foreground">{comment.comment}</p>
                                        </div>
                                    </div>
                                );
                            })}
                             <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                                <Textarea name="comment" placeholder="Add a comment..." required />
                                <Button type="submit" size="sm" className="self-end">Post Comment</Button>
                            </form>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
