
'use client';

import React from 'react';
import { Job, JobFlowTemplate, Task, JobFlowTask, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Check, Circle, Loader2, ChevronsRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

interface StepperJobViewProps {
  template: JobFlowTemplate;
  jobs: Job[];
  tasks: Task[];
  jobFlowTasks: JobFlowTask[];
  allUsers: User[];
  onJobClick: (job: Job) => void;
  onUpdateTask: (task: Task) => void;
  onTaskSelect: (task: Task) => void;
}

export default function StepperJobView({ template, jobs, tasks, jobFlowTasks, allUsers, onJobClick, onUpdateTask, onTaskSelect }: StepperJobViewProps) {
    
  const handleUpdateTaskStatus = (task: Task, isComplete: boolean) => {
    const newStatus = isComplete ? 'Done' : 'Pending';
    onUpdateTask({ ...task, status: newStatus });
  }

  return (
    <div className="space-y-4">
      {jobs.map(job => {
        const currentPhase = template.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
        const tasksForJobInPhase = jobFlowTasks
            .filter(jft => jft.jobId === job.id && jft.phaseIndex === job.currentPhaseIndex)
            .map(jft => tasks.find(t => t.id === jft.taskId))
            .filter((t): t is Task => !!t);
        
        const isJobCompleted = job.status === 'completed';

        if (isJobCompleted) {
             return (
                 <Card key={job.id}>
                    <div className="flex justify-between items-center w-full p-4">
                        <div className="flex flex-col text-left">
                            <h3 className="font-semibold text-lg line-through text-muted-foreground">{job.name}</h3>
                             <Badge variant="secondary" className="w-fit mt-1 flex items-center gap-1.5 bg-green-100 text-green-800">
                                <CheckCircle2 className="h-4 w-4" />
                                Completed
                            </Badge>
                        </div>
                         <Button onClick={() => onJobClick(job)} variant="outline">View Details</Button>
                    </div>
                </Card>
             )
        }

        return (
          <Card key={job.id}>
             <Accordion type="single" collapsible defaultValue="item-1">
              <AccordionItem value="item-1">
                <div className="flex justify-between items-center w-full p-4">
                    <AccordionTrigger className="p-0 hover:no-underline flex-1">
                        <div className="flex flex-col text-left">
                            <h3 className="font-semibold text-lg">{job.name}</h3>
                            <p className="text-sm text-muted-foreground">
                                Current Phase: <span className="font-medium text-primary">{currentPhase?.name || 'N/A'}</span>
                            </p>
                        </div>
                    </AccordionTrigger>
                    <Button onClick={() => onJobClick(job)} className="ml-4">View Details</Button>
                </div>
                <AccordionContent className="p-4 pt-0">
                    <div className="space-y-2">
                        {tasksForJobInPhase.length > 0 ? tasksForJobInPhase.map(task => {
                            const assignee = allUsers.find(u => u.id === task.assigned_to);
                            const isComplete = task.status === 'Done';
                            return (
                                <div key={task.id} className="flex items-center justify-between p-2 border rounded-md">
                                    <div className="flex items-center gap-2">
                                         <Checkbox 
                                            id={`task-complete-stepper-${task.id}`} 
                                            checked={isComplete} 
                                            onCheckedChange={(checked) => handleUpdateTaskStatus(task, !!checked)}
                                         />
                                         <Button variant="link" onClick={() => onTaskSelect(task)} className={cn("p-0 h-auto", isComplete && 'line-through text-muted-foreground')}>
                                            {task.name}
                                         </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{task.status}</span>
                                        {assignee && (
                                             <Avatar className="h-6 w-6">
                                                <AvatarImage src={assignee.avatarUrl} />
                                                <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                </div>
                            )
                        }) : (
                            <p className="text-sm text-muted-foreground text-center italic py-4">No tasks for this phase yet.</p>
                        )}
                    </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        );
      })}
       {jobs.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="mt-2 text-sm font-semibold text-foreground">No active jobs</h3>
                <p className="mt-1 text-sm text-muted-foreground">Launch a new job to see it here.</p>
            </div>
        )}
    </div>
  );
}
