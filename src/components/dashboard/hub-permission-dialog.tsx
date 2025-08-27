'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { User } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { ScrollArea } from '../ui/scroll-area';

interface HubPermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  spaceUsers: User[];
  onSave: (userIds: string[], applyToAll: boolean) => void;
  defaultPermissions?: { userIds: string[], applyToAll: boolean };
}

export default function HubPermissionDialog({
  isOpen,
  onOpenChange,
  spaceUsers,
  onSave,
  defaultPermissions = { userIds: [], applyToAll: true }
}: HubPermissionDialogProps) {
  const { appUser } = useAuth();
  const [access, setAccess] = useState<'all' | 'specific'>(defaultPermissions.applyToAll ? 'all' : 'specific');
  const [selectedUsers, setSelectedUsers] = useState<string[]>(defaultPermissions.userIds);

  useEffect(() => {
    if (isOpen) {
        setAccess(defaultPermissions.applyToAll ? 'all' : 'specific');
        // Ensure the current user is always included for 'specific'
        if (appUser && !defaultPermissions.userIds.includes(appUser.id)) {
             setSelectedUsers([...defaultPermissions.userIds, appUser.id]);
        } else {
             setSelectedUsers(defaultPermissions.userIds);
        }
    }
  }, [isOpen, defaultPermissions, appUser]);

  const handleSave = () => {
    const isAll = access === 'all';
    onSave(isAll ? [] : selectedUsers, isAll);
    onOpenChange(false);
  };
  
  const otherSpaceUsers = spaceUsers.filter(u => u.id !== appUser?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Set Hub Permissions</DialogTitle>
          <DialogDescription>
            Choose who can access this hub. You can change this later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
                <div className="py-4 px-6 space-y-4">
                    <RadioGroup value={access} onValueChange={(value) => setAccess(value as 'all' | 'specific')}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="r1" />
                        <Label htmlFor="r1">Allow all current and future members of this space</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific" id="r2" />
                        <Label htmlFor="r2">Allow only specific people</Label>
                    </div>
                    </RadioGroup>
                    {access === 'specific' && (
                        <div className="pl-6 pt-2">
                            <MemberSelect 
                                allUsers={otherSpaceUsers} 
                                selectedUsers={selectedUsers} 
                                onChange={setSelectedUsers}
                                creatorId={appUser?.id || null}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                You will always have access to hubs you create.
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
        <DialogFooter className="mt-auto p-6 pt-4 border-t bg-background">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Permissions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function MemberSelect({ allUsers, selectedUsers, onChange, creatorId }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void, creatorId: string | null }) {
    const [open, setOpen] = React.useState(false);
  
    const handleSelect = (userId: string) => {
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
                     if (id === creatorId) return null; // Don't show creator in badge list
                     return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>;
                 }).filter(Boolean) : "Select members..."}
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
