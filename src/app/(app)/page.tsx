

'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, GanttChart, MessageSquare, Settings, Users, MessageCircleMore, ShieldCheck, FilePlus, GitBranch } from 'lucide-react';
import { User, Space, Project, Task, SlackMeetingLog, TimeEntry, Channel, Message, Status, Invite, JobFlowTemplate, Job, JobFlowTask } from '@/lib/data';
import Header from '@/components/dashboard/header';
import Overview from '@/components/dashboard/overview';
import TaskBoard from '@/components/dashboard/task-board';
import TeamTimesheets from '@/components/dashboard/team-timesheets';
import ManualTimeEntry from '@/components/dashboard/manual-time-entry';
import Timer from '@/components/dashboard/timer';
import MeetingReview from '@/components/dashboard/meeting-review';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import SpaceSettings from '@/components/dashboard/space-settings';
import UserSettings from '@/components/dashboard/user-settings';
import { getAllSpaces as dbGetAllSpaces, getProjectsInSpace as dbGetProjects, getAllTasks as dbGetAllTasks, getTimeEntriesInSpace as dbGetTimeEntries, getSlackMeetingLogsInSpace as dbGetSlackLogs, getAllUsers as dbGetAllUsers, getChannelsInSpace as dbGetChannels, getMessagesInChannel as dbGetMessages, addTask as dbAddTask, updateSpace as dbUpdateSpace, addSpace as dbAddSpace, deleteSpace as dbDeleteSpace, seedDatabase, updateTask as dbUpdateTask, addInvite, getInvitesForEmail, acceptInvite, declineInvite, addProject, updateProject, deleteProject, addTimeEntry as dbAddTimeEntry, getAllJobs, getAllJobFlowTasks, getJobFlowTemplates, deleteTask } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import ChannelsView from '@/components/dashboard/channels-view';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Lock, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CreateTaskFromThreadDialog from '@/components/dashboard/create-task-from-thread-dialog';
import ThreadView from '@/components/dashboard/thread-view';
import AllThreadsView from '@/components/dashboard/all-threads-view';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import InviteUserDialog from '@/components/dashboard/invite-user-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mail } from 'lucide-react';
import JobFlowTemplateBuilder from '@/components/dashboard/job-flow-template-builder';
import ActiveJobsView from '@/components/dashboard/active-jobs-view';
import TaskDetailsDialog from '@/components/dashboard/task-details-dialog';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LogTimeDialog from '@/components/dashboard/log-time-dialog';

