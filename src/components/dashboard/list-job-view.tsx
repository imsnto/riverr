
'use client';

import React from 'react';
import { Job, JobFlowTemplate } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ListJobViewProps {
  template: JobFlowTemplate;
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

export default function ListJobView({ template, jobs, onJobClick }: ListJobViewProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job Name</TableHead>
            <TableHead>Current Phase</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map(job => {
            const currentPhase = template.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.name}</TableCell>
                <TableCell>{currentPhase?.name || 'N/A'}</TableCell>
                <TableCell><Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>{job.status}</Badge></TableCell>
                <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onJobClick(job)}>View Details</Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
       {jobs.length === 0 && (
            <div className="text-center py-12">
                <h3 className="mt-2 text-sm font-semibold text-foreground">No active jobs</h3>
                <p className="mt-1 text-sm text-muted-foreground">Launch a new job to see it here.</p>
            </div>
        )}
    </div>
  );
}
