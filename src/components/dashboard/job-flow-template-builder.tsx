

'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, JobFlowPhase, User, Space, JobFlowTaskTemplate, JobFlowSubtaskTemplate } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, GripVertical, FilePlus, Rocket } from 'lucide-react';
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
import LaunchJobDialog from './launch-job-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';
import { Form, FormControl, FormItem, FormLabel } from '../ui/form';
import { Separator } from '../ui/separator';

interface JobFlowTemplateBuilderProps {
  templates: JobFlowTemplate[];
  allUsers: User[];
  onSave: (template: JobFlowTemplate) => void;
  activeSpace: Space;
  onJobLaunched: () => void;
}

const subtaskTemplateSchema = z.object({
  id: z.string().optional(),
  titleTemplate: z.string().min(1, 'Subtask title cannot be empty'),
});

const taskTemplateSchema = z.object({
  id: z.string().optional(),
  titleTemplate: z.string().min(1, 'Task title is required'),
  descriptionTemplate: z.string().optional(),
  defaultAssigneeId: z.string().min(1, 'Default assignee is required'),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
});

const phaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Phase name is required'),
  tasks: z.array(taskTemplateSchema).min(1, 'At least one task is required per phase'),
  requiresReview: z.boolean().default(false),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  phases: z.array(phaseSchema).min(1, 'At least one phase is required'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

function TemplateForm({ onSave, allUsers, closeDialog }: { onSave: (data: TemplateFormValues) => void, allUsers: User[], closeDialog: () => void }) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      phases: [{ 
        id: `phase-${Date.now()}`, 
        name: '', 
        tasks: [{ id: `task-${Date.now()}`, titleTemplate: '', descriptionTemplate: '', defaultAssigneeId: '', subtaskTemplates: [] }],
        requiresReview: false 
      }],
    },
  });

  const { register, control, handleSubmit, formState: { errors } } = form;

  const { fields: phaseFields, append: appendPhase, remove: removePhase } = useFieldArray({
    control,
    name: 'phases',
  });
  
  const onSubmit = (data: TemplateFormValues) => {
      onSave(data);
      closeDialog();
  }

  return (
    <Form {...form}>
    <form id="template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
       <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g., Client Onboarding" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register('description')} placeholder="A brief description of what this flow is for." />
      </div>

      <div>
        <Label>Phases</Label>
        <div className="space-y-4 mt-2">
          {phaseFields.map((phaseField, phaseIndex) => (
            <div key={phaseField.id} className="flex items-start gap-2 rounded-lg border p-4 bg-background">
               <GripVertical className="h-5 w-5 mt-8 text-muted-foreground" />
               <div className="flex-1 space-y-4">
                    <div>
                        <Label>Phase Name</Label>
                        <Input {...register(`phases.${phaseIndex}.name`)} placeholder="e.g., Kick-off Call" />
                        {errors.phases?.[phaseIndex]?.name && <p className="text-sm text-destructive">{errors.phases[phaseIndex]?.name?.message}</p>}
                    </div>

                    <Separator />
                    <Label>Tasks in this phase</Label>
                    <PhaseTasks control={control} phaseIndex={phaseIndex} allUsers={allUsers} errors={errors} />
                    
                    <div className="pt-4">
                        <Controller
                            control={control}
                            name={`phases.${phaseIndex}.requiresReview`}
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
                    </div>

               </div>
               <Button type="button" variant="ghost" size="icon" onClick={() => removePhase(phaseIndex)} className="mt-6">
                    <Trash2 className="h-4 w-4 text-destructive" />
               </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => appendPhase({ id: `phase-${Date.now()}`, name: '', tasks: [{id: `task-${Date.now()}`, titleTemplate: '', defaultAssigneeId: '', subtaskTemplates: []}], requiresReview: false })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Phase
          </Button>
        </div>
      </div>
    </form>
    </Form>
  )
}

const PhaseTasks = ({ control, phaseIndex, allUsers, errors }: { control: any, phaseIndex: number, allUsers: User[], errors: any }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `phases.${phaseIndex}.tasks`
    });

    return (
        <div className="space-y-3">
            {fields.map((taskField, taskIndex) => (
                 <div key={taskField.id} className="rounded-md border p-3 bg-muted/50 space-y-3 relative">
                     <div className="space-y-1">
                        <Label className="text-xs">Task Title Template</Label>
                        <Input {...control.register(`phases.${phaseIndex}.tasks.${taskIndex}.titleTemplate`)} placeholder="e.g., Schedule meeting with {{job_name}}" className="bg-background h-8"/>
                        {errors.phases?.[phaseIndex]?.tasks?.[taskIndex]?.titleTemplate && <p className="text-sm text-destructive">{errors.phases[phaseIndex]?.tasks[taskIndex]?.titleTemplate?.message}</p>}
                    </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Task Description Template (optional)</Label>
                        <Textarea {...control.register(`phases.${phaseIndex}.tasks.${taskIndex}.descriptionTemplate`)} placeholder="Use {{job_name}} for dynamic job name" className="bg-background" rows={2}/>
                    </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Default Assignee</Label>
                        <Controller
                            control={control}
                            name={`phases.${phaseIndex}.tasks.${taskIndex}.defaultAssigneeId`}
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
                        {errors.phases?.[phaseIndex]?.tasks?.[taskIndex]?.defaultAssigneeId && <p className="text-sm text-destructive">{errors.phases[phaseIndex]?.tasks[taskIndex]?.defaultAssigneeId?.message}</p>}
                    </div>
                    
                    <Separator className="my-2" />
                    <Subtasks control={control} phaseIndex={phaseIndex} taskIndex={taskIndex} errors={errors} />


                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(taskIndex)} className="absolute -top-2 -right-2 h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ id: `task-${Date.now()}`, titleTemplate: '', defaultAssigneeId: '', subtaskTemplates: [] })}
                className="w-full"
            >
                <Plus className="mr-2 h-4 w-4" /> Add Task to Phase
            </Button>
        </div>
    )
}

const Subtasks = ({ control, phaseIndex, taskIndex, errors }: { control: any; phaseIndex: number; taskIndex: number; errors: any }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates`,
    });

    return (
        <div className="space-y-2 pl-4 border-l-2">
            <Label className="text-xs">Subtask Templates</Label>
            {fields.map((subtaskField, subtaskIndex) => (
                <div key={subtaskField.id} className="flex items-center gap-2">
                    <Input
                        {...control.register(`phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.titleTemplate`)}
                        placeholder="e.g., Send follow-up email"
                        className="bg-background h-8"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(subtaskIndex)} className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8"
                onClick={() => append({ id: `subtask-${Date.now()}`, titleTemplate: '' })}
            >
                <Plus className="mr-2 h-4 w-4" /> Add Subtask Template
            </Button>
        </div>
    );
};


export default function JobFlowTemplateBuilder({ templates, allUsers, onSave, activeSpace, onJobLaunched }: JobFlowTemplateBuilderProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLaunchOpen, setIsLaunchOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<JobFlowTemplate | null>(null);
    const { appUser } = useAuth();


    const handleSave = (data: TemplateFormValues) => {
        if (!appUser) return;

        const newTemplate: JobFlowTemplate = {
            ...data,
            id: `jft-${Date.now()}`,
            createdBy: appUser.id,
            createdAt: new Date().toISOString(),
            phases: data.phases.map((phase, index) => ({
                ...phase,
                id: phase.id || `phase-${Date.now()}-${index}`,
                phaseIndex: index,
                tasks: phase.tasks.map((task, taskIndex) => ({
                    ...task,
                    id: task.id || `task-template-${Date.now()}-${taskIndex}`,
                    subtaskTemplates: (task.subtaskTemplates || []).map((sub, subIndex) => ({
                        ...sub,
                        id: sub.id || `subtask-template-${Date.now()}-${subIndex}`
                    })),
                })),
                requiresReview: phase.requiresReview || false,
            })),
        };
        onSave(newTemplate);
    }
    
    const handleLaunchClick = (template: JobFlowTemplate) => {
        setSelectedTemplate(template);
        setIsLaunchOpen(true);
    }

    return (
        <>
            <Card>
                <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Job Flow Templates</CardTitle>
                        <CardDescription>Create and manage reusable workflows for your team.</CardDescription>
                    </div>
                     <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Template
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                    {templates.map(template => (
                    <Card key={template.id} className="overflow-hidden">
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
                        <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {template.phases.map((phase, index) => (
                                    <React.Fragment key={phase.id}>
                                        <div className="truncate">{phase.name}</div>
                                        {index < template.phases.length - 1 && <div className="h-px w-8 bg-border"></div>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 px-6 py-3">
                             <Button size="sm" onClick={() => handleLaunchClick(template)}>
                                <Rocket className="mr-2 h-4 w-4" />
                                Launch Job
                            </Button>
                        </CardFooter>
                    </Card>
                    ))}
                    {templates.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold text-foreground">No job flow templates</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new template.</p>
                             <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Template
                            </Button>
                        </div>
                    )}
                </div>
                </CardContent>
            </Card>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Create New Job Flow Template</DialogTitle>
                        <DialogDescription>
                            Define the phases and default tasks for a reusable workflow.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6">
                      <TemplateForm onSave={handleSave} allUsers={allUsers} closeDialog={() => setIsFormOpen(false)} />
                    </div>
                     <DialogFooter className="p-6 pt-4 border-t bg-muted/50">
                        <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                        <Button type="submit" form="template-form">Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {selectedTemplate && (
                 <LaunchJobDialog 
                    isOpen={isLaunchOpen}
                    onOpenChange={setIsLaunchOpen}
                    template={selectedTemplate}
                    allUsers={allUsers}
                    activeSpace={activeSpace}
                    onJobLaunched={onJobLaunched}
                />
            )}
        </>
    );
}
