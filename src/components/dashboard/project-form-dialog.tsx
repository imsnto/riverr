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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Project, User } from '@/lib/data';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters long.'),
  key: z.string().min(1, 'Key is required').max(5, 'Key must be 5 characters or less').regex(/^[A-Z0-9]+$/, 'Key must be uppercase alphanumeric'),
  members: z.array(z.string()).min(1, 'At least one member is required.'),
  status: z.enum(['Active', 'On Hold', 'Archived']),
  defaultView: z.enum(['board', 'list', 'table']).default('board'),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (project: Omit<Project, 'id' | 'hubId'>, projectId?: string) => void;
  project: Project | null;
  spaceId: string;
  spaceMembers: User[];
}

function generateKey(name: string): string {
    return name
        .split(/\s+/)
        .map(word => word[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 3);
}

export default function ProjectFormDialog({ isOpen, onOpenChange, onSave, project, spaceId, spaceMembers }: ProjectFormDialogProps) {
  const { appUser } = useAuth();
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      key: '',
      members: appUser ? [appUser.id] : [],
      status: 'Active',
      defaultView: 'board',
    },
  });
  
  React.useEffect(() => {
    if (isOpen && appUser) {
      if (project) {
          form.reset({
              name: project.name,
              key: project.key || '',
              members: project.members,
              status: project.status,
              defaultView: project.defaultView || 'board',
          });
      } else {
          form.reset({
              name: '',
              key: '',
              members: [appUser.id],
              status: 'Active',
              defaultView: 'board',
          })
      }
    }
  }, [project, appUser, form, isOpen])

  const onSubmit = (values: ProjectFormValues) => {
    if (!appUser) return;
    
    const projectData = {
        name: values.name,
        key: values.key,
        members: values.members,
        status: values.status,
        defaultView: values.defaultView,
        spaceId: spaceId,
        createdBy: appUser.id,
    };
    
    onSave(projectData, project?.id);
    onOpenChange(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      form.setValue('name', name);
      if (!project && !form.getValues('key')) {
          form.setValue('key', generateKey(name));
      }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{project ? 'Edit Project' : 'Create Project'}</SheetTitle>
          <SheetDescription>
            {project ? 'Update the details for your project.' : 'Fill in the details to create a new project.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Website Redesign" {...field} onChange={handleNameChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Key</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., WR" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>A unique short code for this project's tasks (e.g. XY-1).</FormDescription>
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
                        creatorId={project ? null : appUser?.id || null}
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultView"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default View</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a view" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="board">Kanban Board</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                        <SelectItem value="table">Table View</SelectItem>
                    </SelectContent>
                  </Select>
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
                     return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>
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
