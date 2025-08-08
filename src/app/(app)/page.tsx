

'use client';

import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { FolderKanban, MessageSquare, Timer, Settings, Workflow, BarChart, ChevronDown, ClipboardCheck, BookOpen, Plus, MoreHorizontal, Edit, Trash2, MessageCircleMore, Hash } from 'lucide-react';
import { Space, User, Project, Task, TimeEntry, SlackMeetingLog, Channel, Message, Invite, Status, JobFlowTemplate, Job, JobFlowTask, PhaseTemplate, TaskTemplate, Activity, Document } from '@/lib/data';
import TaskBoard from '@/components/dashboard/task-board';
import { useToast } from '@/hooks/use-toast';
import TeamTimesheets from '@/components/dashboard/team-timesheets';
import Overview from '@/components/dashboard/overview';
import { 
    getAllUsers, 
    getSpacesForUser, 
    getProjectsInSpace, 
    getAllTasks,
    getTimeEntriesInSpace,
    getSlackMeetingLogsInSpace,
    getChannelsInSpace,
    getMessagesInChannel,
    getJobFlowTemplates,
    getAllJobs,
    getAllJobFlowTasks,
    getPhaseTemplates,
    getTaskTemplates,
    updateTask as dbUpdateTask, 
    addTask as dbAddTask,
    addProject as dbAddProject,
    updateProject as dbUpdateProject,
    deleteProject as dbDeleteProject,
    updateSpace as dbUpdateSpace,
    addSpace as dbAddSpace,
    deleteSpace as dbDeleteSpace,
    addTimeEntry as dbAddTimeEntry,
    addInvite as dbAddInvite,
    addMessage as dbAddMessage,
    addChannel as dbAddChannel,
    updateChannel as dbUpdateChannel,
    deleteChannel as dbDeleteChannel,
    addJobFlowTemplate as dbAddJobFlowTemplate,
    addPhaseTemplate as dbAddPhaseTemplate,
    addTaskTemplate as dbAddTaskTemplate,
    deleteTask as dbDeleteTask,
    updateJob as dbUpdateJob,
    getDocumentsInSpace,
    addDocument,
    updateDocument,
    deleteDocument as dbDeleteDocument,
} from '@/lib/db';
import MeetingReview from '@/components/dashboard/meeting-review';
import ChannelsView from '@/components/dashboard/channels-view';
import ThreadView from '@/components/dashboard/thread-view';
import AllThreadsView from '@/components/dashboard/all-threads-view';
import CreateTaskFromThreadDialog from '@/components/dashboard/create-task-from-thread-dialog';
import CreateChannelDialog from '@/components/dashboard/create-channel-dialog';
import TaskDetailsDialog from '@/components/dashboard/task-details-dialog';
import SpaceSettings from '@/components/dashboard/space-settings';
import UserSettings from '@/components/dashboard/user-settings';
import { randomBytes } from 'crypto';
import JobFlowTemplateBuilder from '@/components/dashboard/job-flow-template-builder';
import PhaseTemplateBuilder from '@/components/dashboard/phase-template-builder';
import TaskTemplateBuilder from '@/components/dashboard/task-template-builder';
import JobFlowBoard from '@/components/dashboard/job-flow-board';
import { Button, buttonVariants } from '@/components/ui/button';
import { TopBar } from '@/components/dashboard/top-bar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentsView from '@/components/dashboard/documents-view';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


type View = 'overview' | 'tasks' | 'mytasks' | 'messages' | 'timesheets' | 'reports' | 'flows' | 'settings' | 'documents';
type SettingsView = 'users' | 'spaces';
type FlowsView = 'job_flows' | 'templates' | 'phases' | 'tasks';

const LoadingState = () => (
    <div className="flex h-full w-full items-center justify-center">
        <p>Loading your workspace...</p>
    </div>
);

function normalizeChannels(chs: Channel[]) {
  return chs.map(c => ({ ...c, id: String(c.id), space_id: String(c.space_id) }));
}

function normalizeMessages(msgs: Message[]) {
  return msgs.map(m => ({
    ...m,
    id: String(m.id),
    channel_id: String(m.channel_id),
    thread_id: m.thread_id ? String(m.thread_id) : undefined,
    user_id: String(m.user_id),
  }));
}

