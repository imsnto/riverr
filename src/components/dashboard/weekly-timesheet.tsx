'use client'

import React from 'react';
import { timeEntries, projects, tasks, users } from '@/lib/data';
import { ChevronLeft, ChevronRight, MoreHorizontal, Dot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface WeeklyTimesheetProps {
  userId: string;
}

export default function WeeklyTimesheet({ userId }: WeeklyTimesheetProps) {
  const userTimeEntries = timeEntries.filter(entry => entry.user_id === userId);
  const user = users.find(u => u.id === userId);
  
  // This is a simplified version. A real app would use a date library.
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = [6, 7, 8, 9, 10, 11, 12].map(d => `Jul ${d}`);
  
  const dailyTotals = Array(7).fill(0);
  
  const entriesByTask = userTimeEntries.reduce((acc, entry) => {
    const key = entry.task_id || entry.notes;
    if (!acc[key]) {
      const task = tasks.find(t => t.id === entry.task_id);
      const project = projects.find(p => p.id === entry.project_id);
      acc[key] = {
        name: task?.name || entry.notes,
        project: project?.name || 'General',
        dailyHours: Array(7).fill(0)
      };
    }
    // This is a simplification; a real app would map dates properly.
    const dayIndex = new Date(entry.start_time).getUTCDay();
    acc[key].dailyHours[dayIndex] += entry.duration;
    dailyTotals[dayIndex] += entry.duration;
    return acc;
  }, {} as Record<string, { name: string; project: string, dailyHours: number[] }>);
  
  const totalWeekHours = dailyTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon"><ChevronRight /></Button>
          <h3 className="text-xl font-semibold">Jul 6 - Jul 12</h3>
          <Button variant="outline">This week</Button>
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
                  {days.map((day, i) => (
                    <th key={day} scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      <div className="flex justify-between items-end">
                        <span>{day}, {dates[i]}</span>
                        <span className="font-bold text-foreground">{dailyTotals[i]}h</span>
                      </div>
                       <Progress value={(dailyTotals[i] / 8) * 100} className="h-1 mt-1 bg-primary/20" />
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                     <div className="flex justify-between items-end">
                        <span>Total</span>
                        <span className="font-bold text-foreground">{totalWeekHours}h</span>
                      </div>
                       <Progress value={(totalWeekHours / 40) * 100} className="h-1 mt-1 bg-primary/20" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(entriesByTask).map((entry, index) => (
                    <tr key={index}>
                        <td className="px-4 py-3 align-top">
                            <p className="font-medium text-sm">{entry.name}</p>
                            <div className="flex items-center text-xs text-muted-foreground">
                                <Dot className="text-red-500" /> In Review <Dot /> {entry.project}
                            </div>
                        </td>
                        {entry.dailyHours.map((hours, i) => (
                            <td key={i} className="px-4 py-3 text-sm font-mono text-center">
                                {hours > 0 ? `${hours}h` : '-'}
                            </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                           <div className="flex items-center justify-center gap-2">
                            <span className="text-sm font-mono">{entry.dailyHours.reduce((a, b) => a + b, 0)}h</span>
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
  );
}
