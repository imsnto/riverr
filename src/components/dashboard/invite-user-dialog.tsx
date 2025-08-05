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
import { Space, Invite } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['Admin', 'Member']),
  spaces: z.array(z.string()).min(1, 'Please select at least one space.'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvite: (values: Omit<Invite, 'token'>) => void;
  allSpaces: Space[];
}

export default function InviteUserDialog({ isOpen, onOpenChange, onInvite, allSpaces }: InviteUserDialogProps) {
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'Member',
      spaces: [],
    },
  });

  const onSubmit = (values: InviteFormValues) => {
    onInvite(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
