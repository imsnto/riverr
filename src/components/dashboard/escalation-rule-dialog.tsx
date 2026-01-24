
'use client';

import React, { useEffect, useMemo } from 'react';
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
import { EscalationIntakeRule, Hub, User, Project } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';

const ruleSchema = z.object({
  name: z.string().min(1, 'Rule name is required.'),
  enabled: z.boolean().default(true),
  allowedSourceHubIds: z.array(z.string()).min(1, 'At least one source hub must be selected.'),
  allowedTypes: z.array(z.string()).min(1, 'At least one ticket type must be selected.'),
  destinationBoardId: z.string().min(1, 'A destination board must be selected.'),
  destinationStatus: z.string().min(1, 'A destination status must be selected.'),
  defaultAssigneeId: z.string().optional(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

interface EscalationRuleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (rule: Omit<EscalationIntakeRule, 'id' | 'hubId'>, ruleId?: string) => void;
  rule: EscalationIntakeRule | null;
  activeHub: Hub;
  allUsers: User[];
  allHubs: Hub[];
  projects: Project[];
}

export default function EscalationRuleDialog({ isOpen, onOpenChange, onSave, rule, activeHub, allUsers, allHubs, projects }: EscalationRuleDialogProps) {
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: '', enabled: true, allowedSourceHubIds: [], allowedTypes: [] },
  });

  const selectedBoardId = form.watch('destinationBoardId');

  const destinationStatuses = useMemo(() => {
    // Note: This assumes statuses are on the project level for dev boards.
    // This might need to be adapted if dev boards use hub-level statuses.
    const board = projects.find(p => p.id === selectedBoardId);
    // A placeholder if the project doesn't have statuses defined.
    return (board && (activeHub.statuses || [])).map(s => s.name);
  }, [selectedBoardId, projects, activeHub.statuses]);


  useEffect(() => {
    if (isOpen) {
      if (rule) {
        form.reset({
          name: rule.name,
          enabled: rule.enabled,
          allowedSourceHubIds: rule.allowedSourceHubIds,
          allowedTypes: rule.allowedTypes,
          destinationBoardId: rule.destinationBoardId,
          destinationStatus: rule.destinationStatus,
          defaultAssigneeId: rule.defaultAssigneeId || undefined,
        });
      } else {
        form.reset({ name: '', enabled: true, allowedSourceHubIds: [], allowedTypes: [], destinationBoardId: '', destinationStatus: '' });
      }
    }
  }, [isOpen, rule, form]);

  const onSubmit = (values: RuleFormValues) => {
    const ruleData: Omit<EscalationIntakeRule, 'id'> = {
        hubId: activeHub.id,
        name: values.name,
        enabled: values.enabled,
        allowedSourceHubIds: values.allowedSourceHubIds,
        allowedTypes: values.allowedTypes as any,
        destinationBoardId: values.destinationBoardId,
        destinationStatus: values.destinationStatus,
        defaultAssigneeId: values.defaultAssigneeId || null,
        createdAt: rule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: rule?.createdBy || 'user-1', // Replace with actual current user
    };
    onSave(ruleData, rule?.id);
  };
  
  const otherHubs = allHubs.filter(h => h.id !== activeHub.id);
  const ticketTypes = ['bug', 'feature', 'investigation'];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Escalation Rule' : 'Create Escalation Rule'}</DialogTitle>
          <DialogDescription>Define a route for tickets to be escalated into this hub.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-1 pr-6 space-y-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Bugs from Support Hub" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="enabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Enabled</FormLabel>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />

                <Separator />
                
                <h4 className="font-semibold text-base">When...</h4>
                 <FormField
                    control={form.control}
                    name="allowedSourceHubIds"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>...a ticket is escalated from</FormLabel>
                            <MultiSelectPopover
                                title="Source Hubs"
                                options={otherHubs.map(h => ({ value: h.id, label: h.name }))}
                                selected={field.value}
                                onChange={field.onChange}
                             />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="allowedTypes"
                    render={({ field }) => (
                        <FormItem>
                             <FormLabel>...and its type is</FormLabel>
                              <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {ticketTypes.map((type) => (
                                    <FormField
                                    key={type}
                                    control={form.control}
                                    name="allowedTypes"
                                    render={({ field }) => {
                                        return (
                                        <FormItem
                                            key={type}
                                            className="flex flex-row items-start space-x-2 space-y-0"
                                        >
                                            <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(type)}
                                                onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...field.value, type])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                        (value) => value !== type
                                                        )
                                                    )
                                                }}
                                            />
                                            </FormControl>
                                            <FormLabel className="font-normal capitalize">
                                                {type}
                                            </FormLabel>
                                        </FormItem>
                                        )
                                    }}
                                    />
                                ))}
                             </div>
                             <FormMessage />
                        </FormItem>
                    )}
                />

                <h4 className="font-semibold text-base">Then...</h4>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="destinationBoardId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Create a task in</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a board..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="destinationStatus" render={({ field }) => (
                        <FormItem>
                            <FormLabel>...with the status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedBoardId}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a status..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {destinationStatuses?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="defaultAssigneeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>...and assign it to (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a user..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                {allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />

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

function MultiSelectPopover({ title, options, selected, onChange }: { title: string, options: { value: string, label: string }[], selected: string[], onChange: (selected: string[]) => void }) {
    const [open, setOpen] = useState(false);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value];
        onChange(newSelected);
    }
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto">
                    <div className="flex flex-wrap gap-1">
                        {selected.length > 0 ? selected.map(value => {
                            const option = options.find(o => o.value === value);
                            return <Badge variant="secondary" key={value}>{option?.label || 'Unknown'}</Badge>;
                        }) : `Select ${title}...`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder={`Search ${title}...`} />
                    <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem key={option.value} value={option.label} onSelect={() => handleSelect(option.value)}>
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


    