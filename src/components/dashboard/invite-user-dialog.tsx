
'use client';

import React from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Mail, Check, ChevronsUpDown } from 'lucide-react';
import { Space, Invite, Permissions } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const permissionSchema = z.object({
    canViewTasks: z.boolean().default(true),
    canEditTasks: z.boolean().default(false),
    canLogTime: z.boolean().default(true),
    canSeeAllTimesheets: z.boolean().default(false),
    canViewReports: z.boolean().default(false),
    canInviteMembers: z.boolean().default(false),
});

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['Admin', 'Member']),
  spaces: z.array(z.string()).min(1, 'Please select at least one space.'),
  permissions: permissionSchema.optional(),
}).refine(data => {
    if (data.role === 'Member' && !data.permissions) {
        // If role is member, permissions should be defined. We can set a default here.
        data.permissions = {
            canViewTasks: true,
            canEditTasks: false,
            canLogTime: true,
            canSeeAllTimesheets: false,
            canViewReports: false,
            canInviteMembers: false,
        };
    }
    return true;
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvite: (values: Omit<Invite, 'id' | 'token' | 'status' | 'invitedBy'>) => void;
  allSpaces: Space[];
}

const permissionLabels: Record<keyof Permissions, string> = {
    canViewTasks: "View Tasks",
    canEditTasks: "Create/Edit Tasks",
    canLogTime: "Log Time",
    canSeeAllTimesheets: "See All Timesheets",
    canViewReports: "View Reports",
    canInviteMembers: "Invite Members",
};


export default function InviteUserDialog({ isOpen, onOpenChange, onInvite, allSpaces }: InviteUserDialogProps) {
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'Member',
      spaces: [],
      permissions: {
        canViewTasks: true,
        canEditTasks: false,
        canLogTime: true,
        canSeeAllTimesheets: false,
        canViewReports: false,
        canInviteMembers: false,
      },
    },
  });

  const role = form.watch('role');

  const onSubmit = (values: InviteFormValues) => {
    const inviteData: Omit<Invite, 'id'|'token'|'status'|'invitedBy'> = {
        email: values.email,
        role: values.role,
        spaces: values.spaces,
    };
    if (values.role === 'Member') {
        inviteData.permissions = values.permissions;
    }

    onInvite(inviteData);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite a New User</DialogTitle>
          <DialogDescription>Enter the user's details to grant them access.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="e.g., teammate@example.com" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="spaces"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Spaces</FormLabel>
                   <SpaceSelect allSpaces={allSpaces} selectedSpaces={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'Member' && (
                <div>
                    <Separator className="my-4" />
                    <FormLabel>Permissions</FormLabel>
                    <div className="grid grid-cols-2 gap-4 mt-2 p-4 border rounded-lg">
                        {Object.keys(permissionLabels).map(key => (
                             <FormField
                                key={key}
                                control={form.control}
                                name={`permissions.${key as keyof Permissions}`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                {permissionLabels[key as keyof Permissions]}
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                </div>
            )}


            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Invite User</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function SpaceSelect({ allSpaces, selectedSpaces, onChange }: { allSpaces: Space[], selectedSpaces: string[], onChange: (users: string[]) => void }) {
    const [open, setOpen] = React.useState(false)
  
    const handleSelect = (spaceId: string) => {
        const newSelected = selectedSpaces.includes(spaceId)
            ? selectedSpaces.filter(id => id !== spaceId)
            : [...selectedSpaces, spaceId];
        onChange(newSelected);
    }

    return (
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto"
            >
             <div className="flex flex-wrap gap-1">
                 {selectedSpaces.length > 0 ? selectedSpaces.map(id => {
                     const space = allSpaces.find(s => s.id === id);
                     return <Badge variant="secondary" key={id}>{space?.name || 'Unknown'}</Badge>
                 }) : "Select spaces..."}
             </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search spaces..." />
              <CommandList>
                <CommandEmpty>No spaces found.</CommandEmpty>
                <CommandGroup>
                  {allSpaces.map((space) => (
                    <CommandItem
                      key={space.id}
                      value={space.name}
                      onSelect={() => handleSelect(space.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSpaces.includes(space.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {space.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
