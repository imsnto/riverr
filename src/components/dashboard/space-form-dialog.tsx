
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
import { Space, User, SpaceMember, Hub } from '@/lib/data';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import HubComponentEditor from './hub-component-editor';
import HubPermissionDialog from './hub-permission-dialog';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

const hubSchema = z.object({
  name: z.string().min(2, 'Hub name is required.'),
  components: z.array(z.string()).default([]),
  applyToAll: z.boolean().default(true),
  permittedUsers: z.array(z.string()).default([]),
});

const spaceSchema = z.object({
  name: z.string().min(2, 'Space name must be at least 2 characters long.'),
  members: z.array(z.string()).min(1, 'At least one member is required.'),
  hubs: z.array(hubSchema).min(1, 'At least one hub is required.'),
});

type HubFormValues = z.infer<typeof hubSchema>;
type SpaceFormValues = z.infer<typeof spaceSchema>;

interface SpaceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (space: Omit<Space, 'id' | 'statuses'> & { hubs: HubFormValues[] }) => void;
  space: Space | null;
  allUsers: User[];
  currentUser: User;
}

export default function SpaceFormDialog({ isOpen, onOpenChange, onSave, space, allUsers, currentUser }: SpaceFormDialogProps) {
  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: {
      name: '',
      members: [currentUser.id],
      hubs: [
        {
          name: 'Default Hub',
          components: ['tasks', 'documents', 'messages'],
          applyToAll: true,
          permittedUsers: []
        }
      ]
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (space) {
        form.reset({
          name: space.name,
          members: Object.keys(space.members),
          hubs: [] // TODO: populate from existing space hubs
        });
      } else {
        form.reset({
          name: '',
          members: [currentUser.id],
          hubs: [
            {
              name: 'Default Hub',
              components: ['tasks', 'documents', 'messages'],
              applyToAll: true,
              permittedUsers: []
            }
          ]
        });
      }
    }
  }, [space, currentUser, form, isOpen])

  const onSubmit = (values: SpaceFormValues) => {
    const membersMap: Record<string, SpaceMember> = {};
    values.members.forEach(memberId => {
      const existingMember = space?.members[memberId];
      if (existingMember) {
        membersMap[memberId] = existingMember;
      } else {
        membersMap[memberId] = { role: memberId === currentUser.id ? 'Admin' : 'Member' };
      }
    });

    const spaceData = {
      name: values.name,
      members: membersMap,
      hubs: values.hubs,
    };

    onSave(spaceData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{space ? 'Edit Space' : 'Create Space'}</DialogTitle>
          <DialogDescription>
            {space ? 'Update the details for your space and hubs.' : 'Fill in the details to create a new space and its default hub.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Space Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Marketing Team" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="members"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Members</FormLabel>
                        <MemberSelect 
                          allUsers={allUsers} 
                          selectedUsers={field.value} 
                          onChange={field.onChange}
                          creatorId={space ? null : currentUser.id}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />
                  <FormField
                      control={form.control}
                      name="hubs.0.name"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Default Hub Name</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="hubs.0.components"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Hub Features</FormLabel>
                              <FormControl>
                                <HubComponentEditor selected={field.value} setSelected={field.onChange} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                    <FormField
                      control={form.control}
                      name="hubs.0" // Pass the whole hub object to the dialog
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Hub Permissions</FormLabel>
                              <FormControl>
                                  <HubPermissionDialog
                                      isOpen={false} // This dialog will be controlled externally if needed, or integrated directly
                                      onOpenChange={() => {}}
                                      spaceUsers={allUsers.filter(u => form.getValues('members').includes(u.id))}
                                      onSave={(userIds, applyToAll) => {
                                          field.onChange({
                                              ...field.value,
                                              permittedUsers: userIds,
                                              applyToAll: applyToAll,
                                          })
                                      }}
                                      // This is a simplified integration.
                                      // A real implementation might use a button to open the dialog.
                                      // For now, we assume it's part of the main form.
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t bg-background">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MemberSelect({ allUsers, selectedUsers, onChange, creatorId }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void, creatorId: string | null }) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (userId: string) => {
    if (creatorId && userId === creatorId) return;

    const newSelected = selectedUsers.includes(userId)
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    onChange(newSelected);
  };

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
              {selectedUsers.length > 0 ? selectedUsers.map(id => {
                const user = allUsers.find(u => u.id === id);
                return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>;
              }) : "Select members..."}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search users..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup>
                {allUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.name}
                    onSelect={() => handleSelect(user.id)}
                    className={cn(
                      creatorId && user.id === creatorId && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {user.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
