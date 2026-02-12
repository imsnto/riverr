
'use client';
import React, { useState, useMemo } from 'react';
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
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Hub, EscalationIntakeRule, Project, Ticket } from '@/lib/data';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const escalateSchema = z.object({
  intakeRuleId: z.string().min(1, 'Please select an escalation route.'),
});

type EscalateFormValues = z.infer<typeof escalateSchema>;

interface EscalateTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ticket: Ticket;
  activeHub: Hub;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
  onConfirm: (intakeRuleId: string) => void;
}

export default function EscalateTicketDialog({
  isOpen,
  onOpenChange,
  ticket,
  activeHub,
  allHubs,
  escalationRules,
  projects,
  onConfirm,
}: EscalateTicketDialogProps) {
  
  const form = useForm<EscalateFormValues>({
    resolver: zodResolver(escalateSchema),
    defaultValues: { intakeRuleId: '' },
  });

  const intraHubEscalationProject = useMemo(() => {
    if (!activeHub.settings?.intraHubEscalationProjectId) return null;
    return projects.find(p => p.id === activeHub.settings.intraHubEscalationProjectId);
  }, [activeHub, projects]);

  const availableRules = useMemo(() => {
    if (intraHubEscalationProject || !ticket.type) return [];
    return escalationRules.filter(rule => 
        rule.enabled &&
        rule.allowedSourceHubIds.includes(activeHub.id) &&
        rule.allowedTypes.includes(ticket.type)
    );
  }, [intraHubEscalationProject, escalationRules, activeHub.id, ticket.type]);
  
  React.useEffect(() => {
    if(isOpen) {
      form.reset({ intakeRuleId: '' });
      if (intraHubEscalationProject) {
        form.setValue('intakeRuleId', `intra-hub:${intraHubEscalationProject.id}`);
      } else if (availableRules.length === 1) {
        form.setValue('intakeRuleId', availableRules[0].id);
      }
    }
  }, [isOpen, intraHubEscalationProject, availableRules, form]);

  const onSubmit = (values: EscalateFormValues) => {
    onConfirm(values.intakeRuleId);
    onOpenChange(false);
  };

  const noRoutesAvailable = !intraHubEscalationProject && availableRules.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Escalate Ticket to Developers</SheetTitle>
          <SheetDescription>
            This will create a linked task for the development team. Please choose the destination.
          </SheetDescription>
        </SheetHeader>
        {noRoutesAvailable ? (
            <div className="text-center py-8 text-muted-foreground">
                <p>No available escalation routes for this ticket type.</p>
                <p className="text-xs mt-2">Configure an Intra-Hub project or a Cross-Hub Intake Rule in settings.</p>
            </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                             <FormMessage />
                        </FormItem>
                    )}
                  />
                )}
              <SheetFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Confirm Escalation</Button>
              </SheetFooter>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
