
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2, Bot } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { User, Project, Message, Task } from '@/lib/data';
import { createTaskFromThread } from '@/ai/flows/create-task-from-thread';
import { useToast } from '@/hooks/use-toast';
import { addTask } from '@/lib/db';

const taskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  project_id: z.string().min(1, 'Project is required'),
  assigned_to: z.string().min(1, 'Assignee is required'),
  due_date: z.date().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface CreateTaskFromThreadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  message: Message;
  channelMembers: User[];
  projects: Project[];
  onTaskCreated: (task: Task) => void;
}

export default function CreateTaskFromThreadDialog({
  isOpen,
  onOpenChange,
  message,
  channelMembers,
  projects,
  onTaskCreated,
}: CreateTaskFromThreadDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      project_id: '',
      assigned_to: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      startTransition(async () => {
        try {
          const simplifiedMembers = channelMembers.map(m => ({ id: m.id, name: m.name }));
          const simplifiedProjects = projects.map(p => ({ id: p.id, name: p.name }));

          const result = await createTaskFromThread({
            threadContent: message.content,
            channelMembers: simplifiedMembers,
            projects: simplifiedProjects,
          });
          form.reset({
            name: result.title,
            description: result.description,
            assigned_to: result.suggestedAssigneeId,
            project_id: result.suggestedProjectId,
            due_date: result.suggestedDueDate ? parseISO(result.suggestedDueDate) : undefined,
            priority: result.suggestedPriority,
          });
        } catch (error) {
          console.error("AI suggestion failed:", error);
          toast({
            variant: 'destructive',
            title: 'AI Suggestion Failed',
            description: 'Could not generate task suggestions. Please fill out the form manually.',
          });
          form.reset({
            name: 'New Task from Thread',
            description: `Original message: "${message.content}"`,
          });
        }
      });
    }
  }, [isOpen, message, channelMembers, projects, form, toast]);

  const onSubmit = async (values: TaskFormValues) => {
    try {
      const newTaskData = {
        ...values,
        description: values.description || '',
        due_date: values.due_date ? values.due_date.toISOString() : new Date().toISOString(),
        priority: values.priority || null,
        status: 'Backlog' as const,
        sprint_points: null,
        tags: [],
        time_estimate: null,
        relationships: [],
        activities: [],
        comments: [
            {
                id: `comment-${Date.now()}`,
                user_id: 'system',
                comment: `Task created from message: "${message.content}"`,
                timestamp: new Date().toISOString()
            }
        ],
        attachments: [],
      };
      
      const createdTask = await addTask(newTaskData);
      
      onTaskCreated(createdTask);
      toast({ title: 'Task Created', description: 'The new task has been added to the board.' });
      onOpenChange(false);

    } catch (error) {
       toast({
            variant: 'destructive',
            title: 'Failed to create task',
            description: 'Could not save the new task. Please try again.',
          });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Task from Thread</DialogTitle>
          <DialogDescription>AI has drafted a task from the conversation. Review and edit before creating.</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Bot className="h-5 w-5 animate-pulse" />
            <span className="text-muted-foreground">AI is drafting your task...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Design new logo" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Provide a brief description of the task." {...field} value={field.value || ''} rows={4}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {channelMembers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Set priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                 <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                 <Button type="submit">Create Task</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
