
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Project, Task, TimeEntry, User, Job, JobFlowTemplate, JobFlowTask } from '@/lib/data';
import { CheckCircle, Clock, FolderKanban, GitBranch, UserCheck } from 'lucide-react';
import ProjectDetailsDialog from './project-details-dialog';
import { Button } from '../ui/button';
import JobDetailsDialog from './job-details-dialog';
import { updateJobPhase, reviewJobPhase } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

interface OverviewProps {
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  appUser: User | null;
  allUsers: User[];
  jobs: Job[];
  jobFlowTemplates: JobFlowTemplate[];
  jobFlowTasks: JobFlowTask[];
  onUpdateTask: (task: Task) => void;
  onTaskSelect: (task: Task) => void;
  onJobLaunched: () => void;
}

export default function Overview({ 
  projects, 
  tasks, 
  timeEntries, 
  appUser, 
  allUsers, 
  jobs, 
  jobFlowTemplates, 
  jobFlowTasks,
  onUpdateTask,
  onTaskSelect,
  onJobLaunched
}: OverviewProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { toast } = useToast();

  if (!appUser) return null;

  const handleAdvancePhase = async (job: Job) => {
    const template = jobFlowTemplates.find(t => t.id === job.workflowTemplateId);
    if (!template) return;
    
    try {
        await updateJobPhase(job, template, tasks, jobFlowTasks);
        toast({ title: "Phase Advanced!", description: `Job "${job.name}" has moved to the next phase.` });
        onJobLaunched(); // This will refresh all job data
        setSelectedJob(null); // Close dialog on success
    } catch (error) {
        console.error("Failed to advance phase:", error);
        toast({ variant: 'destructive', title: 'Failed to advance phase' });
    }
  };

  const userProjects = projects.filter(p => p.members.includes(appUser.id));
  const userTasks = tasks.filter(t => t.assigned_to === appUser.id);
  const userTimeEntries = timeEntries.filter(t => t.user_id === appUser.id);

  const totalHoursLogged = userTimeEntries.reduce((acc, entry) => acc + entry.duration, 0);

  const formatDuration = (hours: number) => {
    if (hours === 0) return '0 min';
    
    const totalMinutes = Math.round(hours * 60);

    if (totalMinutes < 1) {
        return `< 1 min`;
    }

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const parts = [];
    if (h > 0) {
        parts.push(`${h} hr${h > 1 ? 's' : ''}`);
    }
    if (m > 0) {
        parts.push(`${m} min`);
    }
    return parts.join(' ');
  };
  
  const pendingReviews = jobs.filter(job => {
      const template = jobFlowTemplates.find(t => t.id === job.workflowTemplateId);
      if (!template) return false;
      const currentPhase = template.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
      if (!currentPhase || !currentPhase.requiresReview) return false;
      
      const reviewerId = currentPhase.defaultReviewerId;
      const actualReviewerId = job.roleUserMapping[reviewerId!] || reviewerId;
      if (actualReviewerId !== appUser.id) return false;
      
      const phaseTaskLinks = jobFlowTasks.filter(jft => jft.jobId === job.id && jft.phaseIndex === job.currentPhaseIndex);
      if (phaseTaskLinks.length === 0) return false; // No tasks submitted yet
      
      // Check if tasks are done and if review has been submitted (at least one jft has reviewedBy)
      const phaseTasks = phaseTaskLinks.map(jft => tasks.find(t => t.id === jft.taskId)).filter(Boolean) as Task[];
      const allTasksDone = phaseTasks.length > 0 && phaseTasks.every(t => t.status === 'Done');
      const isSubmitted = phaseTaskLinks.every(jft => !!jft.reviewedBy);

      // We want to show items that are submitted but the reviewer (me) hasn't approved yet.
      // The approval action is advancing the phase. So if it's submitted for review to me, show it.
      return allTasksDone && isSubmitted;
  });

  const selectedJobTemplate = selectedJob ? jobFlowTemplates.find(t => t.id === selectedJob.workflowTemplateId) : undefined;

  return (
    <>
      <div className="space-y-6">
         {pendingReviews.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <UserCheck className="h-5 w-5" />
                You have items to review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingReviews.map(job => {
                const template = jobFlowTemplates.find(t => t.id === job.workflowTemplateId);
                const phase = template?.phases.find(p => p.phaseIndex === job.currentPhaseIndex);
                return (
                  <div key={job.id} className="flex justify-between items-center bg-card p-3 rounded-md">
                    <div>
                      <p className="font-semibold">{job.name}</p>
                      <p className="text-sm text-muted-foreground">Ready for review: <span className="font-medium">{phase?.name}</span></p>
                    </div>
                    <Button onClick={() => setSelectedJob(job)}>Review</Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userProjects.length}</div>
              <p className="text-xs text-muted-foreground">Active and assigned projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userTasks.length}</div>
              <p className="text-xs text-muted-foreground">Total assigned tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Hours Logged</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalHoursLogged)}</div>
              <p className="text-xs text-muted-foreground">Total hours logged this week</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {userProjects.slice(0, 5).map(p => (
                  <li key={p.id} className="text-sm flex items-center justify-between">
                    <button onClick={() => setSelectedProject(p)} className="hover:underline text-primary">
                      {p.name}
                    </button>
                    <span className="text-xs text-muted-foreground">{p.status}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {userTimeEntries.slice(0, 3).map(entry => {
                   const project = projects.find(p => p.id === entry.project_id);
                   const task = tasks.find(t => t.id === entry.task_id);
                   return (
                      <li key={entry.id} className="text-sm">
                          <p className="font-medium">{formatDuration(entry.duration)} on {project?.name}</p>
                          <p className="text-xs text-muted-foreground">{task ? task.name : entry.notes}</p>
                      </li>
                   );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      {selectedProject && (
        <ProjectDetailsDialog
          project={selectedProject}
          isOpen={!!selectedProject}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedProject(null);
            }
          }}
          tasks={tasks.filter(t => t.project_id === selectedProject.id)}
          allUsers={allUsers}
        />
      )}
       {selectedJob && selectedJobTemplate && (
          <JobDetailsDialog
            isOpen={!!selectedJob}
            onOpenChange={(isOpen) => {
                if (!isOpen) setSelectedJob(null);
            }}
            job={selectedJob}
            template={selectedJobTemplate}
            jobFlowTasks={jobFlowTasks.filter(jft => jft.jobId === selectedJob.id)}
            tasks={tasks}
            allUsers={allUsers}
            onAdvancePhase={() => handleAdvancePhase(selectedJob)}
            onReviewSubmit={() => {}}
            onUpdateTask={onUpdateTask}
            onTaskSelect={onTaskSelect}
          />
      )}
    </>
  );
}
