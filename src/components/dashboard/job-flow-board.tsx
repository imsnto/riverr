
'use client';

import React, { useState } from 'react';
import { JobFlowTemplate, Job, JobFlowTask, Task, User, Space, Project } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Plus, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LaunchJobDialog from './launch-job-dialog';
import JobDetailsDialog from './job-details-dialog';
import KanbanJobView from './kanban-job-view';
import StepperJobView from './stepper-job-view';
import ListJobView from './list-job-view';
import { updateJobPhase } from '@/lib/db';

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


    const selectedTemplate = jobFlowTemplates.find(t => t.id === selectedTemplateId);
    const filteredJobs = jobs.filter(j => j.workflowTemplateId === selectedTemplateId);

    const renderView = () => {
        if (!selectedTemplate) return null;

        switch (selectedTemplate.defaultView) {
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
    <>
      <div className="flex h-full gap-6">
        <aside className="w-64 flex-shrink-0 border-r pr-6">
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
        <main className="flex-1 overflow-hidden">
          {selectedTemplate ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">{selectedTemplate.name}</h1>
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                </div>
                <Button onClick={handleLaunchNewJob}>
                  <Plus className="mr-2 h-4 w-4" />
                  Launch Job
                </Button>
              </div>
              {renderView()}
            </div>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center bg-card rounded-lg">
                  <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">No workflow selected</h3>
                  <p className="text-muted-foreground">Select a workflow from the list to view its jobs.</p>
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
            onUpdateTask={onUpdateTask}
            onTaskSelect={onTaskSelect}
          />
      )}
    </>
  );
}
