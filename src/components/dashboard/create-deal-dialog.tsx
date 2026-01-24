'use client';
import React, { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { User, Contact, Deal } from '@/lib/data';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  contactId: z.string().optional(),
  value: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number().optional()
  ),
  assignedTo: z.string().optional(),
  nextStep: z.string().optional(),
  nextStepAt: z.date().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;

interface CreateDealDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (dealData: Omit<Deal, 'id' | 'hubId' | 'spaceId' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'isStale' | 'lastActivityAt' >) => void;
  allUsers: User[];
  contacts: Contact[];
  defaultStage: string;
}

export default function CreateDealDialog({
  isOpen,
  onOpenChange,
  onSave,
  allUsers,
  contacts,
  defaultStage,
}: CreateDealDialogProps) {
  const { appUser } = useAuth();
  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: '',
      contactId: '',
      value: undefined,
      assignedTo: '',
      nextStep: '',
      nextStepAt: undefined,
      source: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  const onSubmit = (values: DealFormValues) => {
    if (!appUser) return;
    const now = new Date().toISOString();
    const newDeal: Omit<Deal, 'id' | 'hubId' | 'spaceId' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'isStale' | 'lastActivityAt'> = {
      title: values.title,
      description: values.description || null,
      value: values.value || null,
      currency: 'USD',
      assignedTo: values.assignedTo || null,
      contactId: values.contactId || null,
      source: values.source as any || null,
      nextStep: values.nextStep || null,
      nextStepAt: values.nextStepAt?.toISOString() || null,
      closeDate: null,
      tags: [],
    };
    onSave(newDeal);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Deal</DialogTitle>
          <DialogDescription>Manually create a new deal in your pipeline.</DialogDescription>
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
                    <Input placeholder="e.g., Acme Corp Website Redesign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Owner</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Assign a user" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="nextStep"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Next Step</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select next step" /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Call">Call</SelectItem>
                                  <SelectItem value="Demo">Demo</SelectItem>
                                  <SelectItem value="Quote">Quote</SelectItem>
                                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                              </SelectContent>
                          </Select>
                      </FormItem>
                  )}
              />
               <FormField
                  control={form.control}
                  name="nextStepAt"
                  render={({ field }) => (
                      <FormItem className="flex flex-col">
                      <FormLabel>Next Step Date</FormLabel>
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
            </div>
             <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger></FormControl>
                          <SelectContent>
                              <SelectItem value="Inbound Chat">Inbound Chat</SelectItem>
                              <SelectItem value="Referral">Referral</SelectItem>
                              <SelectItem value="Website">Website</SelectItem>
                              <SelectItem value="Manual">Manual</SelectItem>
                              <SelectItem value="Import">Import</SelectItem>
                          </SelectContent>
                      </Select>
                  </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add internal notes about the deal..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Deal</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
