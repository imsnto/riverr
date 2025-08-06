
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import { FolderKanban, MessageSquare, Timer, Settings, UserPlus, FilePlus, Bot, Workflow, BarChart } from 'lucide-react';
import { Space, User, Project, Task, TimeEntry, SlackMeetingLog, Channel, Message, Invite, Status, JobFlowTemplate, Job, JobFlowTask, PhaseTemplate, TaskTemplate, Activity } from '@/lib/data';
import Header from '@/components/dashboard/header';
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
    addPhaseTemplate as dbAddPhaseTemplate,
    addTaskTemplate as dbAddTaskTemplate,
} from '@/lib/db';
import MeetingReview from '@/components/dashboard/meeting-review';
import ChannelsView from '@/components/dashboard/channels-view';
import ThreadView from '@/components/dashboard/thread-view';
import AllThreadsView from '@/components/dashboard/all-threads-view';
import CreateTaskFromThreadDialog from '@/components/dashboard/create-task-from-thread-dialog';
import TaskDetailsDialog from '@/components/dashboard/task-details-dialog';
import SpaceSettings from '@/components/dashboard/space-settings';
import UserSettings from '@/components/dashboard/user-settings';
import { randomBytes } from 'crypto';
import JobFlowTemplateBuilder from '@/components/dashboard/job-flow-template-builder';
import PhaseTemplateBuilder from '@/components/dashboard/phase-template-builder';
import TaskTemplateBuilder from '@/components/dashboard/task-template-builder';
import JobFlowBoard from '@/components/dashboard/job-flow-board';
import { Button } from '@/components/ui/button';


type View = 'overview' | 'tasks' | 'messages' | 'timesheets' | 'reports' | 'flows' | 'settings';
type SettingsView = 'users' | 'spaces';
type FlowsView = 'job_flows' | 'templates' | 'phases' | 'tasks';

const LoadingState = () => (
    <div className="flex h-full w-full items-center justify-center">
        <p>Loading your workspace...</p>
    </div>
);

