
'use client';

import React from 'react';
import { Job, JobFlowTask, JobFlowTemplate, Task } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Circle, GitBranch, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface ActiveJobsViewProps {
  jobs: Job[];
  jobFlowTasks: JobFlowTask[];
  tasks: Task[];
  templates: JobFlowTemplate[];
}

const PhaseNode = ({ name, status }: { name: string, status: 'completed' | 'in-progress' | 'pending' }) => {
    const statusIcon = {
        completed: <Check className="h-4 w-4 text-white" />,
        'in-progress': <Loader2 className="h-4 w-4 animate-spin text-primary" />,
        pending: <Circle className="h-4 w-4 text-muted-foreground/50" />,
    }

    const statusColor = {
        completed: 'bg-primary text-primary-foreground',
        'in-progress': 'border-2 border-primary bg-background',
        pending: 'bg-muted',
    }
    
    return (
        <div className="flex flex-col items-center">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", statusColor[status])}>
                {statusIcon[status]}
            </div>
            <p className="text-xs mt-1 text-center truncate w-24">{name}</p>
        </div>
    )
}

const PhaseConnector = () => {
    return <div className="flex-1 h-px bg-border -mx-2"></div>
}

export default function ActiveJobsView({ jobs, jobFlowTasks, tasks, templates }: ActiveJobsViewProps) {
  
  const activeJobs = jobs.filter(j => j.status === 'active');

  const handleJobClick = (job: Job) => {
    // This will eventually open a details dialog
    console.log("Clicked job:", job.id);
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
            <GitBranch />
            <CardTitle>Active Jobs</CardTitle>
        </div>
        <CardDescription>Track the progress of all ongoing jobs launched from your templates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No active jobs. Launch one from a template to get started!</div>
        )}
        {activeJobs.map(job => {
          const template = templates.find(t => t.id === job.workflowTemplateId);
          if (!template) return null;

          return (
            <Button variant="ghost" className="w-full h-auto p-0" key={job.id} onClick={() => handleJobClick(job)}>
              <Card className="w-full hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-lg">{job.name}</CardTitle>
                  <CardDescription>
                    Using template: <span className="font-semibold">{template.name}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                      {template.phases.map((phase, index) => {
                          let status: 'completed' | 'in-progress' | 'pending' = 'pending';
                          if(job.currentPhaseIndex > phase.phaseIndex) {
                              status = 'completed';
                          } else if (job.currentPhaseIndex === phase.phaseIndex) {
                              status = 'in-progress';
                          }

                          return (
                              <React.Fragment key={phase.id}>
                                  <PhaseNode name={phase.name} status={status} />
                                  {index < template.phases.length - 1 && <PhaseConnector />}
                              </React.Fragment>
                          )
                      })}
                  </div>
                </CardContent>
              </Card>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
