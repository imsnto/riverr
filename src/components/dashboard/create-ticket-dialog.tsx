
'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Hub, Space, User, EscalationIntakeRule, Project, Ticket, Contact } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import ContactCombobox from './contacts/contact-combobox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  type: z.enum(['bug', 'question', 'feature']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  contactId: z.string().optional(),
  assignedTo: z.string().optional(),
  escalateNow: z.boolean().default(false),
  intakeRuleId: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface CreateTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activeHub: Hub | null;
  activeSpace: Space | null;
  allUsers: User[];
  onCreateTicket: (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => void;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
  contacts: Contact[];
  onDataRefresh: () => void;
  defaultContactId?: string | null;
  disableContactSelection?: boolean;
  contactInfo?: { id: string; name: string | null; email: string | null; };
}

const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


export default function CreateTicketDialog({
  isOpen,
  onOpenChange,
  activeHub,
  activeSpace,
  allUsers,
  onCreateTicket,
  contacts,
  onDataRefresh,
  escalationRules,
  allHubs,
  projects,
  defaultContactId,
  disableContactSelection = false,
  contactInfo,
}: CreateTicketDialogProps) {
  const { appUser } = useAuth();
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'question',
      escalateNow: false,
      assignedTo: appUser?.id,
      contactId: contactInfo?.id || defaultContactId || undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: '',
        description: '',
        type: 'question',
        escalateNow: false,
        assignedTo: appUser?.id,
        contactId: contactInfo?.id || defaultContactId || undefined,
        priority: undefined,
        intakeRuleId: undefined,
      });
    }
  }, [isOpen, form, appUser, defaultContactId, contactInfo]);

  const escalateNow = form.watch('escalateNow');
  const ticketType = form.watch('type');
  
  const currentContactId = form.watch('contactId');
  const selectedContact = contacts.find(c => c.id === currentContactId);
  const displayContact = contactInfo || selectedContact;

  const intraHubEscalationProject = useMemo(() => {
    if (!activeHub?.settings?.intraHubEscalationProjectId) return null;
    return projects.find(p => p.id === activeHub.settings.intraHubEscalationProjectId);
  }, [activeHub, projects]);

  const availableRules = useMemo(() => {
    if (!activeHub || intraHubEscalationProject) return [];
    return escalationRules.filter(rule => 
        rule.enabled &&
        rule.allowedSourceHubIds.includes(activeHub.id) &&
        rule.allowedTypes.includes(ticketType)
    );
  }, [intraHubEscalationProject, escalationRules, activeHub, ticketType]);


  const onSubmit = (values: TicketFormValues) => {
    if (!appUser || !activeHub || !activeSpace) return;
    const now = new Date().toISOString();
    
    let finalIntakeRuleId = values.intakeRuleId;
    if (values.escalateNow && intraHubEscalationProject) {
        finalIntakeRuleId = `intra-hub:${intraHubEscalationProject.id}`;
    }

    const newTicket: Omit<Ticket, 'id'> = {
      hubId: activeHub.id,
      spaceId: activeSpace.id,
      status: 'New',
      title: values.title,
      description: values.description || null,
      type: values.type,
      priority: values.priority || null,
      assignedTo: values.assignedTo || null,
      contactId: values.contactId || null,
      conversationId: null,
      channel: 'Manual',
      lastMessageAt: now,
      lastMessagePreview: 'Ticket created manually.',
      lastMessageAuthor: appUser.name,
      createdAt: now,
      createdBy: appUser.id,
      updatedAt: now,
      escalation: { status: 'none' }
    };
    onCreateTicket(newTicket, values.escalateNow, finalIntakeRuleId);
    onOpenChange(false);
  };

  if (!activeHub || !activeSpace) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create New Ticket</SheetTitle>
          <SheetDescription>Manually create a new support ticket.</SheetDescription>
        </SheetHeader>
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
                             <Select onValueChange={field.onChange} value={field.value}>
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
            {disableContactSelection && displayContact ? (
                <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback>{getInitials(displayContact.name)}</AvatarFallback>
                        </Avatar>
                        <span>{displayContact.name || displayContact.email}</span>
                    </div>
                </FormItem>
            ) : (
                <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contact</FormLabel>
                        <ContactCombobox 
                            contacts={contacts}
                            value={field.value || null}
                            onChange={field.onChange}
                            onDataRefresh={onDataRefresh}
                        />
                        </FormItem>
                    )}
                />
            )}
            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Assign a user" /></SelectTrigger></FormControl>
                          <SelectContent>
                              {allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
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
                        disabled={!intraHubEscalationProject && availableRules.length === 0}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>Escalate to Dev now</FormLabel>
                        <FormDescription>
                        {!intraHubEscalationProject && availableRules.length === 0 ? "No available escalation routes for this hub/ticket type." : "This will also create a linked task for the dev team."}
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />

            {escalateNow && (
              <>
                {intraHubEscalationProject ? (
                  <FormItem>
                    <FormLabel>Escalation Target</FormLabel>
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted text-sm">
                      <span>Escalating to project:</span>
                      <span className="font-semibold">{intraHubEscalationProject.name}</span>
                    </div>
                  </FormItem>
                ) : (
                  <FormField
                    control={form.control}
                    name="intakeRuleId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Escalation Rule</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
              </>
            )}

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Ticket</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
