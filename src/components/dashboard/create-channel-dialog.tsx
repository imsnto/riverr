
'use client';

import React from 'react';
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
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Channel, User } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { useAuth } from '@/hooks/use-auth';

const channelSchema = z.object({
  name: z.string().min(2, 'Channel name must be at least 2 characters long.').regex(/^[a-z0-9-]+$/, 'Channel name can only contain lowercase letters, numbers, and hyphens.'),
  description: z.string().optional(),
  members: z.array(z.string()).min(1, 'At least one member is required.'),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface CreateChannelDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  spaceId: string;
  spaceMembers: User[];
  onSave: (channelData: Omit<Channel, 'id'>, channelId?: string) => void;
  editingChannel: Channel | null;
}

export default function CreateChannelDialog({ 
    isOpen, 
    onOpenChange, 
    spaceId, 
    spaceMembers, 
    onSave,
    editingChannel
}: CreateChannelDialogProps) {
  const { appUser } = useAuth();
  
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: '',
      description: '',
      members: appUser ? [appUser.id] : [],
    },
  });
  
  React.useEffect(() => {
    if (isOpen) {
        if (editingChannel) {
            form.reset({
                name: editingChannel.name,
                description: editingChannel.description,
                members: editingChannel.members,
            });
        } else if (appUser) {
            form.reset({
                name: '',
                description: '',
                members: [appUser.id],
            });
        }
    }
  }, [isOpen, appUser, editingChannel, form]);

  const onSubmit = (values: ChannelFormValues) => {
    const channelData: Omit<Channel, 'id'> = {
        ...values,
        space_id: spaceId,
    };
    
    onSave(channelData, editingChannel?.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{editingChannel ? 'Edit Channel' : 'Create New Channel'}</SheetTitle>
          <SheetDescription>
             {editingChannel ? `Update the details for #${editingChannel.name}.` : 'Channels are where your team communicates. They’re best when organized around a topic.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
                      <Input placeholder="e.g., project-phoenix" {...field} className="pl-6" />
                    </div>
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What's this channel about?" {...field} />
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
                        allUsers={spaceMembers} 
                        selectedUsers={field.value} 
                        onChange={field.onChange}
                        creatorId={editingChannel ? null : appUser?.id || null}
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
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
