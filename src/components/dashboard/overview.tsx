

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Project, Task, TimeEntry, User, Job, JobFlowTemplate, JobFlowTask, Activity, DocumentComment } from '@/lib/data';
import { CheckCircle, Clock, FolderKanban, GitBranch, UserCheck, MessageSquare, CheckSquare, FileText, AtSign } from 'lucide-react';
import ProjectDetailsDialog from './project-details-dialog';
import { Button } from '../ui/button';
import JobDetailsDialog from './job-details-dialog';
import { updateJobPhase, reviewJobPhase } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useRouter } from 'next/navigation';

type Mention = (Message | Activity | DocumentComment) & {
  parentType?: "task" | "document";
  parentId?: string;
  parentName?: string;
};

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
  onDataRefresh: () => void;
  unreadMentions: Mention[];
}

const getInitials = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
};

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
  onDataRefresh,
  unreadMentions
}: OverviewProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  if (!appUser) return null;
  
  const myTasks = useMemo(() => {
    return tasks
      .filter((task) => task.assigned_to === appUser.id && task.status !== 'Done')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5); // Limit to 5 tasks for the overview
  }, [tasks, appUser.id]);


  const handleAdvancePhase = async (job: Job) => {
    const template = jobFlowTemplates.find(t => t.id === job.workflowTemplateId);
    if (!template) return;
    
    try {
        await updateJobPhase(job, template, tasks, jobFlowTasks);
        toast({ title: "Phase Advanced!", description: `Job "${job.name}" has moved to the next phase.` });
        setSelectedJob(null);
        onDataRefresh();
    } catch (error) {
        console.error("Failed to advance phase:", error);
        toast({ variant: 'destructive', title: 'Failed to advance phase' });
    }
  };

  const userProjects = projects.filter(p => p.members.includes(appUser.id));
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
      if (phaseTaskLinks.length === 0) return false;
      
      // Check if ANY task link for this phase has been reviewed.
      const isSubmittedForReview = phaseTaskLinks.some(jft => !!jft.reviewedBy);
      if (!isSubmittedForReview) return false;

      const phaseTasks = phaseTaskLinks.map(jft => tasks.find(t => t.id === jft.taskId)).filter(Boolean) as Task[];
      const allTasksDone = phaseTasks.length > 0 && phaseTasks.every(t => t.status === 'Done');

      return allTasksDone;
  });

  const selectedJobTemplate = selectedJob ? jobFlowTemplates.find(t => t.id === selectedJob.workflowTemplateId) : undefined;
  
  const handleMentionClick = (mention: Mention) => {
    if (mention.parentType === 'task' && mention.parentId && onTaskSelect && tasks) {
        const task = tasks.find(t => t.id === mention.parentId);
        if (task) {
            onTaskSelect(task);
        }
    }
  };
  
  const getParentIcon = (mention: Mention) => {
    if ("channel_id" in mention) return <MessageSquare className="h-3 w-3" />;
    if (mention.parentType === "task")
      return <CheckSquare className="h-3 w-3" />;
    return null;
  };
  
  const renderMentionContent = (content: string, allUsers: User[]) => {
    const parts = content.split(/(@[\w\s]+)/g).filter(Boolean);
    return parts.map((part, index) => {
        if (part.startsWith("@")) {
        const userName = part.substring(1).trim();
        const user = allUsers.find((u) => u.name === userName);
        if (user) {
            return (
            <strong key={index} className="text-primary font-semibold">
                @{user.name}
            </strong>
            );
        }
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.filter((t) => t.assigned_to === appUser.id).length}</div>
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
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Your top 5 upcoming tasks.</CardDescription>
            </CardHeader>
            <CardContent>
                {myTasks.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Due</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {myTasks.map((task) => {
                                const project = projects.find(p => p.id === task.project_id);
                                return (
                                    <TableRow key={task.id} onClick={() => onTaskSelect(task)} className="cursor-pointer">
                                        <TableCell className="font-medium">{task.name}</TableCell>
                                        <TableCell>{project?.name || 'N/A'}</TableCell>
                                        <TableCell>{format(parseISO(task.due_date), "MMM d")}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground">You have no upcoming tasks.</p>
                )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AtSign className="h-5 w-5" />
                Recent Mentions
              </CardTitle>
               <CardDescription>Your most recent unread mentions.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-4">
                  {unreadMentions.slice(0, 5).map((mention, index) => {
                     const userId = "user_id" in mention ? mention.user_id : mention.userId;
                     const timestamp = "timestamp" in mention ? mention.timestamp : mention.createdAt;
                     const content = "content" in mention ? mention.content : mention.comment || "";
                     const user = allUsers.find((u) => String(u.id) === String(userId));
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleMentionClick(mention)}
                        className="flex w-full items-start gap-3 p-2 rounded-md hover:bg-muted/60 transition text-left"
                      >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatarUrl} />
                            <AvatarFallback>
                                {user ? getInitials(user.name) : "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{user?.name}</span>
                                <span className="text-xs text-muted-foreground">{format(new Date(timestamp), "MMM d")}</span>
                            </div>
                            <div className="text-sm text-muted-foreground my-1 break-words">
                                {renderMentionContent(content, allUsers)}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {getParentIcon(mention)}
                                {mention.parentName || 'Unknown context'}
                            </div>
                        </div>
                      </button>
                    )
                  })}
                  {unreadMentions.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center pt-8">No unread mentions.</p>
                  )}
                </div>
              </ScrollArea>
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
