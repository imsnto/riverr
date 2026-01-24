
'use client';

import React, { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { DealAutomationRule, Hub, User } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const ruleSchema = z.object({
  name: z.string().min(1, 'Rule name is required.'),
  isEnabled: z.boolean().default(true),
  triggerType: z.enum(['stage_changed', 'deal_updated', 'deal_stale']),
  fromStage: z.string().optional(),
  toStage: z.string().optional(),
  staleDays: z.coerce.number().optional(),
  actionType: z.enum(['send_email', 'create_task', 'update_field', 'send_notification']),
  actionTemplateId: z.string().optional(), // For email
  actionTaskTitle: z.string().optional(),
  actionAssignTo: z.string().optional(),
  actionField: z.string().optional(),
  actionValue: z.string().optional(),
  actionChannel: z.string().optional(),
  actionMessage: z.string().optional(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

interface DealAutomationRuleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (rule: Omit<DealAutomationRule, 'id'>, ruleId?: string) => void;
  rule: DealAutomationRule | null;
  activeHub: Hub;
  allUsers: User[];
}

export default function DealAutomationRuleDialog({ isOpen, onOpenChange, onSave, rule, activeHub, allUsers }: DealAutomationRuleDialogProps) {
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: '', isEnabled: true, triggerType: 'stage_changed' },
  });

  useEffect(() => {
    if (isOpen) {
      if (rule) {
        form.reset({
          name: rule.name,
          isEnabled: rule.isEnabled,
          triggerType: rule.trigger.type,
          fromStage: rule.trigger.fromStage,
          toStage: rule.trigger.toStage,
          staleDays: rule.trigger.staleDays,
          actionType: rule.action.type,
          actionTemplateId: rule.action.templateId,
          actionTaskTitle: rule.action.taskTitle,
          actionAssignTo: rule.action.assignTo,
          actionField: rule.action.field,
          actionValue: rule.action.value,
          actionChannel: rule.action.channel,
          actionMessage: rule.action.message,
        });
      } else {
        form.reset({ name: '', isEnabled: true, triggerType: 'stage_changed' });
      }
    }
  }, [isOpen, rule, form]);

  const onSubmit = (values: RuleFormValues) => {
    const ruleData: Omit<DealAutomationRule, 'id'> = {
        hubId: activeHub.id,
        name: values.name,
        isEnabled: values.isEnabled,
        trigger: {
            type: values.triggerType,
            fromStage: values.fromStage,
            toStage: values.toStage,
            staleDays: values.staleDays,
        },
        action: {
            type: values.actionType,
            templateId: values.actionTemplateId,
            taskTitle: values.actionTaskTitle,
            assignTo: values.actionAssignTo,
            field: values.actionField,
            value: values.actionValue,
            channel: values.actionChannel,
            message: values.actionMessage,
        },
        createdAt: rule?.createdAt || new Date().toISOString(),
        createdBy: rule?.createdBy || 'user-1', // Replace with actual current user
    };
    onSave(ruleData, rule?.id);
  };
  
  const triggerType = form.watch('triggerType');
  const actionType = form.watch('actionType');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Automation Rule' : 'Create Automation Rule'}</DialogTitle>
          <DialogDescription>Set up a trigger and an action to automate your deal pipeline.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-1 pr-6 space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Follow up on new leads" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="isEnabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Enabled</FormLabel>
                            <FormDescription>Is this automation rule currently active?</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />

                <Separator />

                <h4 className="font-semibold text-lg">When...</h4>
                <div className="p-4 border rounded-lg space-y-4">
                    <FormField control={form.control} name="triggerType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Trigger</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a trigger" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="stage_changed">Stage is changed</SelectItem>
                                    <SelectItem value="deal_updated">A deal is updated</SelectItem>
                                    <SelectItem value="deal_stale">Deal becomes stale</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />

                    {triggerType === 'stage_changed' && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="fromStage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From Stage (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Any stage" /></SelectTrigger></FormControl>
                                        <SelectContent>{activeHub.dealStatuses?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="toStage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>To Stage</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a stage" /></SelectTrigger></FormControl>
                                        <SelectContent>{activeHub.dealStatuses?.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    )}
                    {triggerType === 'deal_stale' && (
                         <FormField control={form.control} name="staleDays" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Days without update</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 7" {...field} /></FormControl>
                            </FormItem>
                        )} />
                    )}
                </div>

                <h4 className="font-semibold text-lg">Do this...</h4>
                <div className="p-4 border rounded-lg space-y-4">
                     <FormField control={form.control} name="actionType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Action</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select an action" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="send_notification">Send a notification</SelectItem>
                                    <SelectItem value="update_field">Update a deal field</SelectItem>
                                    <SelectItem value="create_task">Create a task</SelectItem>
                                    <SelectItem value="send_email">Send an email</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />

                    {actionType === 'send_notification' && (
                        <>
                             <FormField control={form.control} name="actionAssignTo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a user..." /></SelectTrigger></FormControl>
                                        <SelectContent>{allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="actionMessage" render={({ field }) => (
                                <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea placeholder="Your notification message..." {...field} /></FormControl></FormItem>
                            )} />
                        </>
                    )}
                     {actionType === 'create_task' && (
                        <>
                            <FormField control={form.control} name="actionTaskTitle" render={({ field }) => (
                                <FormItem><FormLabel>Task Title</FormLabel><FormControl><Input placeholder="e.g., Follow up with {{contact.name}}" {...field} /></FormControl></FormItem>
                            )} />
                             <FormField control={form.control} name="actionAssignTo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assign To</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a user..." /></SelectTrigger></FormControl>
                                        <SelectContent>{allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </>
                    )}
                </div>
            </div>
            
            <DialogFooter className="p-6 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Save Rule</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
