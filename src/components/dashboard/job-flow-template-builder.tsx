
'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, User, PhaseTemplate, TaskTemplate, JobFlowTaskTemplate, JobFlowPhase } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, LayoutTemplate, FilePlus, GripVertical, UserCheck } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormItem, FormLabel } from '../ui/form';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';

interface JobFlowTemplateBuilderProps {
  templates: JobFlowTemplate[];
  phaseTemplates: PhaseTemplate[];
  allUsers: User[];
  onSave: (template: Omit<JobFlowTemplate, 'id'>) => void;
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


const jobFlowPhaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Phase name is required'),
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


const jobFlowTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  phases: z.array(jobFlowPhaseSchema).min(1, 'At least one phase is required'),
  defaultView: z.enum(['kanban', 'stepper', 'list']),
});

type JobFlowTemplateFormValues = z.infer<typeof jobFlowTemplateSchema>;

function TemplateForm({
  onSave,
  closeDialog,
  phaseTemplates,
  allUsers
}: {
  onSave: (data: JobFlowTemplateFormValues) => void;
  closeDialog: () => void;
  phaseTemplates: PhaseTemplate[];
  allUsers: User[];
}) {
  const form = useForm<JobFlowTemplateFormValues>({
    resolver: zodResolver(jobFlowTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      phases: [],
      defaultView: 'kanban',
    },
  });

  const { register, control, handleSubmit, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "phases"
  });

  const onSubmit = (data: JobFlowTemplateFormValues) => {
    const finalData = {
      ...data,
      phases: data.phases.map((phase, index) => ({
        ...phase,
        id: `phase-${Date.now()}-${index}`,
        phaseIndex: index
      }))
    }
    onSave(finalData as Omit<JobFlowTemplate, 'id'>);
    closeDialog();
  };
  
  const handleAddPhaseFromTemplate = (template: PhaseTemplate) => {
    append({ 
        id: template.id, 
        name: template.name,
        tasks: template.tasks,
        requiresReview: template.requiresReview,
        defaultReviewerId: template.defaultReviewerId,
    });
  }

  return (
    <Form {...form}>
      <form id="job-flow-template-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input id="name" {...register('name')} placeholder="e.g., Standard Client Onboarding" />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" {...register('description')} placeholder="A brief description of this workflow." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultView">Default View</Label>
           <Controller
              control={control}
              name="defaultView"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a default view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kanban">Kanban (Horizontal)</SelectItem>
                    <SelectItem value="stepper">Stepper (Vertical)</SelectItem>
                    <SelectItem value="list">List (Table)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
        </div>

        <Separator />
        
        <Label>Phases</Label>
        <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
           {fields.map((field, index) => (
             <PhaseItem key={field.id} control={control} index={index} remove={remove} move={move} allUsers={allUsers} errors={errors} />
           ))}
            {errors.phases && typeof errors.phases.message === 'string' && <p className="text-sm text-destructive">{errors.phases.message}</p>}

            <div className="flex gap-2">
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: `phase-${Date.now()}`, name: 'New Phase', tasks: [{ id: `task-${Date.now()}`, titleTemplate: 'New Task', descriptionTemplate: '', defaultAssigneeId: '', estimatedDurationDays: 1, subtaskTemplates: [] }], requiresReview: false })}
                    className="w-full"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add New Phase
                </Button>
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button type="button" variant="secondary" size="sm" className="w-full">
                            <Plus className="mr-2 h-4 w-4" /> Add Phase From Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Phase From Template</DialogTitle>
                            <DialogDescription>Select a pre-built phase to add to this flow.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-4">
                            {phaseTemplates.map(pt => (
                                <DialogTrigger key={pt.id} asChild>
                                    <button
                                        onClick={() => handleAddPhaseFromTemplate(pt)}
                                        className="w-full text-left p-2 rounded-md hover:bg-accent"
                                    >
                                        <p className="font-semibold">{pt.name}</p>
                                        <p className="text-sm text-muted-foreground">{pt.description}</p>
                                    </button>
                                </DialogTrigger>
                            ))}
                            {phaseTemplates.length === 0 && <p className="text-sm text-muted-foreground text-center">No phase templates found.</p>}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
      </form>
    </Form>
  );
}