export default function Dashboard() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [meetingLogs, setMeetingLogs] = useState<SlackMeetingLog[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [jobFlowTemplates, setJobFlowTemplates] = useState<JobFlowTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobFlowTasks, setJobFlowTasks] = useState<JobFlowTask[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedMessageForTask, setSelectedMessageForTask] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(new Set());
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);


  const [channelsViewMode, setChannelsViewMode] = useState<'channel' | 'all-threads'>('channel');
  const [flowsViewMode, setFlowsViewMode] = useState<'templates' | 'active-jobs'>('templates');


  useEffect(() => {
    const abortController = new AbortController();
    async function loadInitialData() {
        if (!appUser) return;
        setIsLoading(true);
        await seedDatabase();

        const [users, spaces, invites, templates] = await Promise.all([
          dbGetAllUsers(), 
          dbGetAllSpaces(),
          getInvitesForEmail(appUser.email),
          getJobFlowTemplates(),
        ]);
        
        if (abortController.signal.aborted) return;

        setAllUsers(users);
        setAllSpaces(spaces);
        setPendingInvites(invites);
        setJobFlowTemplates(templates);
        
        const userSpaces = spaces.filter(s => s.members[appUser!.id]);
        if (userSpaces.length > 0) {
          setActiveSpaceId(userSpaces[0].id);
        } else if (spaces.length > 0) {
            setActiveSpaceId(spaces[0].id);
        }
        setIsLoading(false);
    }
    loadInitialData();

    return () => {
      abortController.abort();
    };
  }, [appUser]); 

  useEffect(() => {
    const abortController = new AbortController();
    async function loadSpaceData() {
      if (activeSpaceId) {
        setIsLoading(true);
        const [projectsInSpace, channelsInSpace, jobsInSpace, jobFlowTasksInSpace] = await Promise.all([
            dbGetProjects(activeSpaceId),
            dbGetChannels(activeSpaceId),
            getAllJobs(activeSpaceId),
            getAllJobFlowTasks(activeSpaceId)
        ]);
        
        if (abortController.signal.aborted) return;

        setProjects(projectsInSpace);
        setChannels(channelsInSpace);
        setJobs(jobsInSpace);
        setJobFlowTasks(jobFlowTasksInSpace);
        
        if (channelsInSpace.length > 0) {
            const allMessagesInChannels = await Promise.all(channelsInSpace.map(c => dbGetMessages(c.id))).then(res => res.flat());
            if (abortController.signal.aborted) return;
            setMessages(allMessagesInChannels);
            if (!activeChannelId) {
                setActiveChannelId(channelsInSpace[0].id);
            }
        } else {
            setActiveChannelId(null);
            setMessages([]);
        }

        const [tasksInSpace, timeEntriesInSpace, meetingLogsInSpace] = await Promise.all([
            dbGetAllTasks(),
            dbGetTimeEntries(projectsInSpace.map(p => p.id)),
            dbGetSlackLogs(activeSpaceId),
        ]);
        if (abortController.signal.aborted) return;
        setTasks(tasksInSpace);
        setTimeEntries(timeEntriesInSpace);
        setMeetingLogs(meetingLogsInSpace);

        setIsLoading(false);
      }
    }
    loadSpaceData();

    return () => {
      abortController.abort();
    };
  }, [activeSpaceId]);
  
  const handleOpenCreateTaskDialog = (message: Message) => {
    setSelectedMessageForTask(message);
    setIsCreateTaskOpen(true);
  }

  const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
    const newTask = await dbAddTask(taskData);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }
  
  const handleTaskCreated = async (taskData: Omit<Task, 'id'>) => {
    const newTask = await handleAddTask(taskData);
    
    if (selectedMessageForTask) {
      const updatedMessage = { ...selectedMessageForTask, linked_task_id: newTask.id };
      
      const newMessages = messages.map(msg => 
        msg.id === selectedMessageForTask.id 
          ? updatedMessage
          : msg
      );
      setMessages(newMessages);
    }
  }

  const handleUpdateTasks = async (updatedTasks: Task[] = []) => {
    if (!Array.isArray(updatedTasks)) {
      console.error("Expected an array of tasks but got:", updatedTasks);
      return;
    }
  
    const currentTasks = tasks;
    setTasks(updatedTasks);
  
    const batch = writeBatch(db);
    for (const task of updatedTasks) {
      if (task.id.startsWith('temp-')) continue;
      const originalTask = currentTasks.find(t => t.id === task.id);
      if (originalTask && JSON.stringify(originalTask) !== JSON.stringify(task)) {
        const taskRef = doc(db, 'tasks', task.id);
        batch.update(taskRef, task);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      console.error("Failed to batch update tasks:", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save task changes to the server.',
      });
      setTasks(currentTasks); 
    }
  };
  
  const handleUpdateTask = (updatedTask: Task, tempId?: string) => {
    let newTasks: Task[] = [];
    setTasks(prevTasks => {
        const taskIndex = prevTasks.findIndex(t => t.id === (tempId || updatedTask.id));
        
        if (taskIndex !== -1) {
            newTasks = [...prevTasks];
            newTasks[taskIndex] = updatedTask;
            return newTasks;
        }
        newTasks = [...prevTasks, updatedTask];
        return newTasks;
    });

    if (selectedTask && selectedTask.id === (tempId || updatedTask.id)) {
        setSelectedTask(updatedTask);
    }
    
    if (!updatedTask.id.startsWith('temp-')) {
        dbUpdateTask(updatedTask.id, updatedTask);
    }
};

  
  const handleAddTaskOptimistic = (newTask: Task) => {
    setTasks(prev => [...prev, newTask]);
  };
  
  const handleRemoveTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (!taskId.startsWith('temp-')) {
        deleteTask(taskId);
    }
  }

  const handleViewThread = (thread: Message) => {
    setActiveThread(thread);
    setReadThreadIds(prev => new Set(prev).add(thread.id));
  };

  const handleUpdateActiveSpace = async (updatedSpace: Partial<Space>) => {
      if (!activeSpace) return;
      const newActiveSpace = { ...activeSpace, ...updatedSpace };
      setAllSpaces(allSpaces.map(s => s.id === activeSpaceId ? newActiveSpace : s));
      await dbUpdateSpace(activeSpaceId, updatedSpace);
  }

  const handleSaveSpace = async (spaceData: Omit<Space, 'id'>) => {
     if ('id' in spaceData && (spaceData as Space).id) { // Existing space
        await dbUpdateSpace((spaceData as Space).id, spaceData);
        setAllSpaces(allSpaces.map(s => s.id === (spaceData as Space).id ? { ...s, ...spaceData } as Space : s));
      } else { // New space
        const newSpace: Omit<Space, 'id'> = {
            name: spaceData.name,
            members: spaceData.members,
            statuses: [
                { name: 'Backlog', color: '#6b7280' },
                { name: 'In Progress', color: '#3b82f6' },
                { name: 'Review', color: '#f59e0b' },
                { name: 'Done', color: '#22c55e' },
            ]
        }
        const newId = await dbAddSpace(newSpace);
        setAllSpaces([...allSpaces, { ...newSpace, id: newId }]);
      }
  }
  
  const handleDeleteSpace = async (spaceId: string) => {
      await dbDeleteSpace(spaceId);
      setAllSpaces(allSpaces.filter(s => s.id !== spaceId));
  }

  const handleInvite = async (values: Omit<Invite, 'token' | 'id' | 'status'>) => {
    try {
      if (!appUser) throw new Error("User not authenticated");
      const token = Math.random().toString(36).substring(2);
      
      await addInvite({ 
        ...values,
        token,
        status: 'pending',
        invitedBy: {
          id: appUser.id,
          name: appUser.name
        }
       });

      toast({
        title: 'Invite Sent',
        description: `${values.email} has been invited. They will see the invitation on their dashboard.`,
      })
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Invite Failed',
        description: 'Could not send the invitation. Please try again.',
      })
    }
  }

  const handleAcceptInvite = async (invite: Invite) => {
    if (!appUser) return;
    await acceptInvite(invite, appUser.id);
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    // Reload spaces to reflect new membership
    const updatedSpaces = await dbGetAllSpaces();
    setAllSpaces(updatedSpaces);
    toast({ title: 'Invitation Accepted!', description: `You have joined the ${invite.spaces.map(id => allSpaces.find(s=>s.id === id)?.name).join(', ')} space(s).` });
  }
  
  const handleDeclineInvite = async (invite: Invite) => {
      await declineInvite(invite.id);
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      toast({ title: 'Invitation Declined' });
  }

  const handleAddProject = async (project: Omit<Project, 'id'>) => {
    const newProject = await addProject(project);
    setProjects(prev => [...prev, newProject]);
  }

  const handleUpdateProject = async (projectId: string, projectData: Partial<Project>) => {
    await updateProject(projectId, projectData);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...projectData } as Project : p));
  }
  
  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTasks(prev => prev.filter(t => t.project_id !== projectId));
  }

  const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
    try {
      const newTimeEntry = await dbAddTimeEntry(timeData);
      setTimeEntries(prev => [...prev, newTimeEntry]);
      toast({
        title: 'Time Logged',
        description: `Successfully logged ${timeData.duration} hours.`,
      });
    } catch (error) {
      console.error('Failed to log time:', error);
      toast({
        variant: 'destructive',
        title: 'Logging Failed',
        description: 'Could not save the time entry. Please try again.',
      });
    }
  };

  const handleSaveJobFlowTemplate = (templateData: JobFlowTemplate) => {
    setJobFlowTemplates(prev => [...prev, templateData]);
    toast({ title: 'Template Saved!', description: `The "${templateData.name}" template has been saved.`});
  }
  
  const handleJobLaunched = async () => {
    if (!activeSpaceId) return;
    // Refetch jobs and tasks to get the newly created ones
    const [jobsInSpace, jobFlowTasksInSpace, allTasks] = await Promise.all([
        getAllJobs(activeSpaceId),
        getAllJobFlowTasks(activeSpaceId),
        dbGetAllTasks()
    ]);
    setJobs(jobsInSpace);
    setJobFlowTasks(jobFlowTasksInSpace);
    setTasks(allTasks);
  };


  if (!appUser) {
    return <div className="flex h-screen items-center justify-center">Loading user data...</div>;
  }
  
  const userSpaces = allSpaces.filter(s => s.members[appUser.id]);
  const activeSpace = allSpaces.find(s => s.id === activeSpaceId) || userSpaces[0] || allSpaces[0];

  const currentUserPermissions = activeSpace?.members[appUser.id];
  const canSeeAllTimesheets = currentUserPermissions?.role === 'Admin' || currentUserPermissions?.permissions?.canSeeAllTimesheets;
  const canLogTime = currentUserPermissions?.role === 'Admin' || currentUserPermissions?.permissions?.canLogTime;


  const handleSpaceChange = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setActiveThread(null);
    setActiveChannelId(null);
  };
  
  if (isLoading || !activeSpace) {
    return <div className="flex justify-center items-center h-screen">Loading your workspace...</div>;
  }
  
  const parentMessagesWithReplies = messages.filter(m => m.reply_count && m.reply_count > 0);
  const userInvolvedThreads = parentMessagesWithReplies.filter(parent => {
      const threadMessages = messages.filter(m => m.thread_id === parent.id);
      const participants = new Set([parent.user_id, ...threadMessages.map(m => m.user_id)]);
      return participants.has(appUser.id);
  });
  const hasUnreadThreads = userInvolvedThreads.some(t => !readThreadIds.has(t.id));

  const handleNavClick = (tabId: string) => {
    if (tabId === 'admin') {
        router.push('/admin');
    } else {
        setActiveTab(tabId);
    }
  }
  
  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: GanttChart },
    { id: 'tasks', label: 'Task Board', icon: FolderKanban },
    { id: 'channels', label: 'Channels', icon: MessageSquare },
    { id: 'flows', label: 'Flows', icon: FilePlus, permission: true },
    { id: 'timesheets', label: 'Timesheets', icon: Users, permission: canLogTime },
    { id: 'settings', label: 'Settings', icon: Settings, permission: true },
  ];
  
  const visibleUserIds = new Set(userSpaces.flatMap(s => Object.keys(s.members)));
  const visibleUsers = allUsers.filter(u => visibleUserIds.has(u.id));

  const handleTaskSelect = (task: Task) => {
    // Make sure we grab the fresh version from tasks[] by id
    const freshTask = tasks.find(t => t.id === task.id);
    if (freshTask) {
        setSelectedTask({ ...freshTask }); // clone to force rerender
    } else {
        // Fallback for temp tasks that might not be in the main list yet
        setSelectedTask(task);
        console.warn("Selected task not found in main tasks array:", task.id);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-background font-body">
        <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={userSpaces} appUser={appUser} />
        <div className="flex flex-1 overflow-hidden">
          {/* Primary Sidebar */}
          <aside className="hidden w-20 flex-col items-center border-r bg-card p-4 md:flex">
            <nav className="flex flex-col items-center gap-4">
              {NAV_ITEMS.map(item => {
                if (item.permission === false) { // Explicitly hide if permission is false
                  return null;
                }
                return (
                  <Tooltip key={item.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          "w-10 h-10 rounded-lg",
                          activeTab === item.id && 'bg-primary/10 text-primary'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </aside>
          
          {/* Secondary Sidebar (for Channels) */}
          {activeTab === 'channels' && (
            <aside className="w-56 border-r flex flex-col bg-card">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Channels</h2>
                </div>
                <ScrollArea>
                  <div className="p-2">
                    <Button
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2',
                          channelsViewMode === 'all-threads' && 'bg-primary/10 text-primary',
                          hasUnreadThreads && "font-bold"
                        )}
                        onClick={() => {
                            setChannelsViewMode('all-threads');
                            setActiveChannelId(null);
                            setActiveThread(null);
                        }}
                      >
                         <div className="flex items-center gap-2">
                            <MessageCircleMore className="h-4 w-4" />
                            <span>Threads</span>
                          </div>
                          {hasUnreadThreads && <span className="ml-auto h-2 w-2 rounded-full bg-accent-foreground" />}
                      </Button>
                      <Separator className="my-2" />
                    {channels.map(channel => {
                      const hasMention = messages.some(
                        m => m.channel_id === channel.id && m.content.includes(`@${appUser.name}`)
                      );
                      const isUnread = hasMention && activeChannelId !== channel.id;

                      return (
                      <Button
                        key={channel.id}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2',
                          activeChannelId === channel.id && channelsViewMode === 'channel' && 'bg-primary/10 text-primary',
                          isUnread && "font-bold"
                        )}
                        onClick={() => {
                            setChannelsViewMode('channel');
                            setActiveChannelId(channel.id);
                            setActiveThread(null);
                        }}
                      >
                         <div className="flex items-center gap-2">
                            {channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                            <span>{channel.name}</span>
                          </div>
                          {isUnread && <span className="ml-auto h-2 w-2 rounded-full bg-accent-foreground" />}
                      </Button>
                    )})}
                  </div>
                </ScrollArea>
            </aside>
          )}

           {/* Secondary Sidebar (for Flows) */}
           {activeTab === 'flows' && (
            <aside className="w-56 border-r flex flex-col bg-card">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Flows</h2>
                </div>
                <ScrollArea>
                  <div className="p-2">
                    <Button
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2',
                          flowsViewMode === 'templates' && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => setFlowsViewMode('templates')}
                      >
                        <FilePlus className="h-4 w-4" />
                        <span>Templates</span>
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2',
                           flowsViewMode === 'active-jobs' && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => setFlowsViewMode('active-jobs')}
                      >
                        <GitBranch className="h-4 w-4" />
                        <span>Active Jobs</span>
                      </Button>
                  </div>
                </ScrollArea>
            </aside>
          )}

          {/* Main Content */}
          <main className={cn("flex-1 overflow-auto p-4 md:p-8", (activeTab === 'channels' || activeTab === 'flows') && "p-4 md:p-8", activeTab === 'tasks' && "p-4 md:p-8")}>
              {pendingInvites.length > 0 && (
                <div className='p-4'>
                {pendingInvites.map(invite => {
                    const spaceNames = invite.spaces.map(id => allSpaces.find(s => s.id === id)?.name).filter(Boolean).join(', ');
                    return (
                        <Alert key={invite.id}>
                          <Mail className="h-4 w-4" />
                          <AlertTitle>You have a new invitation!</AlertTitle>
                          <AlertDescription>
                            <div className="flex justify-between items-center">
                              <p>
                                <strong>{invite.invitedBy?.name || 'Someone'}</strong> has invited you to join the <strong>{spaceNames}</strong> space(s).
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={() => handleAcceptInvite(invite)}>Accept</Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(invite)}>Decline</Button>
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                    )
                })}
                </div>
              )}
              {activeTab === 'dashboard' && (
                <>
                {isLoading ? <div className="flex justify-center items-center h-full">Loading dashboard...</div> : 
                <>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <Overview projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} allUsers={allUsers} />
                      </div>
                      <div className="flex flex-col gap-6">
                        <Timer tasks={tasks} appUser={appUser} onLogTime={handleLogTime}/>
                        <ManualTimeEntry projects={projects} tasks={tasks} appUser={appUser} onLogTime={handleLogTime}/>
                      </div>
                    </div>
                    <div className="mt-6">
                      <MeetingReview slackMeetingLogs={meetingLogs} projects={projects} allUsers={allUsers} />
                    </div>
                  </>
                }
                </>
              )}
              {activeTab === 'channels' && (
                <div className="flex flex-1 h-full p-0">
                  <div className="flex-1 overflow-y-auto">
                    {isLoading ? <div className="flex justify-center items-center h-full">Loading channels...</div> : 
                     channelsViewMode === 'channel' ? (
                        <ChannelsView 
                        channels={channels}
                        messages={messages} 
                        allUsers={allUsers}
                        tasks={tasks}
                        activeChannelId={activeChannelId}
                        setMessages={setMessages}
                        onCreateTask={handleOpenCreateTaskDialog}
                        onViewThread={handleViewThread}
                        statuses={activeSpace?.statuses || []}
                        />
                     ) : (
                        <AllThreadsView
                          messages={messages}
                          allUsers={allUsers}
                          onViewThread={handleViewThread}
                          appUser={appUser}
                          readThreadIds={readThreadIds}
                        />
                     )
                  }
                  </div>
                  {activeThread && (
                      <div className="w-[440px] border-l flex flex-col">
                        <ThreadView
                          thread={activeThread}
                          messages={messages}
                          allUsers={allUsers}
                          setMessages={setMessages}
                          onClose={() => setActiveThread(null)}
                        />
                      </div>
                  )}
                </div>
              )}
              {activeTab === 'tasks' && activeSpace && (
                <>
                {isLoading ? <div className="flex justify-center items-center h-full">Loading tasks...</div> : 
                <TaskBoard 
                    tasks={tasks} 
                    onUpdateTasks={handleUpdateTasks} 
                    projects={projects} 
                    activeSpace={activeSpace} 
                    allUsers={visibleUsers} 
                    onUpdateActiveSpace={handleUpdateActiveSpace} 
                    onAddProject={handleAddProject} 
                    onUpdateProject={handleUpdateProject} 
                    onDeleteProject={handleDeleteProject}
                    onTaskSelect={handleTaskSelect}
                    onUpdateTask={handleUpdateTask}
                    onAddTask={handleAddTaskOptimistic}
                />}
                </>
              )}
               {activeTab === 'flows' && activeSpace && (
                <div className="space-y-6">
                  {isLoading ? <div className="flex justify-center items-center h-full">Loading flows...</div> : 
                    <>
                      {flowsViewMode === 'templates' && (
                        <JobFlowTemplateBuilder templates={jobFlowTemplates} allUsers={visibleUsers} onSave={handleSaveJobFlowTemplate} activeSpace={activeSpace} onJobLaunched={handleJobLaunched} />
                      )}
                      {flowsViewMode === 'active-jobs' && (
                         <ActiveJobsView
                          jobs={jobs}
                          jobFlowTasks={jobFlowTasks}
                          tasks={tasks}
                          templates={jobFlowTemplates}
                          allUsers={visibleUsers}
                        />
                      )}
                    </>
                  }
                </div>
              )}
              {canLogTime && activeTab === 'timesheets' && (
                  <>
                  {isLoading ? <div className="flex justify-center items-center h-full">Loading timesheets...</div> : <TeamTimesheets timeEntries={timeEntries} projects={projects} tasks={tasks} space={activeSpace} allUsers={allUsers} appUser={appUser} />}
                  </>
              )}
              {activeTab === 'settings' && (
                  <div>
                      <h1 className="text-2xl font-bold mb-4">Settings</h1>
                      <Tabs defaultValue="spaces" className="w-full">
                          <TabsList>
                          <TabsTrigger value="spaces">Spaces</TabsTrigger>
                          <TabsTrigger value="users">Users</TabsTrigger>
                          </TabsList>
                          <TabsContent value="spaces">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading spaces...</div> : <SpaceSettings allSpaces={userSpaces} allUsers={visibleUsers} onSave={handleSaveSpace} onDelete={handleDeleteSpace} appUser={appUser} />}
                          </TabsContent>
                          <TabsContent value="users">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading users...</div> : <UserSettings allUsers={visibleUsers} allSpaces={userSpaces} appUser={appUser} onInvite={() => setIsInviteOpen(true)} handleInvite={handleInvite} />}
                          </TabsContent>
                      </Tabs>
                  </div>
              )}
          </main>
        </div>
      </div>
      {isCreateTaskOpen && selectedMessageForTask && (
        <CreateTaskFromThreadDialog 
            isOpen={isCreateTaskOpen}
            onOpenChange={setIsCreateTaskOpen}
            message={selectedMessageForTask}
            channelMembers={channels.find(c => c.id === selectedMessageForTask.channel_id)?.members.map(id => {
                const user = allUsers.find(u => u.id === id);
                return { id: user!.id, name: user!.name };
            }).filter(Boolean) as {id: string, name: string}[]}
            projects={projects.map(p => ({ id: p.id, name: p.name }))}
            onTaskCreated={handleTaskCreated}
        />
      )}
       <InviteUserDialog 
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          onInvite={handleInvite}
          allSpaces={userSpaces}
        />
        {selectedTask && (
          <TaskDetailsDialog
            key={selectedTask.id}
            task={selectedTask}
            timeEntries={timeEntries.filter(t => t.task_id === selectedTask.id)}
            isOpen={!!selectedTask}
            allUsers={allUsers}
            allTasks={tasks}
            onOpenChange={(isOpen) => {
              if (!isOpen) setSelectedTask(null);
            }}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTaskOptimistic}
            onRemoveTask={handleRemoveTask}
            onTaskSelect={handleTaskSelect}
            onLogTime={handleLogTime}
            statuses={activeSpace.statuses?.map(s => s.name) || []}
            projects={projects}
          />
      )}
    </TooltipProvider>
  );
}
