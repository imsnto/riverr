
'use client';

import React, { useState } from 'react';
import { User, TaskTemplate, JobFlowSubtaskTemplate } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, FilePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/hooks/use-auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form } from '../ui/form';
import { Separator } from '../ui/separator';

interface TaskTemplateBuilderProps {
  templates: TaskTemplate[];
  allUsers: User[];
  onSave: (template: Omit<TaskTemplate, 'id'>) => void;
}

const subtaskTemplateSchema = z.object({
  id: z.string().optional(),
  titleTemplate: z.string().min(1, 'Subtask title cannot be empty'),
  defaultAssigneeId: z.string().min(1, "Assignee is required"),
  estimatedDurationDays: z.coerce.number().min(0, "Duration must be positive").default(0),
});

const taskTemplateSchema = z.object({
  titleTemplate: z.string().min(1, 'Task title is required'),
  descriptionTemplate: z.string().optional(),
  defaultAssigneeId: z.string().min(1, 'Default assignee is required'),
  estimatedDurationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
});

type TaskTemplateFormValues = z.infer<typeof taskTemplateSchema>;

function TemplateForm({ onSave, allUsers, closeDialog }: { onSave: (data: TaskTemplateFormValues) => void, allUsers: User[], closeDialog: () => void }) {
  const form = useForm<TaskTemplateFormValues>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: {
      titleTemplate: '',
      descriptionTemplate: '',
      defaultAssigneeId: '',
      estimatedDurationDays: 1,
      subtaskTemplates: [],
    },
  });

  const { register, control, handleSubmit, formState: { errors } } = form;
  
  const onSubmit = (data: TaskTemplateFormValues) => {
      onSave(data);
      closeDialog();
  }

  return (
    <Form {...form}>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
            <div className="space-y-1">
                <Label className="text-sm">Task Title Template</Label>
                <Input {...register('titleTemplate')} placeholder="e.g., Prepare report for {{client_name}}" className="bg-background"/>
                {errors.titleTemplate && <p className="text-sm text-destructive">{errors.titleTemplate.message}</p>}
            </div>
            <div className="space-y-1">
                <Label className="text-sm">Task Description Template (optional)</Label>
                <Textarea {...register('descriptionTemplate')} placeholder="Use variables for dynamic content" className="bg-background" rows={2}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label className="text-sm">Default Assignee</Label>
                    <Controller
                        control={control}
                        name="defaultAssigneeId"
                        render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select a default assignee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allUsers.map(user => (
                                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                    ))}
                                </SelectContent>
                        </Select>
                        )}
                    />
                    {errors.defaultAssigneeId && <p className="text-sm text-destructive">{errors.defaultAssigneeId.message}</p>}
                </div>
                <div className="space-y-1">
                    <Label className="text-sm">Duration (days)</Label>
                    <Input 
                        type="number"
                        {...register('estimatedDurationDays')}
                        placeholder="e.g., 5"
                        className="bg-background"
                        min="1"
                    />
                    {errors.estimatedDurationDays && <p className="text-sm text-destructive">{errors.estimatedDurationDays.message}</p>}
                </div>
            </div>
            
            <Separator className="my-2" />
            <Subtasks control={control} allUsers={allUsers} errors={errors} />
        </div>
        <DialogFooter className="p-6 pt-4 border-t bg-background sticky bottom-0">
            <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button type="submit">Save Template</Button>
        </DialogFooter>
    </form>
    </Form>
  )
}

const Subtasks = ({ control, allUsers, errors }: { control: any; allUsers: User[], errors: any }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `subtaskTemplates`,
    });

    return (
        <div className="space-y-2 pl-4 border-l-2">
            <Label className="text-xs">Subtask Templates</Label>
            {fields.map((subtaskField, subtaskIndex) => (
                <div key={subtaskField.id} className="space-y-2 p-2 border rounded-md bg-background">
                    <div className="flex items-start gap-2">
                        <Input
                            {...control.register(`subtaskTemplates.${subtaskIndex}.titleTemplate`)}
                            placeholder="e.g., Gather analytics data"
                            className="bg-background h-8 flex-1"
                        />
                        <Input 
                            type="number"
                            {...control.register(`subtaskTemplates.${subtaskIndex}.estimatedDurationDays`)}
                            placeholder="Days"
                            className="bg-background h-8 w-20"
                            min="0"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(subtaskIndex)} className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                    <div>
                         <Controller
                            control={control}
                            name={`subtaskTemplates.${subtaskIndex}.defaultAssigneeId`}
                            render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger className="bg-muted/50 h-8 text-xs">
                                        <SelectValue placeholder="Assign subtask..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                            </Select>
                            )}
                        />
                        {errors.subtaskTemplates?.[subtaskIndex]?.defaultAssigneeId && (
                            <p className="text-sm text-destructive">{errors.subtaskTemplates[subtaskIndex]?.defaultAssigneeId?.message}</p>
                        )}
                    </div>
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8"
                onClick={() => append({ id: `subtask-${Date.now()}`, titleTemplate: '', defaultAssigneeId: '', estimatedDurationDays: 0 })}
            >
                <Plus className="mr-2 h-4 w-4" /> Add Subtask Template
            </Button>
        </div>
    );
};


export default function TaskTemplateBuilder({ templates, allUsers, onSave }: TaskTemplateBuilderProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const handleSave = (data: TaskTemplateFormValues) => {
        onSave({ ...data, id: `task-tpl-${Date.now()}` });
    }
    
    return (
        <>
            <Card>
                <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Task Templates</CardTitle>
                        <CardDescription>Create and manage reusable tasks for your phases and flows.</CardDescription>
                    </div>
                     <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Task Template
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                    {templates.map(template => (
                    <Card key={template.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{template.titleTemplate}</CardTitle>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem disabled>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <CardDescription>{template.descriptionTemplate}</CardDescription>
                        </CardHeader>
                    </Card>
                    ))}
                    {templates.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold text-foreground">No task templates</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new template.</p>
                             <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Task Template
                            </Button>
                        </div>
                    )}
                </div>
                </CardContent>
            </Card>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Create New Task Template</DialogTitle>
                        <DialogDescription>
                            Define a reusable task with its own subtasks.
                        </DialogDescription>
                    </DialogHeader>
                    <TemplateForm onSave={handleSave} allUsers={allUsers} closeDialog={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </>
    );
}


    