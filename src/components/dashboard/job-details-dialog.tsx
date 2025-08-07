
'use client';

import React from 'react';
import { Job, JobFlowTemplate, JobFlowTask, Task, User, Status } from '@/lib/data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2, GitBranch, Briefcase, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';

interface JobDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  job: Job;
  template?: JobFlowTemplate;
  jobFlowTasks: JobFlowTask[];
  tasks: Task[];
  allUsers: User[];
  onAdvancePhase: () => void;
  onUpdateTask: (task: Task) => void;
  onTaskSelect: (task: Task) => void;
}

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

export default function JobDetailsDialog({
  isOpen,
  onOpenChange,
  job,
  template,
  jobFlowTasks,
  tasks,
  allUsers,
  onAdvancePhase,
  onUpdateTask,
  onTaskSelect,
}: JobDetailsDialogProps) {

  if (!template) return null;
  
  const currentPhase = template.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
  const tasksForCurrentPhase = jobFlowTasks
    .filter(jft => jft.phaseIndex === job.currentPhaseIndex)
    .map(jft => tasks.find(t => t.id === jft.taskId))
    .filter((t): t is Task => !!t);

  const areAllTasksComplete = tasksForCurrentPhase.every(t => t.status === 'Done');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Job Details: {job.name}
          </DialogTitle>
          <DialogDescription>
            Tracking progress for the "{template.name}" workflow.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
            <div className="relative pl-6">
                {/* Vertical Connector Line */}
                <div className="absolute left-9 top-4 bottom-4 w-0.5 bg-border" />
                
                {template.phases.map((phase, index) => {
                    let phaseStatus: 'completed' | 'in-progress' | 'pending' = 'pending';
                    if (job.currentPhaseIndex > phase.phaseIndex) {
                        phaseStatus = 'completed';
                    } else if (job.currentPhaseIndex === phase.phaseIndex) {
                        phaseStatus = 'in-progress';
                    }

                    const phaseTaskLinks = jobFlowTasks.filter(jft => jft.phaseIndex === phase.phaseIndex);
                    const phaseTasks = phaseTaskLinks.map(jft => tasks.find(t => t.id === jft.taskId)).filter(Boolean) as Task[];

                    const statusIcon = {
                        completed: <Check className="h-5 w-5 text-white" />,
                        'in-progress': <Loader2 className="h-5 w-5 animate-spin text-primary" />,
                        pending: <Circle className="h-5 w-5 text-muted-foreground/50" />,
                    };

                    const statusColor = {
                        completed: 'bg-primary',
                        'in-progress': 'border-2 border-primary bg-background',
                        pending: 'bg-muted',
                    };
                    
                    return (
                        <div key={phase.id} className="relative flex items-start gap-6 pb-8">
                            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full">
                               <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", statusColor[phaseStatus])}>
                                    {statusIcon[phaseStatus]}
                                </div>
                            </div>
                            <div className="flex-1 pt-1.5">
                                <p className="font-semibold">{phase.name}</p>
                                <div className="mt-2 space-y-2">
                                {phaseTasks.length > 0 ? phaseTasks.map(task => {
                                    const assignee = allUsers.find(u => u.id === task.assigned_to);
                                    const isComplete = task.status === 'Done';
                                    return (
                                        <div key={task.id} className="text-sm text-muted-foreground p-2 border rounded-md flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                 <Button variant="link" onClick={() => onTaskSelect(task)} className="p-0 h-auto text-sm text-card-foreground hover:text-primary">
                                                    <span className={cn(isComplete && 'line-through')}>{task.name}</span>
                                                 </Button>
                                            </div>
                                             {assignee && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs">{task.status}</span>
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={assignee.avatarUrl} />
                                                        <AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                             )}
                                        </div>
                                    )
                                }) : (
                                    <p className="text-sm text-muted-foreground italic mt-1">Tasks not yet created for this phase</p>
                                )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
        {currentPhase && areAllTasksComplete && (
            <DialogFooter>
                {currentPhase.requiresReview ? (
                    <Button>Submit for Review</Button>
                ) : (
                    <Button onClick={onAdvancePhase}>Complete Phase</Button>
                )}
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
