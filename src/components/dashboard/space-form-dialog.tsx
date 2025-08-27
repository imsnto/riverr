
'use client';

import React from 'react';
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
import { Space, User, SpaceMember } from '@/lib/data';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import HubComponentEditor from './hub-component-editor';

const spaceSchema = z.object({
  name: z.string().min(2, 'Space name must be at least 2 characters long.'),
  members: z.array(z.string()).min(1, 'At least one member is required.'),
  hubComponents: z.array(z.string()).default(['tasks', 'documents', 'messages']),
});

type SpaceFormValues = z.infer<typeof spaceSchema>;

interface SpaceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (space: Omit<Space, 'id' | 'statuses'> & { hubComponents?: string[] }) => void;
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
      hubComponents: ['tasks', 'documents', 'messages'],
    },
  });
  
  React.useEffect(() => {
    if (isOpen) {
      if (space) {
          form.reset({
              name: space.name,
              members: Object.keys(space.members),
              hubComponents: ['tasks', 'documents', 'messages'], // Not editable for existing spaces yet
          });
      } else {
          form.reset({
              name: '',
              members: [currentUser.id],
              hubComponents: ['tasks', 'documents', 'messages'],
          })
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
        hubComponents: values.hubComponents,
    };
    
    onSave(spaceData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{space ? 'Edit Space' : 'Create Space'}</DialogTitle>
          <DialogDescription>
            {space ? 'Update the details for your space.' : 'Fill in the details to create a new space and its default hub.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            {!space && (
                 <FormField
                  control={form.control}
                  name="hubComponents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Hub Features</FormLabel>
                        <FormControl>
                            <HubComponentEditor selected={field.value} setSelected={field.onChange} />
                        </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
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
            <DialogFooter>
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
    const [open, setOpen] = React.useState(false)
  
    const handleSelect = (userId: string) => {
        if (creatorId && userId === creatorId) return;

        const newSelected = selectedUsers.includes(userId)
            ? selectedUsers.filter(id => id !== userId)
            : [...selectedUsers, userId];
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
    )
  }
