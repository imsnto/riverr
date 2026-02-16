
'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Mail, Check, ChevronsUpDown } from 'lucide-react';
import { Space, Invite, Hub } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  spaceRole: z.enum(['Admin', 'Member', 'Viewer']),
  hubAccess: z.record(z.string()).optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInvite: (values: Omit<Invite, 'id' | 'tokenHash' | 'sentAt' | 'expiresAt' | 'createdAt' | 'status'>) => void;
  activeSpace: Space;
  allHubs: Hub[];
}

export default function InviteUserDialog({ isOpen, onOpenChange, onInvite, activeSpace, allHubs }: InviteUserDialogProps) {
  const { appUser } = useAuth();
  
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      spaceRole: 'Member',
      hubAccess: {},
    },
  });
  
  React.useEffect(() => {
    if (isOpen) {
      // Set default hub access for all hubs in the active space to 'Member'
      const defaultHubAccess = allHubs.reduce((acc, hub) => {
        acc[hub.id] = 'Member';
        return acc;
      }, {} as Record<string, string>);

      form.reset({
        email: '',
        spaceRole: 'Member',
        hubAccess: defaultHubAccess,
      });
    }
  }, [isOpen, allHubs, form]);

  const role = form.watch('spaceRole');

  const onSubmit = (values: InviteFormValues) => {
    if (!appUser) return;
    const inviteData = {
        email: values.email,
        spaceRole: values.spaceRole,
        spaceId: activeSpace.id,
        spaceName: activeSpace.name,
        hubAccess: values.spaceRole === 'Admin' ? undefined : values.hubAccess,
        createdBy: appUser.id,
    };

    onInvite(inviteData);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite a New User</DialogTitle>
          <DialogDescription>Invite a new user to the <span className="font-semibold">{activeSpace.name}</span> space.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="py-4 space-y-4">
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
                name="spaceRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Space Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="Member">Member</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {role === 'Member' && (
                <div>
                    <FormLabel>Hub Access</FormLabel>
                    <p className="text-xs text-muted-foreground mb-2">Set the user's role for each hub in this space.</p>
                    <ScrollArea className="h-48 border rounded-md p-2">
                        <div className="space-y-2">
                            {allHubs.map(hub => (
                                <FormField
                                    key={hub.id}
                                    control={form.control}
                                    name={`hubAccess.${hub.id}`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between">
                                            <FormLabel className="font-normal">{hub.name}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-[150px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Hub Admin">Hub Admin</SelectItem>
                                                    <SelectItem value="Member">Member</SelectItem>
                                                    <SelectItem value="Viewer">Viewer</SelectItem>
                                                    <SelectItem value="None">No Access</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
              )}
            </div>
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
