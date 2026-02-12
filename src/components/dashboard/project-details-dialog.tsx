
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Project, Task, User } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

interface ProjectDetailsDialogProps {
    project: Project;
    tasks: Task[];
    allUsers: User[];
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function ProjectDetailsDialog({ project, tasks, allUsers, isOpen, onOpenChange }: ProjectDetailsDialogProps) {
    const projectTasks = tasks;
    const projectMembers = allUsers.filter(u => project.members.includes(u.id));
    const createdBy = allUsers.find(u => u.id === project.created_by);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-3xl">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-4">
                        {project.name}
                        <Badge>{project.status}</Badge>
                    </SheetTitle>
                    <SheetDescription>
                        Created by {createdBy?.name || 'Unknown'}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid md:grid-cols-3 gap-6 py-4">
                    <div className="md:col-span-2">
                        <h3 className="font-semibold mb-2">Tasks ({projectTasks.length})</h3>
                        <ScrollArea className="h-72 rounded-md border">
                            <div className="p-4 space-y-3">
                                {projectTasks.length > 0 ? projectTasks.map(task => {
                                    const assignee = allUsers.find(u => u.id === task.assigned_to);
                                    return (
                                        <div key={task.id} className="p-3 rounded-md border bg-card/50">
                                            <div className="flex justify-between items-start">
                                                <p className="font-medium text-sm">{task.name}</p>
                                                <Badge variant={task.status === 'Done' ? 'default' : 'secondary'}>{task.status}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                {assignee && (
                                                    <>
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                                                            <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{assignee.name}</span>
                                                    </>
                                                )}
                                                <span>· Due {new Date(task.due_date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )
                                }) : <p className="text-sm text-muted-foreground text-center py-8">No tasks for this project yet.</p>}
                            </div>
                        </ScrollArea>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Members ({projectMembers.length})</h3>
                        <div className="space-y-3">
                            {projectMembers.map(member => (
                                <div key={member.id} className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