function DashboardComponent() {
    const { appUser, userSpaces, setUserSpaces, activeSpace, setActiveSpace } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [slackLogs, setSlackLogs] = useState<SlackMeetingLog[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [jobFlowTemplates, setJobFlowTemplates] = useState<JobFlowTemplate[]>([]);
    const [phaseTemplates, setPhaseTemplates] = useState<PhaseTemplate[]>([]);
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobFlowTasks, setJobFlowTasks] = useState<JobFlowTask[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    
    const [view, setView] = useState<View>('overview');
    const [settingsView, setSettingsView] = useState<SettingsView>('users');
    const [flowsView, setFlowsView] = useState<FlowsView>('job_flows');
    const [isLoading, setIsLoading] = useState(true);
    
    // For messaging
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [rightPanelView, setRightPanelView] = useState<'threads' | 'thread' | 'task-from-thread' | null>(null);
    const [activeThread, setActiveThread] = useState<Message | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isChannelFormOpen, setIsChannelFormOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

    const [seenParentIds, setSeenParentIds] = useState<Set<string>>(new Set());
    const [threadReadAt, setThreadReadAt] = useState<Map<string, number>>(new Map());

    const markChannelParentsRead = useCallback((channelId: string) => {
        const parentsNow = messages
            .filter(m => String(m.channel_id) === String(channelId) && !m.thread_id)
            .map(m => String(m.id));

        setSeenParentIds(prev => {
            const next = new Set(prev);
            parentsNow.forEach(id => next.add(id));
            return next;
        });
    }, [messages]);

    // This is a safety net for programmatic changes and new messages arriving.
    useEffect(() => {
        if (!activeChannelId) return;
        markChannelParentsRead(activeChannelId);
    }, [activeChannelId, messages]);

    // Reset seen state when user/space changes
    useEffect(() => {
        setSeenParentIds(new Set());
    }, [activeSpace?.id, appUser?.id]);

    // helper: thread unread
    const isThreadUnread = React.useCallback((parent: Message) => {
      if (!appUser) return false;
      // ONLY consider replies (exclude the parent itself)
      const repliesFromOthers = messages
        .filter(m => m.thread_id === parent.id && m.user_id !== appUser.id);

      if (repliesFromOthers.length === 0) return false;

      const lastReplyFromOther = repliesFromOthers.reduce(
        (max, m) => Math.max(max, new Date(m.timestamp).getTime()),
        0
      );

      const lastThreadRead = threadReadAt.get(parent.id) ?? 0;
      return lastReplyFromOther > lastThreadRead;
    }, [appUser, messages, threadReadAt]);
    
    // threads the user is involved in (across active space)
    const userInvolvedThreads = React.useMemo(() => {
        if (!appUser || !activeSpace) return [];
        return messages.filter(parent => {
            if (parent.thread_id) return false; // only parent messages
            
            const ch = channels.find(c => c.id === parent.channel_id);
            if (!ch || ch.space_id !== activeSpace.id) return false;

            const allMsgsInThread = [parent, ...messages.filter(m => m.thread_id === parent.id)];
            return allMsgsInThread.some(m => m.user_id === appUser.id);
        });
    }, [messages, channels, activeSpace, appUser]);

    const unreadThreads = useMemo(
      () => userInvolvedThreads.filter(isThreadUnread),
      [userInvolvedThreads, isThreadUnread]
    );

    const unreadThreadsByChannel = useMemo(() => {
      const acc: Record<string, number> = {};
      channels.forEach(channel => {
        const parents = messages.filter(
          m => m.channel_id === channel.id && !m.thread_id && (m.reply_count ?? 0) > 0
        );
        const count = parents.filter(isThreadUnread).length;
        if (count) acc[channel.id] = count;
      });
      return acc;
    }, [channels, messages, isThreadUnread]);
    
     useEffect(() => {
        const viewFromParams = searchParams.get('view') as View;
        if (viewFromParams && Object.values(['overview', 'tasks', 'mytasks', 'messages', 'timesheets', 'reports', 'flows', 'settings']).includes(viewFromParams)) {
            setView(viewFromParams);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!appUser) return;
        if (userSpaces.length > 0 && !activeSpace) {
            setActiveSpace(userSpaces[0]);
        }
    }, [userSpaces, appUser, activeSpace, setActiveSpace]);
    
     useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768 && rightPanelView) {
                setRightPanelView(null); // Auto-close on small screens
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [rightPanelView]);

    useEffect(() => {
        const fetchData = async () => {
            if (!appUser) return;
            setIsLoading(true);
            try {
                // Fetch data that is NOT space-dependent first
                const [
                    users, allTasks, fetchedProjects, fetchedChannels, jobTemplates, 
                    fetchedJobs, fetchedJobFlowTasks, phaseTpls, taskTpls, fetchedDocuments
                ] = await Promise.all([
                    getAllUsers(),
                    getAllTasks(),
                    activeSpace ? getProjectsInSpace(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getChannelsInSpace(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getJobFlowTemplates(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getAllJobs(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getAllJobFlowTasks(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getPhaseTemplates(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getTaskTemplates(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? getDocumentsInSpace(activeSpace.id) : Promise.resolve([]),
                ]);

                const normalizedChannels = normalizeChannels(fetchedChannels);

                setAllUsers(users);
                setProjects(fetchedProjects);
                setTasks(allTasks);
                setChannels(normalizedChannels);
                setJobFlowTemplates(jobTemplates);
                setJobs(fetchedJobs);
                setJobFlowTasks(fetchedJobFlowTasks);
                setPhaseTemplates(phaseTpls);
                setTaskTemplates(taskTpls);
                setDocuments(fetchedDocuments);
                
                // Fetch all projects across all user spaces to get all time entries
                const allUserProjects = await Promise.all(userSpaces.map(s => getProjectsInSpace(s.id))).then(p => p.flat());
                const allProjectIds = allUserProjects.map(p => p.id);

                const [fetchedTimeEntries, fetchedSlackLogs, fetchedMessages] = await Promise.all([
                    getTimeEntriesInSpace(allProjectIds), // Get all time entries for the user
                    activeSpace ? getSlackMeetingLogsInSpace(activeSpace.id) : Promise.resolve([]),
                    activeSpace ? Promise.all(normalizedChannels.map(c => getMessagesInChannel(c.id))).then(msgArrays => msgArrays.flat()) : Promise.resolve([]),
                ]);
                
                setTimeEntries(fetchedTimeEntries);
                setSlackLogs(fetchedSlackLogs);
                setMessages(normalizeMessages(fetchedMessages));

                if (activeSpace && normalizedChannels.length > 0 && !activeChannelId) {
                    setActiveChannelId(String(normalizedChannels[0].id));
                }

            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load workspace data.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [appUser, activeSpace, userSpaces, toast]);
    
    const handleUpdateActiveSpace = async (updatedData: Partial<Space>) => {
        if (!activeSpace || !appUser) return;
        
        try {
            await dbUpdateSpace(activeSpace.id, updatedData);
            const updatedSpaces = await getSpacesForUser(appUser.id);
            setUserSpaces(updatedSpaces);
        } catch(e) {
            console.error("Failed to update space", e);
            toast({ variant: 'destructive', title: 'Update failed', description: 'Could not save space changes.' });
        }
    }
    
    const handleAddProject = async (projectData: Omit<Project, 'id'>) => {
        const newProject = await dbAddProject(projectData);
        setProjects(prev => [...prev, newProject]);
    };
    
    const handleUpdateProject = async (projectId: string, projectData: Partial<Project>) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...projectData } as Project : p));
        await dbUpdateProject(projectId, projectData);
    };

    const handleDeleteProject = async (projectId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        await dbDeleteProject(projectId);
    };

    const handleUpdateTask = async (updatedTask: Task, tempId?: string) => {
        // Optimistic update
        setTasks(prevTasks => {
            const taskIndex = prevTasks.findIndex(t => t.id === (tempId || updatedTask.id));
            if (taskIndex !== -1) {
                const newTasks = [...prevTasks];
                newTasks[taskIndex] = updatedTask;
                return newTasks;
            }
            return [...prevTasks, updatedTask];
        });

        if (selectedTask && selectedTask.id === (tempId || updatedTask.id)) {
            setSelectedTask(updatedTask);
        }

        try {
            await dbUpdateTask(updatedTask.id, updatedTask);
        } catch(e) {
            console.error("Task update failed", e);
            toast({ variant: 'destructive', title: 'Update failed', description: 'Could not save task changes.' });
            // Consider reverting optimistic update if needed
        }
    };
    
    const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
        // Optimistic update
        const optimisticTask: Task = { ...taskData, id: `temp-${Date.now()}` };
        setTasks(prev => [...prev, optimisticTask]);

        try {
            const savedTask = await dbAddTask(taskData);
            // Replace optimistic task with saved task
            setTasks(prev => prev.map(t => t.id === optimisticTask.id ? savedTask : t));
            if (selectedTask?.id === optimisticTask.id) setSelectedTask(savedTask);
            return savedTask;
        } catch (e) {
            console.error("Task add failed", e);
            toast({ variant: 'destructive', title: 'Create failed', description: 'Could not create new task.' });
            // Revert optimistic update
            setTasks(prev => prev.filter(t => t.id !== optimisticTask.id));
            return null;
        }
    }

     const handleRemoveTask = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        dbDeleteTask(taskId).catch(() => {
            toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete task from DB.' });
            // Note: UI state is not reverted here for simplicity
        });
    };
    
    const handleSaveSpace = async (spaceData: Omit<Space, 'id'>, spaceId?: string) => {
        if (spaceId) { // Update existing
            await dbUpdateSpace(spaceId, spaceData);
        } else { // Create new
            await dbAddSpace(spaceData);
        }
        const updatedSpaces = await getSpacesForUser(appUser!.id);
        setUserSpaces(updatedSpaces);
    }

    const handleDeleteSpace = async (spaceId: string) => {
        await dbDeleteSpace(spaceId);
        const updatedSpaces = await getSpacesForUser(appUser!.id);
        setUserSpaces(updatedSpaces);
        if (activeSpace?.id === spaceId) {
            setActiveSpace(updatedSpaces.length > 0 ? updatedSpaces[0] : null);
        }
    }

    const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
        const newEntry = await dbAddTimeEntry(timeData);
        setTimeEntries(prev => [...prev, newEntry]);
    };

    const handleInvite = async (values: Omit<Invite, 'id'|'token'|'status'>) => {
        if (!appUser) return;
        const token = randomBytes(16).toString('hex');
        const inviteData: Omit<Invite, 'id'> = {
            ...values,
            token,
            status: 'pending',
            invitedBy: appUser.id,
        };
        await dbAddInvite(inviteData);
        toast({ title: 'Invite Sent!', description: `An invitation email has been sent to ${values.email}`});
    }
    
    const handleAddMessage = async (messageData: Omit<Message, 'id'>) => {
        const optimisticMessage: Message = { ...messageData, id: `temp-${Date.now()}` };
        setMessages(prev => [...prev, optimisticMessage]);

        if (messageData.thread_id) {
            setMessages(prev => prev.map(m => m.id === messageData.thread_id ? { ...m, reply_count: (m.reply_count || 0) + 1 } : m));
        }

        try {
            const savedMessage = await dbAddMessage(messageData);
            setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? savedMessage : m));
        } catch (err) {
            console.error("Failed to send message", err);
            toast({ variant: 'destructive', title: 'Send failed', description: 'Could not send message.' });
            setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
            if (messageData.thread_id) {
                setMessages(prev => prev.map(m => m.id === messageData.thread_id ? { ...m, reply_count: (m.reply_count || 0) - 1 } : m));
            }
        }
    };

    // Mark thread replies read only when opening a single thread
    const handleViewThread = (thread: Message) => {
        setActiveThread(thread);
        setRightPanelView('thread');
        setThreadReadAt(prev => new Map(prev).set(thread.id, Date.now()));
    };
    
     const handleCreateTaskFromThread = (message: Message) => {
        setActiveThread(message);
        setRightPanelView('task-from-thread');
    };
    
    const handleCreateTask = async (taskData: Omit<Task, 'id'>) => {
       const newTask = await handleAddTask(taskData);
       if(newTask && activeThread) {
           const linkActivity: Activity = {
             id: `act-${Date.now()}`,
             user_id: appUser!.id,
             timestamp: new Date().toISOString(),
             type: 'comment',
             comment_id: `comment-${Date.now()}`,
             comment: `Created task: "${newTask.name}" from this thread.`,
           }
            
            // This is a hacky way to make the task appear on the message
            const messageWithTask = {
                ...messages.find(m => m.id === activeThread!.id)!,
                linked_task_id: newTask.id,
            }
             setMessages(prev => prev.map(m => m.id === activeThread!.id ? messageWithTask : m));
       }
    }

    const handleSaveChannel = async (channelData: Omit<Channel, 'id'>, channelId?: string) => {
        if (channelId) {
            await dbUpdateChannel(channelId, channelData);
            setChannels(prev => prev.map(c => c.id === channelId ? { id: channelId, ...channelData } : c));
            toast({ title: "Channel Updated" });
        } else {
            const newChannel = await dbAddChannel(channelData);
            setChannels(prev => [...prev, newChannel]);
            setActiveChannelId(newChannel.id);
            toast({ title: "Channel Created" });
        }
    };
    
    const handleDeleteChannel = async (channelId: string) => {
        await dbDeleteChannel(channelId);
        setChannels(prev => prev.filter(c => c.id !== channelId));
        if (activeChannelId === channelId) {
            const firstChannel = channels.find(c => c.id !== channelId);
            setActiveChannelId(firstChannel ? firstChannel.id : null);
        }
        toast({ title: "Channel Deleted" });
    }

     const handleSaveDocument = async (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string): Promise<Document> => {
        const now = new Date().toISOString();
        if (docId) {
            const updatedDocData = { ...doc, updatedAt: now };
            await updateDocument(docId, updatedDocData);
            const fullDoc = { ...documents.find(d => d.id === docId)!, ...updatedDocData};
            setDocuments(prev => prev.map(d => d.id === docId ? fullDoc : d));
            toast({ title: 'Document Saved' });
            return fullDoc;
        } else {
            const newDocData = { ...doc, createdAt: now, updatedAt: now };
            const newDoc = await addDocument(newDocData);
            setDocuments(prev => [...prev, newDoc]);
            toast({ title: 'Document Created' });
            return newDoc;
        }
    };

     const updateLocalDocument = (doc: Document) => {
        setDocuments(prev => prev.map(d => d.id === doc.id ? doc : d));
     }
    
    const handleDeleteDocument = async (docId: string) => {
        await dbDeleteDocument(docId);
        setDocuments(prev => prev.filter(d => d.id !== docId));
        toast({ title: 'Document Deleted' });
    };

    const memoizedTasks = useMemo(() => tasks, [tasks]);

    if (!appUser || isLoading || !activeSpace) {
        return <LoadingState />;
    }

    const renderContent = () => {
        switch(view) {
            case 'overview': {
                const spaceTimeEntries = timeEntries.filter(entry => {
                    const project = projects.find(p => p.id === entry.project_id);
                    return project && project.space_id === activeSpace?.id;
                });
                 return <div className="p-4 md:p-8"><Overview projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} allUsers={allUsers} jobs={jobs} jobFlowTemplates={jobFlowTemplates} jobFlowTasks={jobFlowTasks} onUpdateTask={handleUpdateTask} onTaskSelect={setSelectedTask} onDataRefresh={() => {if (activeSpace) { /* re-fetch logic here */ }}} /></div>;
            }
            case 'tasks': return <div className="p-4 md:p-8"><TaskBoard 
                                    tasks={memoizedTasks} 
                                    onUpdateTasks={setTasks} 
                                    projects={projects.filter(p => p.space_id === activeSpace!.id)} 
                                    activeSpace={activeSpace!}
                                    allUsers={allUsers}
                                    onUpdateActiveSpace={handleUpdateActiveSpace}
                                    onAddProject={handleAddProject}
                                    onUpdateProject={handleUpdateProject}
                                    onDeleteProject={handleDeleteProject}
                                    onTaskSelect={setSelectedTask}
                                    onUpdateTask={handleUpdateTask}
                                    onAddTask={handleAddTask}
                                /></div>;
            case 'mytasks':
                router.push('/mytasks'); // Should not render, just redirect
                return null;
            case 'messages': {
              const activeChannel = channels.find(c => c.id === activeChannelId);
              const channelMembers = activeChannel ? allUsers.filter(u => activeChannel.members.includes(u.id)) : [];
              const simplifiedProjects = projects.filter(p => p.space_id === activeSpace?.id).map(p => ({ id: p.id, name: p.name }));
              const threadOpen = rightPanelView === 'thread' || rightPanelView === 'threads' || rightPanelView === 'task-from-thread';
              const unreadThreadCount = unreadThreads.length;

              return (
                 <div className={cn("grid h-full transition-all duration-200 ease-in-out min-h-0", threadOpen ? 'grid-cols-[220px_minmax(0,1fr)_400px]' : 'grid-cols-[220px_minmax(0,1fr)]')}>
                    <div className="flex-col border-r bg-muted/50 hidden md:flex">
                         <div className="flex h-full flex-col">
                            <div className="p-2">
                                <Button 
                                    variant="ghost" 
                                    className="w-full justify-start text-base"
                                    onClick={() => {
                                        const opening = rightPanelView !== 'threads';
                                        setRightPanelView(opening ? 'threads' : null);

                                        if (opening) {
                                            const now = Date.now();
                                            setThreadReadAt(prev => {
                                                const next = new Map(prev);
                                                userInvolvedThreads.forEach(t => next.set(t.id, now));
                                                return next;
                                            });
                                        }
                                    }}
                                >
                                    <MessageCircleMore className="mr-2 h-5 w-5" /> Threads
                                    {unreadThreadCount > 0 && (
                                        <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{unreadThreadCount}</span>
                                    )}
                                </Button>
                            </div>
                            <div className="p-4 flex justify-between items-center border-t">
                                <h3 className="font-semibold text-lg">Channels</h3>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingChannel(null); setIsChannelFormOpen(true);}}>
                                    <Plus className="h-4 w-4"/>
                                </Button>
                            </div>
                            <div className="space-y-1 p-2 flex-1 overflow-y-auto">
                                {channels.filter(c => c.space_id === activeSpace?.id).map(channel => {
                                    
                                    const parentUnreadRaw = messages.filter(m =>
                                      String(m.channel_id) === String(channel.id) &&
                                      !m.thread_id &&
                                      String(m.user_id) !== String(appUser?.id) &&
                                      !seenParentIds.has(String(m.id))
                                    ).length;
                                    
                                    const threadUnread = unreadThreadsByChannel[channel.id] || 0;
                                    
                                    const parentUnread = String(channel.id) === String(activeChannelId) ? 0 : parentUnreadRaw;

                                    return (
                                        <div key={channel.id} className="group relative">
                                            <Button 
                                                variant={activeChannelId === channel.id ? 'secondary' : 'ghost'} 
                                                className={cn(
                                                    "w-full justify-start pr-8",
                                                    parentUnread > 0 && "font-bold"
                                                )}
                                                onClick={() => {
                                                    markChannelParentsRead(channel.id);
                                                    setActiveChannelId(channel.id);
                                                }}
                                            >
                                                # {channel.name}
                                                <div className="ml-auto flex items-center gap-1.5">
                                                    {threadUnread > 0 ? (
                                                        <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                                                            {threadUnread}
                                                        </span>
                                                    ) : parentUnread > 0 ? (
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground">
                                                            {parentUnread}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => {setEditingChannel(channel); setIsChannelFormOpen(true);}}>
                                                        <Edit className="mr-2 h-4 w-4"/> Edit Channel
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4"/> Delete Channel
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete the #{channel.name} channel and all of its messages.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteChannel(channel.id)} className={cn(buttonVariants({variant: 'destructive'}))}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
                        <ChannelsView
                            channels={channels}
                            messages={messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())}
                            allUsers={allUsers}
                            tasks={tasks}
                            statuses={activeSpace!.statuses}
                            activeChannelId={activeChannelId}
                            setMessages={setMessages}
                            onCreateTask={handleCreateTaskFromThread}
                            onViewThread={handleViewThread}
                            onAddMessage={handleAddMessage}
                        />
                    </div>
                     {threadOpen && (
                        <div className="w-[400px] border-l bg-card h-full overflow-y-auto hidden md:block">
                            {rightPanelView === 'threads' && (
                                <AllThreadsView
                                    messages={messages}
                                    allUsers={allUsers}
                                    appUser={appUser}
                                    onViewThread={handleViewThread}
                                    isThreadUnread={isThreadUnread}
                                    onAddMessage={handleAddMessage}
                                    channels={channels}
                                    threads={userInvolvedThreads}
                                />
                            )}
                            {rightPanelView === 'thread' && activeThread && (
                                <ThreadView
                                    thread={activeThread}
                                    messages={messages}
                                    allUsers={allUsers}
                                    channels={channels}
                                    onClose={() => setRightPanelView(null)}
                                    onAddMessage={handleAddMessage}
                                />
                            )}
                            {rightPanelView === 'task-from-thread' && activeThread && (
                                <CreateTaskFromThreadDialog
                                    isOpen={rightPanelView === 'task-from-thread'}
                                    onOpenChange={() => setRightPanelView(null)}
                                    message={activeThread}
                                    channelMembers={channelMembers.map(u => ({ id: u.id, name: u.name }))}
                                    projects={simplifiedProjects}
                                    onTaskCreated={handleCreateTask}
                                />
                            )}
                        </div>
                    )}
                </div>
              );
            }
            case 'timesheets': return <div className="p-4 md:p-8"><TeamTimesheets allSpaces={userSpaces} allUsers={allUsers} projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} /></div>;
            case 'reports': return <div className="p-4 md:p-8"><MeetingReview slackMeetingLogs={slackLogs} projects={projects} allUsers={allUsers} /></div>;
            case 'documents':
                 router.push('/documents');
                 return null;
            case 'flows': 
                const renderFlowsContent = () => {
                    switch(flowsView) {
                        case 'job_flows': return <JobFlowBoard 
                                                    activeSpace={activeSpace!} 
                                                    allUsers={allUsers} 
                                                    jobFlowTemplates={jobFlowTemplates.filter(t => t.space_id === activeSpace!.id)}
                                                    jobs={jobs.filter(j => j.space_id === activeSpace!.id)}
                                                    jobFlowTasks={jobFlowTasks}
                                                    tasks={tasks}
                                                    onJobLaunched={() => { /* re-fetch */ }}
                                                    onUpdateTask={handleUpdateTask}
                                                    onTaskSelect={setSelectedTask}
                                                 />;
                        case 'templates': return <div className="p-4"><JobFlowTemplateBuilder 
                                                    templates={jobFlowTemplates.filter(t => t.space_id === activeSpace!.id)} 
                                                    phaseTemplates={phaseTemplates.filter(t => t.space_id === activeSpace!.id)}
                                                    allUsers={allUsers}
                                                    activeSpaceId={activeSpace!.id}
                                                    onSave={async (data) => {
                                                        const newTemplate = await dbAddJobFlowTemplate(data);
                                                        setJobFlowTemplates(prev => [...prev, newTemplate]);
                                                    }}
                                                 /></div>;
                        case 'phases': return <div className="p-4"><PhaseTemplateBuilder
                                                  templates={phaseTemplates.filter(t => t.space_id === activeSpace!.id)}
                                                  allUsers={allUsers}
                                                  taskTemplates={taskTemplates.filter(t => t.space_id === activeSpace!.id)}
                                                  activeSpaceId={activeSpace!.id}
                                                  onSave={async (data) => {
                                                      const newTemplate = await dbAddPhaseTemplate(data);
                                                      setPhaseTemplates(prev => [...prev, newTemplate]);
                                                  }}
                                              /></div>;
                        case 'tasks': return <div className="p-4"><TaskTemplateBuilder 
                                                templates={taskTemplates.filter(t => t.space_id === activeSpace!.id)}
                                                allUsers={allUsers}
                                                activeSpaceId={activeSpace!.id}
                                                onSave={async (data) => {
                                                    const newTemplate = await dbAddTaskTemplate(data);
                                                    setTaskTemplates(prev => [...prev, newTemplate]);
                                                }}
                                            /></div>;
                        default: return null;
                    }
                }
                const isTemplateView = ['templates', 'phases', 'tasks'].includes(flowsView);
                return (
                     <div className="flex flex-col h-full p-4 md:px-8 md:pt-8">
                        <div className="flex items-center p-2">
                            <Button 
                                variant="ghost" 
                                onClick={() => setFlowsView('job_flows')}
                                className={cn(flowsView === 'job_flows' && 'bg-accent')}
                            >
                                Job Flows
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        className={cn(isTemplateView && 'bg-accent')}
                                    >
                                        Templates <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => setFlowsView('templates')}>Flow Templates</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setFlowsView('phases')}>Phase Templates</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setFlowsView('tasks')}>Task Templates</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                         <div className="flex-1 overflow-auto">
                            {renderFlowsContent()}
                        </div>
                    </div>
                )
            case 'settings': 
                return (
                    <div className="flex gap-6 h-full p-4 md:p-8">
                        <aside className="w-56 flex-shrink-0 border-r pr-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Settings</h2>
                            </div>
                            <div className="space-y-1">
                                <Button variant={settingsView === 'users' ? 'secondary' : 'ghost'} onClick={() => setSettingsView('users')} className="w-full justify-start">Users & Permissions</Button>
                                <Button variant={settingsView === 'spaces' ? 'secondary' : 'ghost'} onClick={() => setSettingsView('spaces')} className="w-full justify-start">Spaces</Button>
                            </div>
                        </aside>
                        <main className="flex-1 overflow-auto">
                           {settingsView === 'users' && <UserSettings allUsers={allUsers} allSpaces={userSpaces} appUser={appUser} onInvite={() => {}} handleInvite={handleInvite} />}
                           {settingsView === 'spaces' && <SpaceSettings allSpaces={userSpaces} allUsers={allUsers} appUser={appUser} onSave={handleSaveSpace} onDelete={handleDeleteSpace} />}
                        </main>
                    </div>
                )
            default: return <div>Not implemented</div>;
        }
    }

    return (
      <SidebarProvider defaultOpen={false}>
        <div className="flex flex-col h-screen">
          <TopBar />
           <div className="flex flex-1 pt-16 overflow-hidden min-h-0">
                <Sidebar collapsible="icon">
                    <div className="flex flex-col h-full">
                        <div className="space-y-2 pt-4">
                            <Button onClick={() => setView('overview')} variant={view === 'overview' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BarChart className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => setView('tasks')} variant={view === 'tasks' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <FolderKanban className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/mytasks')} variant={view === 'mytasks' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <ClipboardCheck className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => setView('messages')} variant={view === 'messages' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <MessageSquare className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/documents')} variant={view === 'documents' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BookOpen className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => setView('timesheets')} variant={view === 'timesheets' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Timer className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => setView('flows')} variant={view === 'flows' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Workflow className="w-7 h-7"/>
                            </Button>
                        </div>
                        <div className="mt-auto space-y-2">
                            <Button onClick={() => setView('settings')} variant={view === 'settings' ? 'secondary' : 'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Settings className="w-7 h-7"/>
                            </Button>
                        </div>
                    </div>
                </Sidebar>
                <main className={cn(
                    "flex-1 flex flex-col min-h-0",
                    view === 'messages' ? 'overflow-hidden' : 'overflow-auto'
                )}>
                    {renderContent()}
                </main>
            </div>
        </div>
        {selectedTask && (
             <TaskDetailsDialog
                key={selectedTask.id}
                task={selectedTask}
                isOpen={!!selectedTask}
                timeEntries={timeEntries.filter(t => t.task_id === selectedTask.id)}
                allUsers={allUsers}
                allTasks={tasks}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setSelectedTask(null);
                }}
                onUpdateTask={handleUpdateTask}
                onAddTask={async (taskData, tempId) => {
                    const newTask = await handleAddTask(taskData);
                    return newTask;
                }}
                onRemoveTask={handleRemoveTask}
                onTaskSelect={setSelectedTask}
                onLogTime={handleLogTime}
                statuses={activeSpace!.statuses.map(s => s.name)}
                projects={projects}
             />
        )}
        <CreateChannelDialog
            isOpen={isChannelFormOpen}
            onOpenChange={setIsChannelFormOpen}
            spaceId={activeSpace.id}
            spaceMembers={allUsers.filter(u => activeSpace.members[u.id])}
            onSave={handleSaveChannel}
            editingChannel={editingChannel}
        />
      </SidebarProvider>
    );
}

export default function Dashboard() {
    return (
        <Suspense fallback={<LoadingState />}>
            <DashboardComponent />
        </Suspense>
    )
}

    










