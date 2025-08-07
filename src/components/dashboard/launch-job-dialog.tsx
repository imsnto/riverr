
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { JobFlowTemplate, User, Space, Project, Job } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { launchJob as dbLaunchJob } from '@/lib/db';
import { getProjectsInSpace } from '@/lib/db';

interface LaunchJobDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template: JobFlowTemplate;
  allUsers: User[];
  activeSpace: Space;
  onJobLaunched: () => void;
}

export default function LaunchJobDialog({ isOpen, onOpenChange, template, allUsers, activeSpace, onJobLaunched }: LaunchJobDialogProps) {
    const { toast } = useToast();
    const { appUser } = useAuth();
   
    const uniqueAssigneeIds = useMemo(() => {
        const ids = new Set<string>();
        template.phases.forEach(phase => {
            phase.tasks.forEach(task => {
                ids.add(task.defaultAssigneeId);
                if (task.subtaskTemplates) {
                    task.subtaskTemplates.forEach(subtask => {
                        ids.add(subtask.defaultAssigneeId);
                    });
                }
            });
        });
        return Array.from(ids);
    }, [template]);
    
    const defaultRoleUserMapping = useMemo(() => {
        return uniqueAssigneeIds.reduce((acc, id) => {
            acc[id] = id; // Default to self-assignment if possible
            return acc;
        }, {} as Record<string, string>);
    }, [uniqueAssigneeIds]);

    const launchJobSchema = z.object({
        name: z.string().min(1, 'Job name is required'),
        roleUserMapping: z.record(z.string()),
    });

    type LaunchJobFormValues = z.infer<typeof launchJobSchema>;

    const form = useForm<LaunchJobFormValues>({
        resolver: zodResolver(launchJobSchema),
        defaultValues: {
            name: '',
            roleUserMapping: defaultRoleUserMapping,
        },
    });

    useEffect(() => {
        if (isOpen) {
            form.reset({
                name: '',
                roleUserMapping: defaultRoleUserMapping,
            });
        }
    }, [isOpen, form, defaultRoleUserMapping]);


    const onSubmit = async (values: LaunchJobFormValues) => {
        if (!appUser) return;
        try {
            await dbLaunchJob(values.name, template, values.roleUserMapping, appUser.id, activeSpace.id);
            toast({
                title: "Job Launched! 🚀",
                description: `The job "${values.name}" has started, and the first task has been created.`,
            });
            onJobLaunched();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: "Failed to Launch Job",
                description: "There was an error starting the job. Please try again.",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Launch Job: {template.name}</DialogTitle>
                    <DialogDescription>
                        Configure and start a new job based on this template.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Job Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Onboard NewCo" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div>
                            <FormLabel>Map Users to Roles</FormLabel>
                            <div className="space-y-4 mt-2 rounded-lg border p-4">
                                {uniqueAssigneeIds.map(assigneeId => {
                                    const defaultUser = allUsers.find(u => u.id === assigneeId);
                                    return (
                                        <div key={assigneeId}>
                                            <FormField
                                                control={form.control}
                                                name={`roleUserMapping.${assigneeId}`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-normal text-muted-foreground">
                                                            Assign user for default role: <span className="font-semibold text-foreground">{defaultUser?.name || 'Unknown User'}</span>
                                                        </FormLabel>
                                                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select a user" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {allUsers.map(user => (
                                                                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit">Launch Job</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