export default function Dashboard() {
    const { appUser, userSpaces, setUserSpaces } = useAuth();
    const { toast } = useToast();
    
    const [activeSpace, setActiveSpace] = useState<Space | null>(null);
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
    
    const [view, setView] = useState<View>('tasks');
    const [settingsView, setSettingsView] = useState<SettingsView>('users');
    const [flowsView, setFlowsView] = useState<FlowsView>('job_flows');
    const [isLoading, setIsLoading] = useState(true);
    
    // For messaging
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [rightPanelView, setRightPanelView] = useState<'threads' | 'thread' | 'task-from-thread' | null>('threads');
    const [activeThread, setActiveThread] = useState<Message | null>(null);
    const [readThreadIds, setReadThreadIds] = useState<Set<string>>(new Set());
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    
    const fetchData = async (space: Space) => {
        setIsLoading(true);
        try {
            // First, fetch data that doesn't have dependencies
            const [
                users, fetchedProjects, allTasks, fetchedChannels, jobTemplates, 
                fetchedJobs, fetchedJobFlowTasks, phaseTpls, taskTpls
            ] = await Promise.all([
                getAllUsers(),
                getProjectsInSpace(space.id),
                getAllTasks(), // In a larger app, this should be paginated/filtered
                getChannelsInSpace(space.id),
                getJobFlowTemplates(),
                getAllJobs(space.id),
                getAllJobFlowTasks(space.id),
                getPhaseTemplates(),
                getTaskTemplates(),
            ]);

            setAllUsers(users);
            setProjects(fetchedProjects);
            setTasks(allTasks);
            setChannels(fetchedChannels);
            setJobFlowTemplates(jobTemplates);
            setJobs(fetchedJobs);
            setJobFlowTasks(fetchedJobFlowTasks);
            setPhaseTemplates(phaseTpls);
            setTaskTemplates(taskTpls);

            // Now, fetch data that depends on the results above
            const [fetchedTimeEntries, fetchedSlackLogs, fetchedMessages] = await Promise.all([
                getTimeEntriesInSpace(fetchedProjects.map(p => p.id)),
                getSlackMeetingLogsInSpace(space.id),
                Promise.all(
                    fetchedChannels.map(c => getMessagesInChannel(c.id))
                ).then(msgArrays => msgArrays.flat()),
            ]);
            
            setTimeEntries(fetchedTimeEntries);
            setSlackLogs(fetchedSlackLogs);
            setMessages(fetchedMessages);

            if (fetchedChannels.length > 0 && !activeChannelId) {
                setActiveChannelId(fetchedChannels[0].id);
            }

        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load workspace data.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (userSpaces.length > 0 && !activeSpace) {
            setActiveSpace(userSpaces[0]);
        }
    }, [userSpaces, activeSpace]);

    useEffect(() => {
        if (activeSpace) {
            fetchData(activeSpace);
        }
    }, [activeSpace]);

    const handleSpaceChange = (spaceId: string) => {
        const newSpace = userSpaces.find(s => s.id === spaceId);
        if (newSpace) {
            setActiveSpace(newSpace);
        }
    };
    
    const handleUpdateActiveSpace = async (updatedData: Partial<Space>) => {
        if (!activeSpace) return;
        
        const optimisticSpace = { ...activeSpace, ...updatedData };
        setActiveSpace(optimisticSpace);
        setUserSpaces(prev => prev.map(s => s.id === activeSpace.id ? optimisticSpace : s));
        
        try {
            await dbUpdateSpace(activeSpace.id, updatedData);
        } catch(e) {
            toast({ variant: 'destructive', title: 'Update failed', description: 'Could not save space changes.' });
            // Revert optimistic update
            setActiveSpace(activeSpace);
            setUserSpaces(userSpaces);
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

        try {
            if (tempId) { // This is a new task that needs to be created
                 const { id: _omit, ...taskWithoutId } = updatedTask;
                 const savedTask = await dbAddTask(taskWithoutId);
                 setTasks(prev => prev.map(t => t.id === tempId ? savedTask : t));
                 if (selectedTask?.id === tempId) setSelectedTask(savedTask);
            } else {
                await dbUpdateTask(updatedTask.id, updatedTask);
            }
        } catch(e) {
            console.error("Task update failed", e);
            toast({ variant: 'destructive', title: 'Update failed', description: 'Could not save task changes.' });
            // Revert optimistic update
            setTasks(tasks);
        }
    };
    
    const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
        try {
            const newTask = await dbAddTask(taskData);
            setTasks(prev => [...prev, newTask]);
            return newTask;
        } catch (e) {
            console.error("Task add failed", e);
            toast({ variant: 'destructive', title: 'Create failed', description: 'Could not create new task.' });
            return null;
        }
    }
    
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

    const handleViewThread = (thread: Message) => {
        setActiveThread(thread);
        setRightPanelView('thread');
        setReadThreadIds(prev => new Set(prev).add(thread.id));
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

    const memoizedTasks = useMemo(() => tasks, [tasks]);

    if (!appUser || !activeSpace || isLoading) {
        return <LoadingState />;
    }

    const renderContent = () => {
        switch(view) {
            case 'overview': return <Overview projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} allUsers={allUsers}/>;
            case 'tasks': return <TaskBoard 
                                    tasks={memoizedTasks} 
                                    onUpdateTasks={setTasks} 
                                    projects={projects.filter(p => p.space_id === activeSpace.id)} 
                                    activeSpace={activeSpace}
                                    allUsers={allUsers}
                                    onUpdateActiveSpace={handleUpdateActiveSpace}
                                    onAddProject={handleAddProject}
                                    onUpdateProject={handleUpdateProject}
                                    onDeleteProject={handleDeleteProject}
                                    onTaskSelect={setSelectedTask}
                                    onUpdateTask={handleUpdateTask}
                                    onAddTask={(task) => {handleAddTask(task)}}
                                />;
            case 'messages': 
              const channelMembers = channels.find(c => c.id === activeChannelId)?.members.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
              const SimplifiedProjects = projects.map(p => ({ id: p.id, name: p.name }));
                
              return (
                 <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] h-[calc(100vh-4rem)]">
                    <div className="flex flex-col h-full">
                       <div className="flex justify-between items-center p-4 border-b">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                <h2 className="text-xl font-bold">Messages</h2>
                            </div>
                       </div>
                       <div className="flex-1 grid grid-cols-[250px_1fr] overflow-hidden">
                          <div className="border-r h-full overflow-y-auto">
                              <div className="p-4">
                                <h3 className="font-semibold text-lg">Channels</h3>
                              </div>
                              <div className="space-y-1 p-2">
                                {channels.map(channel => (
                                  <Button 
                                    key={channel.id} 
                                    variant={activeChannelId === channel.id ? 'secondary' : 'ghost'} 
                                    className="w-full justify-start"
                                    onClick={() => setActiveChannelId(channel.id)}
                                  >
                                    # {channel.name}
                                  </Button>
                                ))}
                              </div>
                          </div>
                          <ChannelsView
                             channels={channels}
                             messages={messages}
                             allUsers={allUsers}
                             tasks={tasks}
                             statuses={activeSpace.statuses}
                             activeChannelId={activeChannelId}
                             setMessages={setMessages}
                             onCreateTask={handleCreateTaskFromThread}
                             onViewThread={handleViewThread}
                          />
                       </div>
                    </div>
                    <div className="border-l bg-card h-full">
                      {rightPanelView === 'threads' && (
                        <AllThreadsView
                          messages={messages}
                          allUsers={allUsers}
                          appUser={appUser}
                          onViewThread={handleViewThread}
                          readThreadIds={readThreadIds}
                        />
                      )}
                      {rightPanelView === 'thread' && activeThread && (
                         <ThreadView
                            thread={activeThread}
                            messages={messages}
                            allUsers={allUsers}
                            setMessages={setMessages}
                            onClose={() => setRightPanelView('threads')}
                         />
                      )}
                      {rightPanelView === 'task-from-thread' && activeThread && (
                         <CreateTaskFromThreadDialog
                            isOpen={rightPanelView === 'task-from-thread'}
                            onOpenChange={() => setRightPanelView('threads')}
                            message={activeThread}
                            channelMembers={channelMembers.map(u => ({ id: u.id, name: u.name }))}
                            projects={SimplifiedProjects}
                            onTaskCreated={handleCreateTask}
                         />
                      )}
                    </div>
                </div>
            )
            case 'timesheets': return <TeamTimesheets space={activeSpace} allUsers={allUsers} projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} />;
            case 'reports': return <MeetingReview slackMeetingLogs={slackLogs} projects={projects} allUsers={allUsers} />;
            case 'flows': 
                const renderFlowsContent = () => {
                    switch(flowsView) {
                        case 'job_flows': return <JobFlowBoard 
                                                    activeSpace={activeSpace} 
                                                    allUsers={allUsers} 
                                                    jobFlowTemplates={jobFlowTemplates}
                                                    jobs={jobs}
                                                    jobFlowTasks={jobFlowTasks}
                                                    tasks={tasks}
                                                    onJobLaunched={() => fetchData(activeSpace)}
                                                    onUpdateTask={handleUpdateTask}
                                                 />;
                        case 'templates': return <JobFlowTemplateBuilder 
                                                    templates={jobFlowTemplates} 
                                                    phaseTemplates={phaseTemplates}
                                                    allUsers={allUsers}
                                                    onSave={() => {}}
                                                 />;
                        case 'phases': return <PhaseTemplateBuilder
                                                  templates={phaseTemplates}
                                                  allUsers={allUsers}
                                                  taskTemplates={taskTemplates}
                                                  onSave={async (data) => {
                                                      const newTemplate = await dbAddPhaseTemplate(data);
                                                      setPhaseTemplates(prev => [...prev, newTemplate]);
                                                  }}
                                              />;
                        case 'tasks': return <TaskTemplateBuilder 
                                                templates={taskTemplates}
                                                allUsers={allUsers}
                                                onSave={async (data) => {
                                                    const newTemplate = await dbAddTaskTemplate(data);
                                                    setTaskTemplates(prev => [...prev, newTemplate]);
                                                }}
                                            />;
                        default: return null;
                    }
                }
                return (
                     <div className="flex gap-6 h-full">
                        <aside className="w-56 flex-shrink-0 border-r pr-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Flows</h2>
                            </div>
                            <div className="space-y-1">
                                <Button variant={flowsView === 'job_flows' ? 'secondary' : 'ghost'} onClick={() => setFlowsView('job_flows')} className="w-full justify-start">Job Flows</Button>
                                <Button variant={flowsView === 'templates' ? 'secondary' : 'ghost'} onClick={() => setFlowsView('templates')} className="w-full justify-start">Flow Templates</Button>
                                <Button variant={flowsView === 'phases' ? 'secondary' : 'ghost'} onClick={() => setFlowsView('phases')} className="w-full justify-start">Phase Templates</Button>
                                <Button variant={flowsView === 'tasks' ? 'secondary' : 'ghost'} onClick={() => setFlowsView('tasks')} className="w-full justify-start">Task Templates</Button>
                            </div>
                        </aside>
                         <main className="flex-1 overflow-auto">
                            {renderFlowsContent()}
                        </main>
                    </div>
                )
            case 'settings': 
                return (
                    <div className="flex gap-6 h-full">
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
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <h2 className="text-xl font-semibold px-2">TimeFlow</h2>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('overview')} isActive={view === 'overview'}>
                                <BarChart /> <span>Overview</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('tasks')} isActive={view === 'tasks'}>
                                <FolderKanban /> <span>Tasks</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('messages')} isActive={view === 'messages'}>
                                <MessageSquare /> <span>Messages</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('timesheets')} isActive={view === 'timesheets'}>
                                <Timer /> <span>Timesheets</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('flows')} isActive={view === 'flows'}>
                                <Workflow /> <span>Flows</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setView('settings')} isActive={view === 'settings'}>
                                <Settings /> <span>Settings</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={userSpaces} appUser={appUser} />
                <main className="p-4 md:p-8 flex-1">
                    {renderContent()}
                </main>
            </SidebarInset>
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
                    onAddTask={(task) => handleAddTask(task)}
                    onRemoveTask={(taskId) => setTasks(prev => prev.filter(t => t.id !== taskId))}
                    onTaskSelect={setSelectedTask}
                    onLogTime={handleLogTime}
                    statuses={activeSpace.statuses.map(s => s.name)}
                    projects={projects}
                 />
            )}
        </SidebarProvider>
    );
}

    