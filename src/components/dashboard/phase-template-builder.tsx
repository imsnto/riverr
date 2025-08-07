
'use client';

import React, { useState } from 'react';
import { PhaseTemplate, User, TaskTemplate, JobFlowTaskTemplate, JobFlowSubtaskTemplate } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, GripVertical, FilePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from '../ui/checkbox';
import { Form, FormControl, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Separator } from '../ui/separator';

interface PhaseTemplateBuilderProps {
  templates: PhaseTemplate[];
  allUsers: User[];
  onSave: (template: Omit<PhaseTemplate, 'id'>) => void;
  taskTemplates: TaskTemplate[];
}

const subtaskTemplateSchema = z.object({
  id: z.string().optional(),
  titleTemplate: z.string().min(1, 'Subtask title cannot be empty'),
  defaultAssigneeId: z.string().min(1, "Assignee is required"),
  estimatedDurationDays: z.coerce.number().min(0, "Duration must be positive").default(0),
});

const taskTemplateSchema = z.object({
  id: z.string().optional(),
  titleTemplate: z.string().min(1, 'Task title is required'),
  descriptionTemplate: z.string().optional(),
  defaultAssigneeId: z.string().min(1, 'Default assignee is required'),
  estimatedDurationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
});

const phaseTemplateSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  description: z.string().optional(),
  tasks: z.array(taskTemplateSchema).min(1, 'At least one task is required'),
  requiresReview: z.boolean().default(false),
  defaultReviewerId: z.string().optional(),
}).refine(data => {
    if (data.requiresReview && !data.defaultReviewerId) {
        return false;
    }
    return true;
}, {
    message: "A reviewer must be selected when 'Requires Review' is checked.",
    path: ["defaultReviewerId"],
});

type PhaseTemplateFormValues = z.infer<typeof phaseTemplateSchema>;

function TemplateForm({ onSave, allUsers, closeDialog, taskTemplates }: { onSave: (data: PhaseTemplateFormValues) => void, allUsers: User[], closeDialog: () => void, taskTemplates: TaskTemplate[] }) {
  const form = useForm<PhaseTemplateFormValues>({
    resolver: zodResolver(phaseTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      tasks: [{ id: `task-${Date.now()}`, titleTemplate: '', descriptionTemplate: '', defaultAssigneeId: '', estimatedDurationDays: 1, subtaskTemplates: [] }],
      requiresReview: false,
    },
  });

  const { register, control, handleSubmit, watch, formState: { errors } } = form;
  const requiresReview = watch('requiresReview');
  
  const onSubmit = (data: PhaseTemplateFormValues) => {
      onSave(data);
      closeDialog();
  }

  return (
    <Form {...form}>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 flex flex-col overflow-hidden">
       <div className="flex-1 overflow-y-auto px-6 space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Phase Template Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g., Client Kick-off" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register('description')} placeholder="A brief description of this phase." />
            </div>

            <Separator />
            
            <Label>Tasks in this phase</Label>
            <PhaseTasks control={control} allUsers={allUsers} errors={errors} taskTemplates={taskTemplates} />
            
            <div className="pt-4 space-y-2">
                <Controller
                    control={control}
                    name={`requiresReview`}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Requires Review
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                    If checked, this phase must be manually approved before the flow can continue.
                                </p>
                            </div>
                        </FormItem>
                    )}
                />
                {requiresReview && (
                    <FormField
                        control={form.control}
                        name="defaultReviewerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default Reviewer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a default reviewer" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
        </div>
        <DialogFooter className="p-6 pt-4 border-t bg-background sticky bottom-0">
            <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button type="submit">Save Template</Button>
        </DialogFooter>
    </form>
    </Form>
  )
}

