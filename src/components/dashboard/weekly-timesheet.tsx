
'use client'

import React, { useState } from 'react';
import { TimeEntry, Project, Task, users as allUsers, User } from '@/lib/data';
import { ChevronLeft, ChevronRight, MoreHorizontal, Dot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import TaskDetailsDialog from './task-details-dialog';
import { eachDayOfInterval, format, isWithinInterval } from 'date-fns';

interface WeeklyTimesheetProps {
  userId: string;
  timeEntries: TimeEntry[];
  projects: Project[];
  tasks: Task[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  allUsers: User[];
  statuses: string[];
}

export default function WeeklyTimesheet({ userId, timeEntries, projects, tasks: initialTasks, weekStart, onPrevWeek, onNextWeek, onThisWeek, allUsers, statuses }: WeeklyTimesheetProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const weekStartsOn = 0; // Sunday
  const weekInterval = {
    start: weekStart,
    end: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
  };

  const userTimeEntries = timeEntries.filter(entry => 
    entry.user_id === userId && isWithinInterval(new Date(entry.start_time), weekInterval)
  );

  const user = allUsers.find(u => u.id === userId);
  
  const daysOfWeek = eachDayOfInterval(weekInterval);
  
  const dailyTotals = Array(7).fill(0);
  
  const entriesByTask = userTimeEntries.reduce((acc, entry) => {
    const task = tasks.find(t => t.id === entry.task_id);
    const key = entry.task_id || entry.notes;

    if (!acc[key]) {
      const project = projects.find(p => p.id === entry.project_id);
      acc[key] = {
        name: task?.name || entry.notes,
        project: project?.name || 'General',
        dailyHours: Array(7).fill(0),
        task: task, 
      };
    }
    const dayIndex = new Date(entry.start_time).getDay() - weekStartsOn;
    const validDayIndex = (dayIndex + 7) % 7;
    acc[key].dailyHours[validDayIndex] += entry.duration;
    dailyTotals[validDayIndex] += entry.duration;
    return acc;
  }, {} as Record<string, { name: string; project: string; dailyHours: number[]; task?: Task }>);
  
  const totalWeekHours = dailyTotals.reduce((a, b) => a + b, 0);

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(tasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
  };

  const handleTaskClick = (task: Task | undefined) => {
    if (task) {
      const fullTask = initialTasks.find(t => t.id === task.id);
      if(fullTask) setSelectedTask(fullTask);
    }
  };

  return (
    <>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onPrevWeek}><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" onClick={onNextWeek}><ChevronRight /></Button>
            <h3 className="text-xl font-semibold">{format(weekInterval.start, 'MMM d')} - {format(weekInterval.end, 'MMM d')}</h3>
            <Button variant="outline" onClick={onThisWeek}>This week</Button>
          </div>
          <div className="text-sm text-muted-foreground">
              {user?.name}'s timezone: PKT (UTC+5)
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-card">
                  <tr>
                    <th scope="col" className="w-1/3 px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Task / Location</th>
                    {daysOfWeek.map((day, i) => (
                      <th key={day.toISOString()} scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        <div className="flex justify-between items-end">
                          <span>{format(day, 'E, MMM d')}</span>
                          <span className="font-bold text-foreground">{dailyTotals[i].toFixed(1)}h</span>
                        </div>
                         <Progress value={(dailyTotals[i] / 8) * 100} className="h-1 mt-1 bg-primary/20" />
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                       <div className="flex justify-between items-end">
                          <span>Total</span>
                          <span className="font-bold text-foreground">{totalWeekHours.toFixed(1)}h</span>
                        </div>
                         <Progress value={(totalWeekHours / 40) * 100} className="h-1 mt-1 bg-primary/20" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.values(entriesByTask).map((entry, index) => (
                      <tr key={index}>
                          <td className="px-4 py-3 align-top">
                              <button 
                                onClick={() => handleTaskClick(entry.task)} 
                                className={`font-medium text-sm text-left ${entry.task ? 'hover:underline text-primary' : ''}`}
                                disabled={!entry.task}
                              >
                                {entry.name}
                              </button>
                              <div className="flex items-center text-xs text-muted-foreground">
                                  <Dot className="text-red-500" /> In Review <Dot /> {entry.project}
                              </div>
                          </td>
                          {entry.dailyHours.map((hours, i) => (
                              <td key={i} className="px-4 py-3 text-sm font-mono text-center">
                                  {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                              </td>
                          ))}
                          <td className="px-4 py-3 text-center">
                             <div className="flex items-center justify-center gap-2">
                              <span className="text-sm font-mono">{entry.dailyHours.reduce((a, b) => a + b, 0).toFixed(1)}h</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4"/></Button>
                             </div>
                          </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          isOpen={!!selectedTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTask(null);
          }}
          onUpdateTask={handleUpdateTask}
          projects={projects}
          allUsers={allUsers}
          statuses={statuses}
        />
      )}
    </>
  );
}
