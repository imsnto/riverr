'use client'

import React, { useState } from 'react';
import { AppWindow, CheckCircle, Clock, FolderKanban, GanttChart, Users } from 'lucide-react';
import { currentUser, User } from '@/lib/data';
import Header from '@/components/dashboard/header';
import Overview from '@/components/dashboard/overview';
import TaskBoard from '@/components/dashboard/task-board';
import TeamTimesheets from '@/components/dashboard/team-timesheets';
import ManualTimeEntry from '@/components/dashboard/manual-time-entry';
import Timer from '@/components/dashboard/timer';
import MeetingReview from '@/components/dashboard/meeting-review';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: GanttChart },
  { id: 'tasks', label: 'Task Board', icon: FolderKanban },
  { id: 'timesheets', label: 'Team Timesheets', icon: Users, adminOnly: true },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen w-full flex-col bg-background font-body">
      <Header />
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r bg-card p-4 md:flex">
          <nav className="flex flex-col gap-2">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">TimeFlow</h2>
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
                  <Overview />
                </div>
                <div className="flex flex-col gap-6">
                  <Timer />
                  <ManualTimeEntry />
                </div>
              </div>
              <div className="mt-6">
                <MeetingReview />
              </div>
            </TabsContent>
            <TabsContent value="tasks">
              <TaskBoard />
            </TabsContent>
            {currentUser.role === 'Admin' && (
              <TabsContent value="timesheets">
                <TeamTimesheets />
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>
    </div>
  );
}
