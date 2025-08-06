
'use client';

import React from 'react';
import { Job, JobFlowTemplate, JobFlowTask, Task, User, Status } from '@/lib/data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2, GitBranch, Briefcase, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';

interface JobDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  job: Job;
  template?: JobFlowTemplate;
  jobFlowTasks: JobFlowTask[];
  tasks: Task[];
  allUsers: User[];
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
}: JobDetailsDialogProps) {

  if (!template) return null;

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

                    const phaseTaskLink = jobFlowTasks.find(jft => jft.phaseIndex === phase.phaseIndex);
                    const task = phaseTaskLink ? tasks.find(t => t.id === phaseTaskLink.taskId) : null;
                    const assignee = task ? allUsers.find(u => u.id === task.assigned_to) : null;

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
                                {task ? (
                                    <div className="mt-2 text-sm text-muted-foreground space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4" />
                                            <span>Task: <span className="font-medium text-foreground">{task.name}</span></span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <UserIcon className="h-4 w-4" />
                                            <span>Assigned to: <span className="font-medium text-foreground">{assignee?.name || 'Unknown'}</span></span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <Circle className="h-4 w-4" />
                                            <span>Status: <span className="font-medium text-foreground">{task.status}</span></span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic mt-1">Task not yet created</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
