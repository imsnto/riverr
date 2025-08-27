
'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { Check, ChevronsUpDown, Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import HubComponentEditor from './hub-component-editor';
import HubPermissionDialog from './hub-permission-dialog';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

const hubSchema = z.object({
  name: z.string().min(2, 'Hub name is required.'),
  components: z.array(z.string()).default(['tasks']),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(z.string()).default([]),
});

const spaceSchema = z.object({
  name: z.string().min(2, 'Space name must be at least 2 characters long.'),
  members: z.array(z.string()).min(1, 'At least one member is required.'),
  hubs: z.array(hubSchema).min(1, 'At least one hub is required.'),
});

export type HubFormValues = z.infer<typeof hubSchema>;
type SpaceFormValues = z.infer<typeof spaceSchema>;

interface SpaceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (spaceData: Omit<Space, 'id' | 'statuses'>, hubData: HubFormValues[]) => void;
  space: Space | null;
  allUsers: User[];
  currentUser: User;
}

export default function SpaceFormDialog({ isOpen, onOpenChange, onSave, space, allUsers, currentUser }: SpaceFormDialogProps) {
  const [permissionModalIndex, setPermissionModalIndex] = useState<number | null>(null);

  const form = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: {
      name: '',
      members: [currentUser.id],
      hubs: [
        {
          name: 'Default Hub',
          components: ['tasks', 'documents', 'messages'],
          isPrivate: false,
          memberIds: [currentUser.id]
        }
      ]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hubs",
  });
  
  React.useEffect(() => {
    if (isOpen) {
      if (space) {
        form.reset({
          name: space.name,
          members: Object.keys(space.members),
          hubs: [] // TODO: Populate from existing space hubs
        });
      } else {
        form.reset({
          name: '',
          members: [currentUser.id],
          hubs: [
            {
              name: 'Default Hub',
              components: ['tasks', 'documents', 'messages'],
              isPrivate: false,
              memberIds: [currentUser.id]
            }
          ]
        });
      }
    }
  }, [space, currentUser, form, isOpen]);

  const onSubmit = (values: SpaceFormValues) => {
    const membersMap: Record<string, SpaceMember> = {};
    values.members.forEach(memberId => {
      membersMap[memberId] = { role: memberId === currentUser.id ? 'Admin' : 'Member' };
    });

    const spaceData = {
      name: values.name,
      members: membersMap,
    };

    onSave(spaceData, values.hubs);
    onOpenChange(false);
  };

  const handleHubPermissionsSave = (userIds: string[], applyToAll: boolean) => {
    if (permissionModalIndex !== null) {
      form.setValue(`hubs.${permissionModalIndex}.isPrivate`, !applyToAll);
      form.setValue(`hubs.${permissionModalIndex}.memberIds`, applyToAll ? [] : userIds);
      setPermissionModalIndex(null);
    }
  };

  const selectedHubPermissions = permissionModalIndex !== null 
    ? {
        userIds: form.getValues(`hubs.${permissionModalIndex}.memberIds`) || [],
        applyToAll: !form.getValues(`hubs.${permissionModalIndex}.isPrivate`)
      }
    : undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>{space ? 'Edit Space' : 'Create Space'}</DialogTitle>
            <DialogDescription>
              {space ? 'Update the details for your space and hubs.' : 'Fill in the details to create a new space and its hubs.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <Form {...form}>
                  <form id="space-form" className="space-y-6">
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
                            <FormLabel>Space Members</FormLabel>
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
                    
                    <div className="space-y-4">
                      <FormLabel>Hubs</FormLabel>
                      {fields.map((item, index) => (
                        <Card key={item.id} className="bg-muted/50 p-4">
                          <div className="flex justify-between items-center mb-4">
                             <FormField
                                control={form.control}
                                name={`hubs.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl><Input placeholder="Hub Name" {...field} className="text-base font-semibold border-none p-0 bg-transparent focus-visible:ring-0" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                              />
                              {fields.length > 1 && (
                                <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                          </div>
                          
                          <div className="space-y-4">
                             <FormField
                                control={form.control}
                                name={`hubs.${index}.components`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Features</FormLabel>
                                        <FormControl>
                                            <HubComponentEditor selected={field.value || []} setSelected={field.onChange} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                              />
                               <Button variant="outline" type="button" onClick={() => setPermissionModalIndex(index)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Permissions
                               </Button>
                          </div>
                        </Card>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => append({ 
                            name: `New Hub ${fields.length + 1}`,
                            components: ['tasks'],
                            isPrivate: false,
                            memberIds: [currentUser.id]
                        })}
                      >
                        <Plus className="mr-2 h-4 w-4"/> Add Another Hub
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="mt-auto p-6 pt-4 border-t bg-background">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" form="space-form" onClick={form.handleSubmit(onSubmit)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {permissionModalIndex !== null && (
        <HubPermissionDialog
          isOpen={permissionModalIndex !== null}
          onOpenChange={() => setPermissionModalIndex(null)}
          spaceUsers={allUsers.filter(u => form.getValues('members').includes(u.id))}
          onSave={handleHubPermissionsSave}
          defaultPermissions={selectedHubPermissions}
        />
      )}
    </>
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
