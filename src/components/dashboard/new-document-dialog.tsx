
'use client';

import React, { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
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
import { Document, User } from '@/lib/data';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '../ui/badge';

const documentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  access: z.enum(['public', 'private']),
  allowedUserIds: z.array(z.string()).optional(),
}).refine(data => {
    if (data.access === 'private' && (!data.allowedUserIds || data.allowedUserIds.length === 0)) {
        return false;
    }
    return true;
}, {
    message: 'Please select at least one user for private documents.',
    path: ['allowedUserIds']
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface NewDocumentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  spaceId: string;
  spaceMembers: User[];
  onCreate: (docData: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'content' | 'comments' | 'tags' | 'type' | 'isLocked'>) => void;
  isEditing?: boolean;
  initialData?: DocumentFormValues;
  onEditSave?: (data: Partial<Document>) => void;
}

export default function NewDocumentDialog({ 
    isOpen, 
    onOpenChange, 
    spaceId, 
    spaceMembers, 
    onCreate,
    isEditing = false,
    initialData,
    onEditSave
}: NewDocumentDialogProps) {
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: initialData || {
      name: '',
      access: 'public',
      allowedUserIds: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset(initialData || { name: '', access: 'public', allowedUserIds: [] });
    }
  }, [isOpen, initialData, form]);

  const accessValue = form.watch('access');

  const onSubmit = (values: DocumentFormValues) => {
    const sharingData: Partial<Document> = {
        name: values.name,
        isPublic: values.access === 'public',
        allowedUserIds: values.access === 'private' ? values.allowedUserIds : [],
    };

    if (isEditing && onEditSave) {
        onEditSave(sharingData);
    } else {
        const createData = {
            ...sharingData,
            name: values.name,
            spaceId: spaceId,
        } as Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'content' | 'comments' | 'tags' | 'type' | 'isLocked'>;
        onCreate(createData);
    }
    
    onOpenChange(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Sharing Settings' : 'Create New Document'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update who can access this document.' : 'Fill in the details to create a new document.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q4 Marketing Plan" {...field} disabled={isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="access"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Access</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="public" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Public to everyone in this space
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="private" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Private to specific people
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {accessValue === 'private' && (
              <FormField
                control={form.control}
                name="allowedUserIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Share with</FormLabel>
                    <MemberSelect 
                        allUsers={spaceMembers} 
                        selectedUsers={field.value || []} 
                        onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

function MemberSelect({ allUsers, selectedUsers, onChange }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void }) {
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
                     return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>;
                 }) : "Select users..."}
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
