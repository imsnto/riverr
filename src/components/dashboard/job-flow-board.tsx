
'use client';

import React, { useState, useEffect } from 'react';
import { JobFlowTemplate, Job, JobFlowTask, Task, User, Space, Project } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, LayoutTemplate, Kanban, Rows, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LaunchJobDialog from './launch-job-dialog';
import JobDetailsDialog from './job-details-dialog';
import KanbanJobView from './kanban-job-view';
import StepperJobView from './stepper-job-view';
import ListJobView from './list-job-view';
import { updateJobPhase, reviewJobPhase } from '@/lib/db';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useAuth } from '@/hooks/use-auth';

interface JobFlowBoardProps {
    activeSpace: Space;
    allUsers: User[];
    jobFlowTemplates: JobFlowTemplate[];
    jobs: Job[];
    jobFlowTasks: JobFlowTask[];
    tasks: Task[];
    onJobLaunched: () => void;
    onUpdateTask: (task: Task) => void;
    onTaskSelect: (task: Task) => void;
}

export default function JobFlowBoard({ 
    activeSpace, 
    allUsers, 
    jobFlowTemplates,
    jobs,
    jobFlowTasks,
    tasks,
    onJobLaunched,
    onUpdateTask,
    onTaskSelect,
}: JobFlowBoardProps) {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(jobFlowTemplates.length > 0 ? jobFlowTemplates[0].id : null);
    const [isLaunchJobOpen, setIsLaunchJobOpen] = useState(false);
    const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const { toast } = useToast();
    const { appUser } = useAuth();
    
    const [viewMode, setViewMode] = useState<'kanban' | 'stepper' | 'list' | null>(null);
    const selectedTemplate = jobFlowTemplates.find(t => t.id === selectedTemplateId);

    useEffect(() => {
        if (selectedTemplate) {
            setViewMode(selectedTemplate.defaultView);
        } else {
            setViewMode(null);
        }
    }, [selectedTemplate]);

    const handleLaunchNewJob = () => {
        if (!selectedTemplate) {
            toast({ variant: 'destructive', title: 'No workflow selected' });
            return;
        }
        setIsLaunchJobOpen(true);
    };
    
    const handleJobClick = (job: Job) => {
        setSelectedJob(job);
        setIsJobDetailsOpen(true);
    };

    const handleAdvancePhase = async (job: Job) => {
        const template = jobFlowTemplates.find(t => t.id === job.workflowTemplateId);
        if (!template) return;
        
        try {
            await updateJobPhase(job, template, tasks, jobFlowTasks);
            toast({ title: "Phase Advanced!", description: `Job "${job.name}" has moved to the next phase.` });
            onJobLaunched(); // This will refresh all job data
            setIsJobDetailsOpen(false); // Close dialog on success
        } catch (error) {
            console.error("Failed to advance phase:", error);
            toast({ variant: 'destructive', title: 'Failed to advance phase' });
        }
    };
    
    const handleReviewSubmit = async (job: Job) => {
        if (!appUser) return;
        try {
            await reviewJobPhase(job.id, job.currentPhaseIndex, appUser.id);
            toast({ title: "Phase Submitted!", description: `Phase has been submitted for final review and completion.` });
            onJobLaunched();
            setIsJobDetailsOpen(false);
        } catch (error) {
            console.error("Failed to submit for review:", error);
            toast({ variant: 'destructive', title: 'Failed to submit review' });
        }
    };


    const filteredJobs = jobs.filter(j => j.workflowTemplateId === selectedTemplateId);

    const renderView = () => {
        if (!selectedTemplate || !viewMode) return null;

        switch (viewMode) {
            case 'kanban':
                return <KanbanJobView 
                            template={selectedTemplate} 
                            jobs={filteredJobs} 
                            onJobClick={handleJobClick} 
                        />;
            case 'stepper':
                return <StepperJobView 
                            template={selectedTemplate}
                            jobs={filteredJobs}
                            tasks={tasks}
                            jobFlowTasks={jobFlowTasks}
                            allUsers={allUsers}
                            onJobClick={handleJobClick}
                            onUpdateTask={onUpdateTask}
                            onTaskSelect={onTaskSelect}
                        />;
            case 'list':
                return <ListJobView 
                            template={selectedTemplate}
                            jobs={filteredJobs}
                            onJobClick={handleJobClick}
                        />;
            default:
                return <div>Unsupported view mode</div>;
        }
    };

  return (
    <TooltipProvider>
      <div className="flex h-full gap-6">
        <aside className="w-56 flex-shrink-0 border-r pr-6">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Workflows</h2>
          </div>
          <div className="space-y-2">
              {jobFlowTemplates.map(template => (
                  <div 
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${selectedTemplateId === template.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/50'}`}
                  >
                      <div className="flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4" />
                          <span>{template.name}</span>
                      </div>
                  </div>
              ))}
          </div>
        </aside>
        <main className="flex-1 overflow-auto">
          {selectedTemplate ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">{selectedTemplate.name}</h1>
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('kanban')}><Kanban /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Kanban View</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant={viewMode === 'stepper' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('stepper')}><ChevronsUpDown /></Button>
                        </TooltipTrigger>
                         <TooltipContent><p>Stepper View</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')}><Rows /></Button>
                        </TooltipTrigger>
                         <TooltipContent><p>List View</p></TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Button onClick={handleLaunchNewJob}>
                        <Plus className="mr-2 h-4" />
                        Launch Job
                    </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderView()}
              </div>
            </div>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center bg-card rounded-lg">
                  <LayoutTemplate className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold text-foreground">No workflow selected</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Select a workflow from the list to view its jobs.</p>
              </div>
          )}
        </main>
      </div>
      
      {selectedTemplate && (
          <LaunchJobDialog
            isOpen={isLaunchJobOpen}
            onOpenChange={setIsLaunchJobOpen}
            template={selectedTemplate}
            allUsers={allUsers}
            activeSpace={activeSpace}
            onJobLaunched={onJobLaunched}
           />
      )}
      
      {selectedJob && selectedTemplate && (
          <JobDetailsDialog
            isOpen={isJobDetailsOpen}
            onOpenChange={setIsJobDetailsOpen}
            job={selectedJob}
            template={selectedTemplate}
            jobFlowTasks={jobFlowTasks.filter(jft => jft.jobId === selectedJob.id)}
            tasks={tasks}
            allUsers={allUsers}
            onAdvancePhase={() => handleAdvancePhase(selectedJob)}
            onReviewSubmit={() => handleReviewSubmit(selectedJob)}
            onUpdateTask={onUpdateTask}
            onTaskSelect={onTaskSelect}
          />
      )}
    </TooltipProvider>
  );
}
