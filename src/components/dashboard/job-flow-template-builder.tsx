
'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, JobFlowPhase, User } from '@/lib/data';
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
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface JobFlowTemplateBuilderProps {
  templates: JobFlowTemplate[];
  allUsers: User[];
  // onSave: (template: Omit<JobFlowTemplate, 'id' | 'createdAt' | 'createdBy'>) => void;
  // onDelete: (templateId: string) => void;
}

const phaseSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  defaultAssigneeId: z.string().min(1, 'Default assignee is required'),
  taskTitleTemplate: z.string().min(1, 'Task title is required'),
  taskDescriptionTemplate: z.string().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  phases: z.array(phaseSchema).min(1, 'At least one phase is required'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

function TemplateForm({ onSave, onOpenChange, allUsers }: { onSave: (data: any) => void, onOpenChange: (open: boolean) => void, allUsers: User[] }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      phases: [{ name: '', defaultAssigneeId: '', taskTitleTemplate: '', taskDescriptionTemplate: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'phases',
  });
  
  const onSubmit = (data: TemplateFormValues) => {
      console.log(data);
      onOpenChange(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2 rounded-lg border p-4">
               <GripVertical className="h-5 w-5 mt-2 text-muted-foreground" />
               <div className="flex-1 space-y-2">
                    <Input {...register(`phases.${index}.name`)} placeholder="Phase Name (e.g., Kick-off Call)" />
                    {errors.phases?.[index]?.name && <p className="text-sm text-destructive">{errors.phases[index]?.name?.message}</p>}
                    
                    <Controller
                        control={control}
                        name={`phases.${index}.defaultAssigneeId`}
                        render={({ field }) => (
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
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
                    {errors.phases?.[index]?.defaultAssigneeId && <p className="text-sm text-destructive">{errors.phases[index]?.defaultAssigneeId?.message}</p>}

                    <Input {...register(`phases.${index}.taskTitleTemplate`)} placeholder="Task Title Template (e.g., Schedule meeting with {{client}})" />
                     {errors.phases?.[index]?.taskTitleTemplate && <p className="text-sm text-destructive">{errors.phases[index]?.taskTitleTemplate?.message}</p>}
                    <Textarea {...register(`phases.${index}.taskDescriptionTemplate`)} placeholder="Task Description Template" rows={2}/>
               </div>
               <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
               </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ name: '', defaultAssigneeId: '', taskTitleTemplate: '', taskDescriptionTemplate: '' })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Phase
          </Button>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit">Save Template</Button>
      </DialogFooter>
    </form>
  )
}


export default function JobFlowTemplateBuilder({ templates, allUsers }: JobFlowTemplateBuilderProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);

    return (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <Card>
                <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Job Flow Templates</CardTitle>
                        <CardDescription>Create and manage reusable workflows for your team.</CardDescription>
                    </div>
                    <DialogTrigger asChild>
                         <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                    {templates.map(template => (
                    <Card key={template.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{template.name}</CardTitle>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardDescription>{template.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                {template.phases.map((phase, index) => (
                                    <React.Fragment key={phase.id}>
                                        <div className="text-sm font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground">{phase.name}</div>
                                        {index < template.phases.length - 1 && <div className="h-px w-8 bg-border"></div>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    ))}
                    {templates.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No job flow templates</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new template.</p>
                        </div>
                    )}
                </div>
                </CardContent>
            </Card>

            <DialogContent className="sm:max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Create New Job Flow Template</DialogTitle>
                    <DialogDescription>
                        Define the phases and default tasks for a reusable workflow.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="pr-6 -mr-6">
                    <TemplateForm onSave={() => {}} onOpenChange={setIsFormOpen} allUsers={allUsers} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
