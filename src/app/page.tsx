'use client'

import React, { useState } from 'react';
import { AppWindow, CheckCircle, Clock, FolderKanban, GanttChart, Settings, Users } from 'lucide-react';
import { User, spaces as initialSpaces, Space, projects as initialProjects, tasks as initialTasks, slackMeetingLogs as initialLogs, timeEntries as initialTimeEntries, users as initialUsers } from '@/lib/data';
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
import { useAuth } from '@/hooks/use-auth';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: GanttChart },
  { id: 'tasks', label: 'Task Board', icon: FolderKanban },
  { id: 'timesheets', label: 'Team Timesheets', icon: Users, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [allUsers, setAllUsers] = useState<User[]>(initialUsers);
  const [allSpaces, setAllSpaces] = useState<Space[]>(initialSpaces);
  
  if (!currentUser) {
    return <div className="flex justify-center items-center h-screen">Authenticating...</div>;
  }
  
  const userSpaces = allSpaces.filter(s => s.members.includes(currentUser.id));
  const [activeSpaceId, setActiveSpaceId] = useState(userSpaces[0]?.id || '');

  const activeSpace = allSpaces.find(s => s.id === activeSpaceId) || userSpaces[0];

  const handleSpaceChange = (spaceId: string) => {
    const newSpace = allSpaces.find(s => s.id === spaceId);
    if(newSpace) {
      setActiveSpaceId(newSpace.id);
    }
  };
  
  // This effect ensures that if the active space is removed, we switch to a valid one.
  React.useEffect(() => {
    if (!allSpaces.find(s => s.id === activeSpaceId)) {
        const firstUserSpace = allSpaces.find(s => s.members.includes(currentUser.id));
        setActiveSpaceId(firstUserSpace?.id || '');
    }
  }, [allSpaces, activeSpaceId, currentUser.id]);

  // Filter data based on active space
  const projectsInSpace = initialProjects.filter(p => p.space_id === activeSpaceId);
  const tasksInSpace = initialTasks.filter(t => projectsInSpace.some(p => p.id === t.project_id));
  const usersInSpace = activeSpace ? activeSpace.members.map(memberId => {
    return allUsers.find(u => u.id === memberId)!
  }).filter(Boolean) : [];
  const timeEntriesInSpace = initialTimeEntries.filter(te => projectsInSpace.some(p => p.id === te.project_id));
  const meetingLogsInSpace = initialLogs.filter(log => log.project_id === null || projectsInSpace.some(p => p.id === log.project_id));


  if (!activeSpace) {
     return <div className="flex justify-center items-center h-screen">You are not a member of any space. Create or get an invite to a space to begin.</div>
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background font-body">
      <Header activeSpace={activeSpace} onSpaceChange={handleSpaceChange} allSpaces={allSpaces} />
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r bg-card p-4 md:flex">
          <nav className="flex flex-col gap-2">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">{activeSpace.name}</h2>
            <Separator />
            <Tabs
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-4"
            >
              <TabsList className="flex h-auto flex-col items-start justify-start gap-1 bg-transparent p-0">
                {NAV_ITEMS.map(item => {
                  if (item.adminOnly && currentUser.role !== 'Admin') {
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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Overview projects={projectsInSpace} tasks={tasksInSpace} timeEntries={timeEntriesInSpace} />
                </div>
                <div className="flex flex-col gap-6">
                  <Timer tasks={tasksInSpace} />
                  <ManualTimeEntry projects={projectsInSpace} tasks={tasksInSpace} />
                </div>
              </div>
              <div className="mt-6">
                <MeetingReview slackMeetingLogs={meetingLogsInSpace} projects={projectsInSpace} />
              </div>
            </TabsContent>
            <TabsContent value="tasks">
              <TaskBoard initialTasks={tasksInSpace} projects={projectsInSpace} />
            </TabsContent>
            {currentUser.role === 'Admin' && (
              <TabsContent value="timesheets">
                <TeamTimesheets timeEntries={timeEntriesInSpace} projects={projectsInSpace} tasks={tasksInSpace} space={activeSpace} />
              </TabsContent>
            )}
            {currentUser.role === 'Admin' && (
              <TabsContent value="settings">
                 <h1 className="text-2xl font-bold mb-4">Settings</h1>
                 <Tabs defaultValue="spaces" className="w-full">
                    <TabsList>
                      <TabsTrigger value="spaces">Spaces</TabsTrigger>
                      <TabsTrigger value="users">Users</TabsTrigger>
                    </TabsList>
                    <TabsContent value="spaces">
                      <SpaceSettings allSpaces={allSpaces} allUsers={allUsers} setSpaces={setAllSpaces} />
                    </TabsContent>
                    <TabsContent value="users">
                      <UserSettings allUsers={allUsers} allSpaces={allSpaces} onUsersChange={setAllUsers} onSpacesChange={setAllSpaces} />
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
