
'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, GanttChart, MessageSquare, Settings, Users, MessageCircleMore } from 'lucide-react';
import { User, Space, Project, Task, SlackMeetingLog, TimeEntry, Channel, Message, Status, Invite } from '@/lib/data';
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
import { getAllSpaces as dbGetAllSpaces, getProjectsInSpace as dbGetProjects, getTasksInSpace as dbGetTasks, getTimeEntriesInSpace as dbGetTimeEntries, getSlackMeetingLogsInSpace as dbGetSlackLogs, getAllUsers as dbGetAllUsers, getChannelsInSpace as dbGetChannels, getMessagesInChannel as dbGetMessages, addTask as dbAddTask, updateSpace as dbUpdateSpace, updateTask, addSpace as dbAddSpace, deleteSpace as dbDeleteSpace, seedDatabase, addInvite as dbAddInvite } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import ChannelsView from '@/components/dashboard/channels-view';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CreateTaskFromThreadDialog from '@/components/dashboard/create-task-from-thread-dialog';
import ThreadView from '@/components/dashboard/thread-view';
import AllThreadsView from '@/components/dashboard/all-threads-view';
import { useToast } from '@/hooks/use-toast';


export default function Dashboard() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [meetingLogs, setMeetingLogs] = useState<SlackMeetingLog[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedMessageForTask, setSelectedMessageForTask] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(new Set());

  const [channelsViewMode, setChannelsViewMode] = useState<'channel' | 'all-threads'>('channel');


  useEffect(() => {
    async function loadInitialData() {
        if (!appUser) return;
        setIsLoading(true);
        await seedDatabase();

        const [users, spaces] = await Promise.all([dbGetAllUsers(), dbGetAllSpaces()]);
        setAllUsers(users);
        setAllSpaces(spaces);
        
        const userSpaces = spaces.filter(s => s.members.includes(appUser!.id));
        if (userSpaces.length > 0) {
          setActiveSpaceId(userSpaces[0].id);
        } else if (spaces.length > 0) {
          setActiveSpaceId(spaces[0].id);
        } else {
          // If no spaces exist, let's create a default one for the user
          const newSpace: Omit<Space, 'id'> = {
            name: `${appUser.name}'s Space`,
            members: [appUser.id],
            statuses: [
                { name: 'Backlog', color: '#6b7280' },
                { name: 'In Progress', color: '#3b82f6' },
                { name: 'Review', color: '#f59e0b' },
                { name: 'Done', color: '#22c55e' },
            ]
          };
          const newSpaceId = await dbAddSpace(newSpace);
          const createdSpace = { ...newSpace, id: newSpaceId };
          setAllSpaces([createdSpace]);
          setActiveSpaceId(newSpaceId);
        }
        setIsLoading(false);
    }
    loadInitialData();
  }, [appUser]); 

  useEffect(() => {
    async function loadSpaceData() {
      if (activeSpaceId) {
        setIsLoading(true);
        const [projectsInSpace, channelsInSpace] = await Promise.all([
            dbGetProjects(activeSpaceId),
            dbGetChannels(activeSpaceId),
        ]);
        setProjects(projectsInSpace);
        setChannels(channelsInSpace);
        
        const allMessagesInChannels = await Promise.all(channelsInSpace.map(c => dbGetMessages(c.id))).then(res => res.flat());
        setMessages(allMessagesInChannels);

        if (channelsInSpace.length > 0 && !activeChannelId) {
          setActiveChannelId(channelsInSpace[0].id);
        } else if (channelsInSpace.length === 0) {
          setActiveChannelId(null);
          setMessages([]);
        }

        const projectIds = projectsInSpace.map(p => p.id);

        if (projectIds.length > 0) {
            const [tasksInSpace, timeEntriesInSpace, meetingLogsInSpace] = await Promise.all([
                dbGetTasks(projectIds),
                dbGetTimeEntries(projectIds),
                dbGetSlackLogs(activeSpaceId), // Use spaceId to get unassigned logs in that space context
            ]);
            setTasks(tasksInSpace);
            setTimeEntries(timeEntriesInSpace);
            setMeetingLogs(meetingLogsInSpace);
        } else {
            setTasks([]);
            setTimeEntries([]);
            setMeetingLogs([]);
        }
        setIsLoading(false);
      }
    }
    loadSpaceData();
  }, [activeSpaceId]);
  
  const handleOpenCreateTaskDialog = (message: Message) => {
    setSelectedMessageForTask(message);
    setIsCreateTaskOpen(true);
  }

  const handleTaskCreated = async (taskData: Omit<Task, 'id'>) => {
    const newTask = await dbAddTask(taskData);
    setTasks(prev => [...prev, newTask]);
    
    if (selectedMessageForTask) {
      const updatedMessage = { ...selectedMessageForTask, linked_task_id: newTask.id };
      // TODO: Update message in DB
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === selectedMessageForTask.id 
            ? updatedMessage
            : msg
        )
      );
    }
  }

  const handleUpdateTasks = async (updatedTasks: Task[]) => {
    // This is a simple but inefficient way to handle updates.
    // In a real app, you'd want to find the specific task that changed and update it.
    for (const task of updatedTasks) {
      const originalTask = tasks.find(t => t.id === task.id);
      if (originalTask && JSON.stringify(originalTask) !== JSON.stringify(task)) {
        await updateTask(task.id, task);
      }
    }
    setTasks(updatedTasks);
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

  const handleSaveSpace = async (spaceData: Space) => {
     if (spaceData.id) { // Existing space
        await dbUpdateSpace(spaceData.id, spaceData);
        setAllSpaces(allSpaces.map(s => s.id === spaceData.id ? spaceData : s));
      } else { // New space
        const newId = await dbAddSpace({ name: spaceData.name, members: spaceData.members, statuses: spaceData.statuses });
        setAllSpaces([...allSpaces, { ...spaceData, id: newId }]);
      }
  }
  
  const handleDeleteSpace = async (spaceId: string) => {
      await dbDeleteSpace(spaceId);
      setAllSpaces(allSpaces.filter(s => s.id !== spaceId));
  }

  const handleInviteUser = async (values: Invite) => {
    try {
        await dbAddInvite(values);
        toast({
            title: 'User Invited',
            description: `${values.email} has been invited. They will get access once they sign in.`
        });
    } catch (error) {
        console.error("Error inviting user: ", error);
        toast({
            variant: 'destructive',
            title: 'Invite Failed',
            description: 'Could not send the invitation. Please try again.'
        });
    }
  }


  if (!appUser) {
    return <div className="flex h-screen items-center justify-center">Loading user data...</div>;
  }
  
  const userSpaces = allSpaces.filter(s => s.members.includes(appUser.id));
  const activeSpace = allSpaces.find(s => s.id === activeSpaceId) || userSpaces[0] || allSpaces[0];
  
  const handleSpaceChange = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setActiveThread(null);
    setActiveChannelId(null);
  };
  
  if (isLoading && !activeSpace) {
    return <div className="flex justify-center items-center h-screen">Loading your workspace...</div>;
  }
  
  const parentMessagesWithReplies = messages.filter(m => m.reply_count && m.reply_count > 0);
  const userInvolvedThreads = parentMessagesWithReplies.filter(parent => {
      const threadMessages = messages.filter(m => m.thread_id === parent.id);
      const participants = new Set([parent.user_id, ...threadMessages.map(m => m.user_id)]);
      return participants.has(appUser.id);
  });
  const hasUnreadThreads = userInvolvedThreads.some(t => !readThreadIds.has(t.id));


  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-background font-body">
        <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={userSpaces.length > 0 ? userSpaces : allSpaces} appUser={appUser} />
        <div className="flex flex-1 overflow-hidden">
          {/* Primary Sidebar */}
          <aside className="hidden w-20 flex-col items-center border-r bg-card p-4 md:flex">
            <nav className="flex flex-col items-center gap-4">
              {NAV_ITEMS.map(item => {
                if (item.adminOnly && (!appUser || appUser.role !== 'Admin')) {
                  return null;
                }
                return (
                  <Tooltip key={item.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => setActiveTab(item.id)}
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

          {/* Main Content */}
          <main className={cn("flex-1 overflow-auto", activeTab === 'channels' && "flex")}>
              {activeTab === 'dashboard' && (
                <div className="p-4 md:p-8">
                {isLoading ? <div className="flex justify-center items-center h-full">Loading dashboard...</div> : 
                <>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <Overview projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} allUsers={allUsers} />
                      </div>
                      <div className="flex flex-col gap-6">
                        <Timer tasks={tasks} appUser={appUser} />
                        <ManualTimeEntry projects={projects} tasks={tasks} appUser={appUser}/>
                      </div>
                    </div>
                    <div className="mt-6">
                      <MeetingReview slackMeetingLogs={meetingLogs} projects={projects} allUsers={allUsers} />
                    </div>
                  </>
                }
                </div>
              )}
              {activeTab === 'channels' && (
                <div className="flex flex-1">
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
                <div className="p-4 md:p-8">
                {isLoading ? <div className="flex justify-center items-center h-full">Loading tasks...</div> : <TaskBoard tasks={tasks} onUpdateTasks={handleUpdateTasks} projects={projects} activeSpace={activeSpace} allUsers={allUsers} onUpdateActiveSpace={handleUpdateActiveSpace} />}
                </div>
              )}
              {appUser.role === 'Admin' && activeTab === 'timesheets' && (
                  <div className="p-4 md:p-8">
                  {isLoading ? <div className="flex justify-center items-center h-full">Loading timesheets...</div> : <TeamTimesheets timeEntries={timeEntries} projects={projects} tasks={tasks} space={activeSpace} allUsers={allUsers} />}
                  </div>
              )}
              {appUser.role === 'Admin' && activeTab === 'settings' && (
                  <div className="p-4 md:p-8">
                      <h1 className="text-2xl font-bold mb-4">Settings</h1>
                      <Tabs defaultValue="spaces" className="w-full">
                          <TabsList>
                          <TabsTrigger value="spaces">Spaces</TabsTrigger>
                          <TabsTrigger value="users">Users</TabsTrigger>
                          </TabsList>
                          <TabsContent value="spaces">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading spaces...</div> : <SpaceSettings allSpaces={allSpaces} allUsers={allUsers} onSave={handleSaveSpace} onDelete={handleDeleteSpace} appUser={appUser} />}
                          </TabsContent>
                          <TabsContent value="users">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading users...</div> : <UserSettings allUsers={allUsers} allSpaces={allSpaces} onInviteUser={handleInviteUser} appUser={appUser} />}
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
    </TooltipProvider>
  );
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: GanttChart },
  { id: 'tasks', label: 'Task Board', icon: FolderKanban },
  { id: 'channels', label: 'Channels', icon: MessageSquare },
  { id: 'timesheets', label: 'Team Timesheets', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

    

    