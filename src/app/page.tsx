
'use client'

import React, { useState, useEffect } from 'react';
import { FolderKanban, GanttChart, Settings, Users } from 'lucide-react';
import { User, Space, Project, Task, SlackMeetingLog, TimeEntry } from '@/lib/data';
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
import { getAllSpaces as dbGetAllSpaces, getProjectsInSpace as dbGetProjects, getTasksInSpace as dbGetTasks, getTimeEntriesInSpace as dbGetTimeEntries, getSlackMeetingLogsInSpace as dbGetSlackLogs, getAllUsers as dbGetAllUsers } from '@/lib/db';
import { users as mockUsers } from '@/lib/data';

function Dashboard() {
  const [appUser] = useState<User | null>(mockUsers.find(u => u.email === 'brad@riverr.app') || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSpaces, setAllSpaces] = useState<Space[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [meetingLogs, setMeetingLogs] = useState<SlackMeetingLog[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
        const projectsInSpace = await dbGetProjects(activeSpaceId);
        setProjects(projectsInSpace);

        const projectIds = projectsInSpace.map(p => p.id);
        if (projectIds.length > 0) {
            const [tasksInSpace, timeEntriesInSpace, meetingLogsInSpace] = await Promise.all([
                dbGetTasks(projectIds),
                dbGetTimeEntries(projectIds),
                dbGetSlackLogs(projectIds)
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
    <div className="flex min-h-screen w-full flex-col bg-background font-body">
      <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={userSpaces.length > 0 ? userSpaces : allSpaces} appUser={appUser} />
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r bg-card p-4 md:flex">
          <nav className="flex flex-col gap-2">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">{activeSpace?.name}</h2>
            <Separator />
            <Tabs
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-4"
            >
              <TabsList className="flex h-auto flex-col items-start justify-start gap-1 bg-transparent p-0">
                {NAV_ITEMS.map(item => {
                  if (item.adminOnly && appUser.role !== 'Admin') {
                    return null;
                  }
                  return (
                    <TabsTrigger
                      key={item.id}
                      value={item.id}
                      className="w-full justify-start gap-2 px-3 py-2 text-left data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Tabs value={activeTab}>
            <TabsContent value="dashboard" className="mt-0">
               {isLoading ? <div className="flex justify-center items-center h-full">Loading dashboard...</div> : 
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
              }
            </TabsContent>
            <TabsContent value="tasks">
              {isLoading ? <div className="flex justify-center items-center h-full">Loading tasks...</div> : <TaskBoard initialTasks={tasks} projects={projects} />}
            </TabsContent>
            {appUser.role === 'Admin' && (
              <TabsContent value="timesheets">
                 {isLoading ? <div className="flex justify-center items-center h-full">Loading timesheets...</div> : <TeamTimesheets timeEntries={timeEntries} projects={projects} tasks={tasks} space={activeSpace} allUsers={allUsers} />}
              </TabsContent>
            )}
            {appUser.role === 'Admin' && (
              <TabsContent value="settings">
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
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: GanttChart },
  { id: 'tasks', label: 'Task Board', icon: FolderKanban },
  { id: 'timesheets', label: 'Team Timesheets', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardPage() {
    return (
        <Dashboard />
    )
}
