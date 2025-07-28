
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { projects, tasks, timeEntries, currentUser, Project } from '@/lib/data';
import { CheckCircle, Clock, FolderKanban } from 'lucide-react';
import ProjectDetailsDialog from './project-details-dialog';

export default function Overview() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const userProjects = projects.filter(p => p.members.includes(currentUser.id));
  const userTasks = tasks.filter(t => t.assigned_to === currentUser.id);
  const userTimeEntries = timeEntries.filter(t => t.user_id === currentUser.id);

  const totalHoursLogged = userTimeEntries.reduce((acc, entry) => acc + entry.duration, 0);

  return (
    <>
      <div className="space-y-6">
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
              <div className="text-2xl font-bold">{totalHoursLogged.toFixed(1)}</div>
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
                          <p className="font-medium">{entry.duration} hrs on {project?.name}</p>
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
        />
      )}
    </>
  );
}
