
'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, GanttChart, MessageSquare, Settings, Users } from 'lucide-react';
import { User, Space, Project, Task, SlackMeetingLog, TimeEntry, Channel, Message } from '@/lib/data';
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
import { getAllSpaces as dbGetAllSpaces, getProjectsInSpace as dbGetProjects, getTasksInSpace as dbGetTasks, getTimeEntriesInSpace as dbGetTimeEntries, getSlackMeetingLogsInSpace as dbGetSlackLogs, getAllUsers as dbGetAllUsers, getChannelsInSpace as dbGetChannels, getMessagesInChannel as dbGetMessages } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import ChannelsView from '@/components/dashboard/channels-view';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


function Dashboard() {
  const { appUser } = useAuth();

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

  useEffect(() => {
    async function loadInitialData() {
        if (!appUser) return;
        setIsLoading(true);

        const [users, spaces] = await Promise.all([dbGetAllUsers(), dbGetAllSpaces()]);
        setAllUsers(users);
        setAllSpaces(spaces);
        
        const userSpaces = spaces.filter(s => s.members.includes(appUser!.id));
        if (userSpaces.length > 0) {
          setActiveSpaceId(userSpaces[0].id);
        } else if (spaces.length > 0) {
          setActiveSpaceId(spaces[0].id);
        } else {
          setIsLoading(false);
        }
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
        if (channelsInSpace.length > 0 && !activeChannelId) {
          setActiveChannelId(channelsInSpace[0].id);
        } else if (channelsInSpace.length === 0) {
          setActiveChannelId(null);
        }

        const projectIds = projectsInSpace.map(p => p.id);
        const channelIds = channelsInSpace.map(c => c.id);

        if (projectIds.length > 0 || channelIds.length > 0) {
            const [tasksInSpace, timeEntriesInSpace, meetingLogsInSpace, messagesInSpace] = await Promise.all([
                projectIds.length > 0 ? dbGetTasks(projectIds) : Promise.resolve([]),
                projectIds.length > 0 ? dbGetTimeEntries(projectIds) : Promise.resolve([]),
                projectIds.length > 0 ? dbGetSlackLogs(projectIds) : Promise.resolve([]),
                channelIds.length > 0 ? Promise.all(channelIds.map(dbGetMessages)).then(res => res.flat()) : Promise.resolve([]),
            ]);
            setTasks(tasksInSpace);
            setTimeEntries(timeEntriesInSpace);
            setMeetingLogs(meetingLogsInSpace);
            setMessages(messagesInSpace);
        } else {
            setTasks([]);
            setTimeEntries([]);
            setMeetingLogs([]);
            setMessages([]);
        }
        setIsLoading(false);
      }
    }
    loadSpaceData();
  }, [activeSpaceId, activeChannelId]);
  
  if (!appUser) {
    return <div className="flex h-screen items-center justify-center">Loading user data...</div>;
  }
  
  const userSpaces = allSpaces.filter(s => s.members.includes(appUser.id));
  const activeSpace = allSpaces.find(s => s.id === activeSpaceId) || userSpaces[0] || allSpaces[0];
  
  const handleSpaceChange = (spaceId: string) => {
    setActiveSpaceId(spaceId);
  };
  
  if (isLoading && !activeSpace) {
    return <div className="flex justify-center items-center h-screen">Loading your workspace...</div>;
  }
  
  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-background font-body">
        <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={userSpaces.length > 0 ? userSpaces : allSpaces} appUser={appUser} />
        <div className="flex flex-1 overflow-hidden">
          {/* Primary Sidebar */}
          <aside className="hidden w-20 flex-col items-center border-r bg-card p-4 md:flex">
            <nav className="flex flex-col items-center gap-4">
              {NAV_ITEMS.map(item => {
                if (item.adminOnly && appUser.role !== 'Admin') {
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
                    {channels.map(channel => (
                      <Button
                        key={channel.id}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2',
                          activeChannelId === channel.id && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => setActiveChannelId(channel.id)}
                      >
                        {channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                        {channel.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 md:p-8">
              {activeTab === 'dashboard' && (
                isLoading ? <div className="flex justify-center items-center h-full">Loading dashboard...</div> : 
                <>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <Overview projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser} />
                      </div>
                      <div className="flex flex-col gap-6">
                        <Timer tasks={tasks} appUser={appUser} />
                        <ManualTimeEntry projects={projects} tasks={tasks} appUser={appUser}/>
                      </div>
                    </div>
                    <div className="mt-6">
                      <MeetingReview slackMeetingLogs={meetingLogs} projects={projects} />
                    </div>
                  </>
                )
              }
              {activeTab === 'channels' && (
                isLoading ? <div className="flex justify-center items-center h-full">Loading channels...</div> : 
                <ChannelsView 
                  channels={channels}
                  messages={messages} 
                  allUsers={allUsers} 
                  activeChannelId={activeChannelId}
                  setMessages={setMessages}
                />
              )}
              {activeTab === 'tasks' && (
                isLoading ? <div className="flex justify-center items-center h-full">Loading tasks...</div> : <TaskBoard initialTasks={tasks} projects={projects} />
              )}
              {appUser.role === 'Admin' && activeTab === 'timesheets' && (
                  isLoading ? <div className="flex justify-center items-center h-full">Loading timesheets...</div> : <TeamTimesheets timeEntries={timeEntries} projects={projects} tasks={tasks} space={activeSpace} allUsers={allUsers} />
              )}
              {appUser.role === 'Admin' && activeTab === 'settings' && (
                  <>
                      <h1 className="text-2xl font-bold mb-4">Settings</h1>
                      <Tabs defaultValue="spaces" className="w-full">
                          <TabsList>
                          <TabsTrigger value="spaces">Spaces</TabsTrigger>
                          <TabsTrigger value="users">Users</TabsTrigger>
                          </TabsList>
                          <TabsContent value="spaces">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading spaces...</div> : <SpaceSettings allSpaces={allSpaces} allUsers={allUsers} setSpaces={setAllSpaces} appUser={appUser} />}
                          </TabsContent>
                          <TabsContent value="users">
                          {isLoading ? <div className="flex justify-center items-center h-full">Loading users...</div> : <UserSettings />}
                          </TabsContent>
                      </Tabs>
                  </>
              )}
          </main>
        </div>
      </div>
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

export default function RootPage() {
    return (
        <Dashboard />
    )
}

    