const PhaseTasks = ({ control, allUsers, errors, taskTemplates }: { control: any, allUsers: User[], errors: any, taskTemplates: TaskTemplate[] }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `tasks`
    });

    const handleAddTaskFromTemplate = (template: TaskTemplate) => {
        append({
            id: `task-${Date.now()}`,
            titleTemplate: template.titleTemplate,
            descriptionTemplate: template.descriptionTemplate || '',
            defaultAssigneeId: template.defaultAssigneeId,
            estimatedDurationDays: template.estimatedDurationDays,
            subtaskTemplates: template.subtaskTemplates || []
        });
    }

    return (
        <div className="space-y-3">
            {fields.map((taskField, taskIndex) => (
                 <div key={taskField.id} className="rounded-md border p-3 bg-muted/50 space-y-3 relative">
                     <div className="space-y-1">
                        <Label className="text-xs">Task Title Template</Label>
                        <Input {...control.register(`tasks.${taskIndex}.titleTemplate`)} placeholder="e.g., Schedule meeting" className="bg-background h-8"/>
                        {errors.tasks?.[taskIndex]?.titleTemplate && <p className="text-sm text-destructive">{errors.tasks[taskIndex]?.titleTemplate?.message}</p>}
                    </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Task Description Template (optional)</Label>
                        <Textarea {...control.register(`tasks.${taskIndex}.descriptionTemplate`)} placeholder="Use variables if needed" className="bg-background" rows={2}/>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Default Assignee</Label>
                            <Controller
                                control={control}
                                name={`tasks.${taskIndex}.defaultAssigneeId`}
                                render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger className="bg-background h-8">
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
                            {errors.tasks?.[taskIndex]?.defaultAssigneeId && <p className="text-sm text-destructive">{errors.tasks[taskIndex]?.defaultAssigneeId?.message}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Duration (days)</Label>
                            <Input 
                                type="number"
                                {...control.register(`tasks.${taskIndex}.estimatedDurationDays`)}
                                placeholder="e.g., 5"
                                className="bg-background h-8"
                                min="1"
                            />
                            {errors.tasks?.[taskIndex]?.estimatedDurationDays && <p className="text-sm text-destructive">{errors.tasks[taskIndex]?.estimatedDurationDays?.message}</p>}
                        </div>
                    </div>
                    
                    <Separator className="my-2" />
                    <Subtasks control={control} taskIndex={taskIndex} allUsers={allUsers} errors={errors} />


                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(taskIndex)} className="absolute -top-2 -right-2 h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: `task-${Date.now()}`, titleTemplate: '', defaultAssigneeId: '', estimatedDurationDays: 1, subtaskTemplates: [] })}
                    className="w-full"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add New Task
                </Button>
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button type="button" variant="secondary" size="sm" className="w-full">
                            <Plus className="mr-2 h-4 w-4" /> Add Task From Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Task From Template</DialogTitle>
                            <DialogDescription>Select a pre-built task to add to this phase.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            {taskTemplates.map(tt => (
                                <DialogTrigger asChild key={tt.id}>
                                <button
                                    onClick={() => handleAddTaskFromTemplate(tt)}
                                    className="w-full text-left p-2 rounded-md hover:bg-accent"
                                >
                                    <p className="font-semibold">{tt.titleTemplate}</p>
                                    <p className="text-sm text-muted-foreground">{tt.descriptionTemplate}</p>
                                </button>
                                </DialogTrigger>
                            ))}
                            {taskTemplates.length === 0 && <p className="text-sm text-muted-foreground text-center">No task templates found.</p>}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}

const Subtasks = ({ control, taskIndex, allUsers, errors }: { control: any; taskIndex: number; allUsers: User[], errors: any }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `tasks.${taskIndex}.subtaskTemplates`,
    });

    return (
        <div className="space-y-2 pl-4 border-l-2">
            <Label className="text-xs">Subtask Templates</Label>
            {fields.map((subtaskField, subtaskIndex) => (
                <div key={subtaskField.id} className="space-y-2 p-2 border rounded-md bg-background">
                    <div className="flex items-start gap-2">
                        <Input
                            {...control.register(`tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.titleTemplate`)}
                            placeholder="e.g., Send follow-up email"
                            className="bg-background h-8 flex-1"
                        />
                        <Input 
                            type="number"
                            {...control.register(`tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.estimatedDurationDays`)}
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
                            name={`tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.defaultAssigneeId`}
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
                        {errors.tasks?.[taskIndex]?.subtaskTemplates?.[subtaskIndex]?.defaultAssigneeId && (
                            <p className="text-sm text-destructive">{errors.tasks[taskIndex]?.subtaskTemplates[subtaskIndex]?.defaultAssigneeId?.message}</p>
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


export default function PhaseTemplateBuilder({ templates, allUsers, onSave, taskTemplates }: PhaseTemplateBuilderProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const handleSave = (data: PhaseTemplateFormValues) => {
        onSave(data);
    }
    
    return (
        <>
            <Card>
                <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Phase Templates</CardTitle>
                        <CardDescription>Create and manage reusable phases for your job flows.</CardDescription>
                    </div>
                     <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Phase Template
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                    {templates.map(template => (
                    <Card key={template.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{template.name}</CardTitle>
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
                            <CardDescription>{template.description}</CardDescription>
                        </CardHeader>
                    </Card>
                    ))}
                    {templates.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold text-foreground">No phase templates</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new template.</p>
                             <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Phase Template
                            </Button>
                        </div>
                    )}
                </div>
                </CardContent>
            </Card>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Create New Phase Template</DialogTitle>
                        <DialogDescription>
                            Define the tasks for a reusable workflow phase.
                        </DialogDescription>
                    </DialogHeader>
                    <TemplateForm onSave={handleSave} allUsers={allUsers} closeDialog={() => setIsFormOpen(false)} taskTemplates={taskTemplates} />
                </DialogContent>
            </Dialog>
        </>
    );
}

  

    