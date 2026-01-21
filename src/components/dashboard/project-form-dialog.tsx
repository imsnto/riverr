
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
  members: z.array(z.string()).min(1, 'At least one member is required.'),
  status: z.enum(['Active', 'On Hold', 'Archived']),
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

export default function ProjectFormDialog({ isOpen, onOpenChange, onSave, project, spaceId, spaceMembers }: ProjectFormDialogProps) {
  const { appUser } = useAuth();
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      members: appUser ? [appUser.id] : [],
      status: 'Active',
    },
  });
  
  React.useEffect(() => {
    if (isOpen && appUser) {
      if (project) {
          form.reset({
              name: project.name,
              members: project.members,
              status: project.status,
          });
      } else {
          form.reset({
              name: '',
              members: [appUser.id],
              status: 'Active'
          })
      }
    }
  }, [project, appUser, form, isOpen])

  const onSubmit = (values: ProjectFormValues) => {
    if (!appUser) return;
    
    const projectData = {
        ...values,
        space_id: spaceId,
        created_by: appUser.id,
    };
    
    onSave(projectData, project?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Create Project'}</DialogTitle>
          <DialogDescription>
            {project ? 'Update the details for your project.' : 'Fill in the details to create a new project.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Website Redesign" {...field} />
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
                <CommandEmpty>No spaces found.</CommandEmpty>
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
