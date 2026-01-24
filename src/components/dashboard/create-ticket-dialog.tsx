'use client';
import React, { useEffect, useState } from 'react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Hub, Space, User, Visitor, EscalationIntakeRule, Project, Ticket } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  type: z.enum(['bug', 'question', 'feature']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  contactId: z.string().optional(),
  escalateNow: z.boolean().default(false),
  intakeRuleId: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface CreateTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activeHub: Hub;
  activeSpace: Space;
  allUsers: User[];
  visitors: Visitor[];
  onCreateTicket: (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => void;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
}

export default function CreateTicketDialog({
  isOpen,
  onOpenChange,
  activeHub,
  activeSpace,
  onCreateTicket,
  visitors,
  escalationRules,
  allHubs,
  projects
}: CreateTicketDialogProps) {
  const { appUser } = useAuth();
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'question',
      escalateNow: false,
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const escalateNow = form.watch('escalateNow');
  const ticketType = form.watch('type');

  const availableRules = escalationRules.filter(rule => 
    rule.enabled &&
    rule.allowedSourceHubIds.includes(activeHub.id) &&
    rule.allowedTypes.includes(ticketType)
  );

  const onSubmit = (values: TicketFormValues) => {
    if (!appUser) return;
    const now = new Date().toISOString();
    const newTicket: Omit<Ticket, 'id'> = {
      hubId: activeHub.id,
      spaceId: activeSpace.id,
      status: 'New',
      title: values.title,
      description: values.description || null,
      type: values.type,
      priority: values.priority || null,
      assignedTo: null,
      contactId: values.contactId || null,
      conversationId: null,
      channel: 'Manual',
      lastMessageAt: now,
      lastMessagePreview: 'Ticket created manually.',
      createdAt: now,
      createdBy: appUser.id,
      updatedAt: now,
      escalation: { status: 'none' }
    };
    onCreateTicket(newTicket, values.escalateNow, values.intakeRuleId);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>Manually create a new support ticket.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Unable to login" {...field} />
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
                    <Textarea placeholder="Describe the issue..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="question">Question</SelectItem>
                                    <SelectItem value="bug">Bug Report</SelectItem>
                                    <SelectItem value="feature">Feature Request</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Priority</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Set priority" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contact (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Link a contact" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {visitors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="escalateNow"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={availableRules.length === 0}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>Escalate to Dev now</FormLabel>
                        <FormDescription>
                        {availableRules.length === 0 ? "No available escalation routes for this ticket type." : "This will also create a linked task for the dev team."}
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />

            {escalateNow && (
                 <FormField
                    control={form.control}
                    name="intakeRuleId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Escalation Rule</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select an escalation route" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {availableRules.map(rule => {
                                        const devHub = allHubs.find(h => h.id === rule.hubId);
                                        const devProject = projects.find(p => p.id === rule.destinationBoardId);
                                        return (
                                            <SelectItem key={rule.id} value={rule.id}>
                                                {rule.name} ({devHub?.name} / {devProject?.name})
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Ticket</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