const PhaseItem = ({ control, index, remove, move, allUsers, errors }: { control: any, index: number, remove: (index: number) => void, move: (from: number, to: number) => void, allUsers: User[], errors: any }) => {
    const { fields, append, remove: removeTask } = useFieldArray({
        control,
        name: `phases.${index}.tasks`
    });

    const requiresReview = control.watch(`phases.${index}.requiresReview`);

    return (
        <div className="bg-card p-4 rounded-lg border space-y-4">
            <div className="flex items-center gap-2">
                 <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                 <Input {...control.register(`phases.${index}.name`)} placeholder="Phase Name" className="font-semibold text-base border-none p-0 h-auto focus-visible:ring-0" />
                 <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(index)}>
                   <Trash2 className="h-4 w-4 text-destructive" />
                 </Button>
            </div>
             {errors.phases?.[index]?.name && <p className="text-sm text-destructive pl-7">{errors.phases[index].name.message}</p>}

             <div className="pl-7 space-y-3">
                {fields.map((taskField, taskIndex) => (
                    <div key={taskField.id} className="rounded-md border p-3 bg-muted/50 space-y-3 relative">
                        {/* Task Content */}
                        <div className="space-y-1">
                           <Label className="text-xs">Task Title Template</Label>
                           <Input {...control.register(`phases.${index}.tasks.${taskIndex}.titleTemplate`)} placeholder="e.g., Schedule meeting" className="bg-background h-8"/>
                           {errors.phases?.[index]?.tasks?.[taskIndex]?.titleTemplate && <p className="text-sm text-destructive">{errors.phases[index].tasks[taskIndex].titleTemplate.message}</p>}
                       </div>
                        <div className="space-y-1">
                           <Label className="text-xs">Task Description Template (optional)</Label>
                           <Textarea {...control.register(`phases.${index}.tasks.${taskIndex}.descriptionTemplate`)} placeholder="Use variables for dynamic content" className="bg-background" rows={2}/>
                       </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                               <Label className="text-xs">Default Assignee</Label>
                               <Controller
                                   control={control}
                                   name={`phases.${index}.tasks.${taskIndex}.defaultAssigneeId`}
                                   render={({ field }) => (
                                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                                           <SelectTrigger className="bg-background h-8">
                                               <SelectValue placeholder="Select an assignee" />
                                           </SelectTrigger>
                                           <SelectContent>
                                               {allUsers.map(user => (
                                                   <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                               ))}
                                           </SelectContent>
                                   </Select>
                                   )}
                               />
                               {errors.phases?.[index]?.tasks?.[taskIndex]?.defaultAssigneeId && <p className="text-sm text-destructive">{errors.phases[index].tasks[taskIndex].defaultAssigneeId.message}</p>}
                           </div>
                           <div className="space-y-1">
                               <Label className="text-xs">Duration (days)</Label>
                               <Input 
                                   type="number"
                                   {...control.register(`phases.${index}.tasks.${taskIndex}.estimatedDurationDays`)}
                                   placeholder="e.g., 5"
                                   className="bg-background h-8"
                                   min="1"
                               />
                               {errors.phases?.[index]?.tasks?.[taskIndex]?.estimatedDurationDays && <p className="text-sm text-destructive">{errors.phases[index].tasks[taskIndex].estimatedDurationDays.message}</p>}
                           </div>
                       </div>

                       <Separator className="my-2" />
                       <Subtasks control={control} taskIndex={taskIndex} allUsers={allUsers} errors={errors} phaseIndex={index} />
                       
                       <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(taskIndex)} className="absolute -top-2 -right-2 h-6 w-6">
                           <Trash2 className="h-3 w-3 text-destructive" />
                       </Button>
                   </div>
                ))}
                {errors.phases?.[index]?.tasks && typeof errors.phases[index].tasks.message === 'string' && (
                     <p className="text-sm text-destructive">{errors.phases[index].tasks.message}</p>
                 )}

                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: `task-${Date.now()}`, titleTemplate: '', defaultAssigneeId: '', estimatedDurationDays: 1, subtaskTemplates: [] })}
                    className="w-full"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
             </div>
              <div className="space-y-2">
                  <Controller
                      control={control}
                      name={`phases.${index}.requiresReview`}
                      render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-background">
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
                      <Controller
                          control={control}
                          name={`phases.${index}.defaultReviewerId`}
                          render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a reviewer" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allUsers.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.phases?.[index]?.defaultReviewerId && <p className="text-sm text-destructive">{errors.phases[index].defaultReviewerId.message}</p>}
                            </FormItem>
                          )}
                      />
                  )}
              </div>
        </div>
    )
}


const Subtasks = ({ control, taskIndex, allUsers, errors, phaseIndex }: { control: any; taskIndex: number; allUsers: User[], errors: any, phaseIndex: number }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates`,
    });

    return (
        <div className="space-y-2 pl-4 border-l-2">
            <Label className="text-xs">Subtask Templates</Label>
            {fields.map((subtaskField, subtaskIndex) => (
                <div key={subtaskField.id} className="space-y-2 p-2 border rounded-md bg-background">
                    <div className="flex items-start gap-2">
                        <Input
                            {...control.register(`phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.titleTemplate`)}
                            placeholder="e.g., Send follow-up email"
                            className="bg-background h-8 flex-1"
                        />
                        <Input 
                            type="number"
                            {...control.register(`phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.estimatedDurationDays`)}
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
                            name={`phases.${phaseIndex}.tasks.${taskIndex}.subtaskTemplates.${subtaskIndex}.defaultAssigneeId`}
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
                        {errors.phases?.[phaseIndex]?.tasks?.[taskIndex]?.subtaskTemplates?.[subtaskIndex]?.defaultAssigneeId && (
                            <p className="text-sm text-destructive">{errors.phases[phaseIndex].tasks[taskIndex].subtaskTemplates[subtaskIndex].defaultAssigneeId.message}</p>
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


export default function JobFlowTemplateBuilder({
  templates,
  phaseTemplates,
  onSave,
  allUsers,
}: JobFlowTemplateBuilderProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = (data: JobFlowTemplateFormValues) => {
    onSave(data as Omit<JobFlowTemplate, 'id'>);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Job Flow Templates</CardTitle>
              <CardDescription>Create and manage reusable end-to-end workflows.</CardDescription>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Flow Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templates.map((template) => (
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
                   <div className="flex items-center gap-2 pt-2">
                        <Badge variant="outline">{template.defaultView}</Badge>
                        <Badge variant="secondary">{template.phases.length} phases</Badge>
                   </div>
                </CardHeader>
              </Card>
            ))}
            {templates.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No flow templates</h3>
                <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new template.</p>
                <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Flow Template
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
              Assemble a sequence of phases to build a complete workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <TemplateForm
              onSave={handleSave}
              closeDialog={() => setIsFormOpen(false)}
              phaseTemplates={phaseTemplates}
              allUsers={allUsers}
            />
          </div>
          <DialogFooter className="p-6 pt-4 border-t bg-muted/50">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="job-flow-template-form">Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
