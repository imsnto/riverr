
'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, JobFlowPhase, User, Space } from '@/lib/data';
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
import LaunchJobDialog from './launch-job-dialog';

interface JobFlowTemplateBuilderProps {
  templates: JobFlowTemplate[];
  allUsers: User[];
  onSave: (template: JobFlowTemplate) => void;
  activeSpace: Space;
  // onDelete: (templateId: string) => void;
}

const phaseSchema = z.object({
  id: z.string().optional(),
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

function TemplateForm({ onSave, allUsers, closeDialog }: { onSave: (data: TemplateFormValues) => void, allUsers: User[], closeDialog: () => void }) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      phases: [{ id: `phase-${Date.now()}`, name: '', defaultAssigneeId: '', taskTitleTemplate: '', taskDescriptionTemplate: '' }],
    },
  });

  const { register, control, handleSubmit, formState: { errors } } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'phases',
  });
  
  const onSubmit = (data: TemplateFormValues) => {
      onSave(data);
      closeDialog();
  }

  return (
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
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2 rounded-lg border p-4 bg-background">
               <GripVertical className="h-5 w-5 mt-8 text-muted-foreground" />
               <div className="flex-1 space-y-2">
                    <Label>Phase Name</Label>
                    <Input {...register(`phases.${index}.name`)} placeholder="e.g., Kick-off Call" />
                    {errors.phases?.[index]?.name && <p className="text-sm text-destructive">{errors.phases[index]?.name?.message}</p>}
                    
                    <Label>Default Assignee</Label>
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
                    
                    <Label>Task Title Template</Label>
                    <Input {...register(`phases.${index}.taskTitleTemplate`)} placeholder="e.g., Schedule meeting with {{job_name}}" />
                     {errors.phases?.[index]?.taskTitleTemplate && <p className="text-sm text-destructive">{errors.phases[index]?.taskTitleTemplate?.message}</p>}
                    
                    <Label>Task Description Template</Label>
                    <Textarea {...register(`phases.${index}.taskDescriptionTemplate`)} placeholder="Task Description Template (optional)" rows={2}/>
               </div>
               <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-6">
                    <Trash2 className="h-4 w-4 text-destructive" />
               </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ id: `phase-${Date.now()}`, name: '', defaultAssigneeId: '', taskTitleTemplate: '', taskDescriptionTemplate: '' })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Phase
          </Button>
        </div>
      </div>
    </form>
  )
}


export default function JobFlowTemplateBuilder({ templates, allUsers, onSave, activeSpace }: JobFlowTemplateBuilderProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLaunchOpen, setIsLaunchOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<JobFlowTemplate | null>(null);

    const handleSave = (data: TemplateFormValues) => {
        const { appUser } = useAuth();
        if (!appUser) return;

        const newTemplate: JobFlowTemplate = {
            ...data,
            id: `jft-${Date.now()}`,
            createdBy: appUser.id,
            createdAt: new Date().toISOString(),
            phases: data.phases.map((phase, index) => ({
                ...phase,
                id: phase.id || `phase-${Date.now()}-${index}`,
                phaseIndex: index
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
                />
            )}
        </>
    );
}
