
'use client';

import React from 'react';
import { Job, JobFlowTemplate } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface KanbanJobViewProps {
  template: JobFlowTemplate;
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

export default function KanbanJobView({ template, jobs, onJobClick }: KanbanJobViewProps) {
  const activeJobs = jobs.filter(job => job.status !== 'completed');
  const completedJobs = jobs.filter(job => job.status === 'completed');

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {template.phases.map(phase => (
        <div key={phase.id} className="flex-shrink-0 w-80">
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-lg font-semibold">{phase.name}</h2>
          </div>
          <div className="bg-primary/5 rounded-lg p-2 max-h-[calc(100vh-16rem)] overflow-y-auto min-h-[5rem]">
            {activeJobs
              .filter(job => job.currentPhaseIndex === phase.phaseIndex)
              .map(job => (
                <Card key={job.id} onClick={() => onJobClick(job)} className="mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer">
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm font-medium">{job.name}</CardTitle>
                  </CardHeader>
                   <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                       Created: {new Date(job.createdAt).toLocaleDateString()}
                   </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
      {/* Completed Column */}
      <div className="flex-shrink-0 w-80">
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Completed
          </h2>
        </div>
        <div className="bg-green-500/5 rounded-lg p-2 max-h-[calc(100vh-16rem)] overflow-y-auto min-h-[5rem]">
          {completedJobs.map(job => (
            <Card key={job.id} onClick={() => onJobClick(job)} className="mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer opacity-70">
              <CardHeader className="p-3">
                <CardTitle className="text-sm font-medium line-through">{job.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                Completed: {new Date(job.createdAt).toLocaleDateString()}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
