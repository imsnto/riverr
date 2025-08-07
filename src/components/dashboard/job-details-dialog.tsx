
'use client';

import React from 'react';
import { Job, JobFlowTemplate, JobFlowTask, Task, User, Status } from '@/lib/data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2, GitBranch, Briefcase, User as UserIcon, CheckCircle2, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface JobDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  job: Job;
  template?: JobFlowTemplate;
  jobFlowTasks: JobFlowTask[];
  tasks: Task[];
  allUsers: User[];
  onAdvancePhase: () => void;
  onReviewSubmit: () => void;
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
  onReviewSubmit,
  onUpdateTask,
  onTaskSelect,
}: JobDetailsDialogProps) {
  const { appUser } = useAuth();
  if (!template || !appUser) return null;
  
  const currentPhase = template.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
  const tasksForCurrentPhase = jobFlowTasks
    .filter(jft => jft.phaseIndex === job.currentPhaseIndex)
    .map(jft => tasks.find(t => t.id === jft.taskId))
    .filter((t): t is Task => !!t);

  const areAllTasksComplete = tasksForCurrentPhase.every(t => t.status === 'Done');

  const jftForCurrentPhase = jobFlowTasks.filter(jft => jft.phaseIndex === job.currentPhaseIndex);
  const isSubmittedForReview = jftForCurrentPhase.length > 0 && jftForCurrentPhase.every(jft => jft.reviewedBy);

  const handleUpdateTaskStatus = (task: Task, isComplete: boolean) => {
    const subtasks = tasks.filter(t => t.parentId === task.id);
    if (isComplete && subtasks.some(st => st.status !== 'Done')) {
        // This case should be prevented by disabled checkbox, but as a safeguard.
        return;
    }
    const newStatus = isComplete ? 'Done' : 'Pending';
    onUpdateTask({ ...task, status: newStatus });
  }

  const reviewerId = currentPhase?.defaultReviewerId ? job.roleUserMapping[currentPhase.defaultReviewerId] || currentPhase.defaultReviewerId : null;
  const isCurrentUserTheReviewer = appUser.id === reviewerId;
  const isJobCompleted = job.status === 'completed';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Job Details: {job.name}
            {isJobCompleted && (
                <Badge variant="secondary" className="flex items-center gap-1.5 bg-green-100 text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Job Completed
                </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Tracking progress for the "{template.name}" workflow.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
            <TooltipProvider>
            <div className="relative pl-6">
                {/* Vertical Connector Line */}
                <div className="absolute left-9 top-4 bottom-4 w-0.5 bg-border" />
                
                {template.phases.map((phase, index) => {
                    const phaseTaskLinks = jobFlowTasks.filter(jft => jft.phaseIndex === phase.phaseIndex);
                    const phaseTasks = phaseTaskLinks.map(jft => tasks.find(t => t.id === jft.taskId)).filter(Boolean) as Task[];
                    const allPhaseTasksComplete = phaseTasks.every(t => t.status === 'Done');
                    
                    const jftForPhase = jobFlowTasks.filter(jft => jft.phaseIndex === phase.phaseIndex);
                    const phaseSubmittedForReview = jftForPhase.length > 0 && jftForPhase.every(jft => !!jft.reviewedBy);

                    let phaseStatus: 'completed' | 'in-progress' | 'pending' | 'awaiting-review' = 'pending';
                    if (isJobCompleted || job.currentPhaseIndex > phase.phaseIndex) {
                        phaseStatus = 'completed';
                    } else if (job.currentPhaseIndex === phase.phaseIndex) {
                        phaseStatus = phaseSubmittedForReview ? 'awaiting-review' : 'in-progress';
                    }

                    const phaseReviewerId = phase.defaultReviewerId ? job.roleUserMapping[phase.defaultReviewerId] || phase.defaultReviewerId : null;
                    const reviewer = phaseReviewerId ? allUsers.find(u => u.id === phaseReviewerId) : null;

                    const statusIcon = {
                        completed: <Check className="h-5 w-5 text-white" />,
                        'in-progress': <Loader2 className="h-5 w-5 animate-spin text-primary" />,
                        pending: <Circle className="h-5 w-5 text-muted-foreground/50" />,
                        'awaiting-review': <UserCheck className="h-5 w-5 text-primary" />,
                    };

                    const statusColor = {
                        completed: 'bg-primary',
                        'in-progress': 'border-2 border-primary bg-background',
                        pending: 'bg-muted',
                        'awaiting-review': 'border-2 border-primary bg-background',
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
                                {phaseStatus === 'awaiting-review' && reviewer ? (
                                    <div className="mt-2 flex items-center gap-2 rounded-md border bg-primary/10 p-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={reviewer.avatarUrl} />
                                            <AvatarFallback>{getInitials(reviewer.name)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-sm font-medium text-primary">
                                            Submitted for review to {reviewer.name}
                                        </p>
                                    </div>
                                ) : (phase.requiresReview && phaseStatus !== 'completed' && (
                                     <Badge variant="outline" className="mt-1">
                                        <UserCheck className="h-3 w-3 mr-1.5" />
                                        Review by: {reviewer?.name || 'Unknown'}
                                     </Badge>
                                ))}
                                <div className="mt-2 space-y-2">
                                {phaseTasks.length > 0 ? phaseTasks.map(task => {
                                    const assignee = allUsers.find(u => u.id === task.assigned_to);
                                    const isComplete = task.status === 'Done';
                                    const subtasks = tasks.filter(t => t.parentId === task.id);
                                    const allSubtasksComplete = subtasks.every(st => st.status === 'Done');
                                    const isCheckboxDisabled = phaseStatus !== 'in-progress' || (subtasks.length > 0 && !allSubtasksComplete);

                                    return (
                                        <div key={task.id} className="text-sm text-muted-foreground p-2 border rounded-md flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className={cn(isCheckboxDisabled && "cursor-not-allowed")}>
                                                            <Checkbox 
                                                                id={`task-complete-${task.id}`} 
                                                                checked={isComplete} 
                                                                onCheckedChange={(checked) => handleUpdateTaskStatus(task, !!checked)}
                                                                disabled={isCheckboxDisabled}
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    {isCheckboxDisabled && subtasks.length > 0 && (
                                                        <TooltipContent>
                                                            <p>Complete all subtasks to mark this task as done.</p>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                                 <label htmlFor={`task-complete-${task.id}`} className={cn("cursor-pointer", isComplete && 'line-through text-muted-foreground')}>
                                                    <Button variant="link" onClick={() => onTaskSelect(task)} className="p-0 h-auto text-sm text-card-foreground hover:text-primary">
                                                        {task.name}
                                                    </Button>
                                                 </label>
                                            </div>
                                             {assignee && (
                                                <div className="flex items-center gap-2">
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
            </TooltipProvider>
        </ScrollArea>
        {!isJobCompleted && currentPhase && areAllTasksComplete && (
            <DialogFooter>
                {currentPhase.requiresReview ? (
                     isCurrentUserTheReviewer && isSubmittedForReview ? (
                        <Button onClick={onAdvancePhase}>Approve and Complete Phase</Button>
                    ) : (
                        <Button onClick={onReviewSubmit} disabled={isSubmittedForReview}>
                            {isSubmittedForReview ? 'Submitted for Review' : 'Submit for Review'}
                        </Button>
                    )
                ) : (
                    <Button onClick={onAdvancePhase}>Complete Phase</Button>
                )}
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
