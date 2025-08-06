
'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Task, User, TimeEntry } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

const timeLogSchema = z.object({
  duration: z.string().min(1, 'Please enter a duration.'),
  notes: z.string().optional(),
  userId: z.string(),
});

type TimeLogFormValues = z.infer<typeof timeLogSchema>;

interface LogTimeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task;
  allUsers: User[];
  appUser: User;
  onLogTime: (timeData: Omit<TimeEntry, 'id'>) => void;
}

// Simple parser for inputs like "2h 30m"
const parseDuration = (durationStr: string): number => {
    let totalHours = 0;
    const hoursMatch = durationStr.match(/(\d+(\.\d+)?)\s*h/);
    const minutesMatch = durationStr.match(/(\d+(\.\d+)?)\s*m/);

    if (hoursMatch) {
        totalHours += parseFloat(hoursMatch[1]);
    }
    if (minutesMatch) {
        totalHours += parseFloat(minutesMatch[1]) / 60;
    }
    // If no units, assume hours
    if (!hoursMatch && !minutesMatch && durationStr.trim()) {
        const numericValue = parseFloat(durationStr);
        if (!isNaN(numericValue)) {
            totalHours = numericValue;
        }
    }
    return totalHours;
};


export default function LogTimeDialog({ isOpen, onOpenChange, task, allUsers, appUser, onLogTime }: LogTimeDialogProps) {
  const { toast } = useToast();
  const form = useForm<TimeLogFormValues>({
    resolver: zodResolver(timeLogSchema),
    defaultValues: {
      duration: '',
      notes: '',
      userId: appUser.id,
    },
  });

  const onSubmit = (values: TimeLogFormValues) => {
    const durationInHours = parseDuration(values.duration);

    if (durationInHours <= 0) {
        toast({
            variant: 'destructive',
            title: 'Invalid Duration',
            description: 'Please enter a valid time duration (e.g., "1.5h", "2h 30m").'
        });
        return;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationInHours * 60 * 60 * 1000);

    onLogTime({
      user_id: values.userId,
      project_id: task.project_id,
      task_id: task.id,
      source: 'Manual',
      notes: values.notes || '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration: durationInHours,
    });
    
    toast({ title: 'Time Logged Successfully' });
    onOpenChange(false);
    form.reset();
  };
  
  const durationInput = form.watch('duration');
  const parsedSuggestion = parseDuration(durationInput);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time for: {task.name}</DialogTitle>
          <DialogDescription>
            Add a new time entry to this task.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue asChild>
                               <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={allUsers.find(u => u.id === field.value)?.avatarUrl} />
                                  <AvatarFallback>{getInitials(allUsers.find(u => u.id === field.value)?.name || '')}</AvatarFallback>
                                </Avatar>
                                {allUsers.find(u => u.id === field.value)?.name}
                              </div>
                            </SelectValue>
                        </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2h 30m or 2.5" {...field} />
                  </FormControl>
                   {parsedSuggestion > 0 && (
                        <Button type="button" variant="outline" className="w-full" onClick={() => form.setValue('duration', `${parsedSuggestion.toFixed(2)}h`)}>
                            Log {parsedSuggestion.toFixed(2)} hours
                        </Button>
                    )}
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What did you work on?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save Entry</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
