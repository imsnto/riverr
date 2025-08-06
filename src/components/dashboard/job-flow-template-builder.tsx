
'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, User, PhaseTemplate } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MoreHorizontal, Edit, Trash2, LayoutTemplate, FilePlus } from 'lucide-react';
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

interface JobFlowTemplateBuilderProps {
  templates: JobFlowTemplate[];
  phaseTemplates: PhaseTemplate[];
  allUsers: User[];
  onSave: (template: Omit<JobFlowTemplate, 'id'>) => void;
}

const jobFlowPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  // other fields from PhaseTemplate are just for display, not part of the final saved data
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
}: {
  onSave: (data: JobFlowTemplateFormValues) => void;
  closeDialog: () => void;
  phaseTemplates: PhaseTemplate[];
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
    // We need to map the form data (which is simplified) back to the full JobFlowPhase structure.
    const fullPhaseData = data.phases.map((formPhase, index) => {
      const originalTemplate = phaseTemplates.find(p => p.id === formPhase.id);
      if (!originalTemplate) {
        throw new Error(`Could not find original phase template for ${formPhase.name}`);
      }
      return {
        ...originalTemplate,
        phaseIndex: index // Re-assign index based on final order
      };
    });
    
    onSave({ ...data, phases: fullPhaseData });
    closeDialog();
  };
  
  const handleAddPhaseFromTemplate = (template: PhaseTemplate) => {
    append({ id: template.id, name: template.name });
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
        <div className="space-y-3 p-3 border rounded-lg">
           {fields.map((field, index) => (
             <div key={field.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
               <span className="font-medium">{field.name}</span>
               <div className="flex items-center gap-1">
                 <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => move(index, index - 1)}>↑</Button>
                 <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>↓</Button>
                 <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(index)}>
                   <Trash2 className="h-3 w-3 text-destructive" />
                 </Button>
               </div>
             </div>
           ))}
            {errors.phases && <p className="text-sm text-destructive">{errors.phases.message}</p>}

             <Dialog>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="w-full">
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
      </form>
    </Form>
  );
}

export default function JobFlowTemplateBuilder({
  templates,
  phaseTemplates,
  onSave,
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
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
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
