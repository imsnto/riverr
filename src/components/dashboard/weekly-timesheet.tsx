'use client';

import React, { useState, useEffect } from 'react';
import { TimeEntry, Project, Task, User, Status } from '@/lib/data';
import { ChevronLeft, ChevronRight, MoreHorizontal, Dot, DollarSign, Tag as TagIcon, Clock, List, LayoutGrid, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import TaskDetailsDialog from './task-details-dialog';
import { eachDayOfInterval, format, isWithinInterval } from 'date-fns';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

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
  statuses: Status[];
}

const FilterPill = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <Button variant="outline" size="sm" className="h-7 rounded-full border-zinc-800 bg-zinc-900/50 text-zinc-400 text-[10px] font-medium gap-1.5 hover:bg-zinc-800 hover:text-zinc-200 px-3">
        <Icon className="h-3 w-3" />
        {label}
    </Button>
);

export default function WeeklyTimesheet({ userId, timeEntries, projects, tasks: initialTasks, weekStart, onPrevWeek, onNextWeek, onThisWeek, allUsers, statuses }: WeeklyTimesheetProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'entries'>('grid');

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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

  const handleUpdateTask = (updatedTask: Task, tempId?: string) => {
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
  };

  const handleTaskClick = (task: Task | undefined) => {
    if (!task) return;
    const freshTask = initialTasks.find(t => t.id === task.id);
    setSelectedTask(freshTask ? { ...freshTask } : task);
  };

  return (
    <>
      <div className="bg-background min-h-full">
        {/* Top Controls Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
                <FilterPill icon={DollarSign} label="Billable status" />
                <FilterPill icon={TagIcon} label="Tag" />
                <FilterPill icon={Clock} label="Tracked time" />
            </div>
            <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-lg p-0.5">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-7 text-[10px] font-bold uppercase tracking-wider px-3 gap-2"
                    onClick={() => setViewMode('grid')}
                >
                    <LayoutGrid className="h-3 w-3" /> Timesheet
                </Button>
                <Button 
                    variant={viewMode === 'entries' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-7 text-[10px] font-bold uppercase tracking-wider px-3 gap-2"
                    onClick={() => setViewMode('entries')}
                >
                    <List className="h-3 w-3" /> Time entries
                </Button>
            </div>
        </div>

        {/* Navigation & Context */}
        <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
                <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-950 p-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                    <Separator orientation="vertical" className="h-4 mx-1 bg-zinc-800" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <h3 className="text-sm font-bold text-zinc-200">
                    {format(weekInterval.start, 'MMM d')} - {format(weekInterval.end, 'MMM d, yyyy')}
                </h3>
                <Button variant="outline" size="sm" onClick={onThisWeek} className="h-8 text-[10px] font-bold uppercase tracking-widest bg-zinc-900/50 border-zinc-800">Today</Button>
            </div>
            {user && (
                <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                    {user.name}'s Timeline · UTC+5
                </div>
            )}
        </div>
        
        {/* Main Grid Table */}
        <div className="px-6 pb-10 overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px] border border-zinc-800 rounded-lg overflow-hidden">
            <thead className="bg-zinc-900/30">
              <tr className="border-b border-zinc-800">
                <th scope="col" className="w-[300px] px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Task / Location
                </th>
                {daysOfWeek.map((day, i) => (
                  <th key={day.toISOString()} scope="col" className="relative px-2 py-4 text-left border-l border-zinc-800 group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                        {format(day, 'EEE, MMM d')}
                      </span>
                      <span className="text-sm font-black text-zinc-200">
                        {dailyTotals[i].toFixed(0)}h
                      </span>
                    </div>
                    {/* Visual Progress Line */}
                    <div className={cn(
                        "absolute bottom-0 left-0 right-0 h-0.5 transition-all",
                        dailyTotals[i] > 0 ? "bg-primary" : "bg-zinc-800"
                    )} />
                  </th>
                ))}
                <th scope="col" className="px-4 py-4 text-left border-l border-zinc-800 bg-zinc-900/50">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Total</span>
                      <span className="text-sm font-black text-primary">
                        {totalWeekHours.toFixed(0)}h
                      </span>
                    </div>
                    <div className={cn(
                        "absolute bottom-0 left-0 right-0 h-0.5 transition-all",
                        totalWeekHours > 0 ? "bg-primary" : "bg-zinc-800"
                    )} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {Object.values(entriesByTask).length > 0 ? (
                Object.values(entriesByTask).map((entry, index) => {
                    const taskStatus = entry.task ? statuses.find(s => s.name === entry.task!.status) : null;
                    return (
                    <tr key={index} className="group hover:bg-zinc-900/20 transition-colors">
                        <td className="px-4 py-4 align-top">
                            <button 
                                onClick={() => handleTaskClick(entry.task)} 
                                className={cn(
                                    "font-bold text-sm text-left block mb-1",
                                    entry.task ? 'hover:text-primary transition-colors' : 'text-zinc-400 cursor-default'
                                )}
                                disabled={!entry.task}
                            >
                                {entry.name}
                            </button>
                            <div className="flex items-center text-[10px] font-bold uppercase tracking-tight text-zinc-600">
                                {entry.task ? (
                                    <>
                                        <div className="h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: taskStatus?.color || '#52525b' }} />
                                        <span>{entry.task.status}</span>
                                        <Dot className="h-4 w-4" />
                                        <span className="truncate max-w-[150px]">{entry.project}</span>
                                    </>
                                ) : (
                                    <span>{entry.project}</span>
                                )}
                            </div>
                        </td>
                        {entry.dailyHours.map((hours, i) => (
                            <td key={i} className="px-2 py-4 border-l border-zinc-900/50 align-top">
                                <div className={cn(
                                    "text-xs font-mono font-bold",
                                    hours > 0 ? "text-zinc-200" : "text-zinc-700"
                                )}>
                                    {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                                </div>
                            </td>
                        ))}
                        <td className="px-4 py-4 border-l border-zinc-900/50 bg-zinc-900/10 align-top">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-black text-primary">
                                    {entry.dailyHours.reduce((a, b) => a + b, 0).toFixed(1)}h
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-3 w-3 text-zinc-500"/></Button>
                            </div>
                        </td>
                    </tr>
                )})
              ) : (
                <tr>
                    <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center opacity-40">
                            <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                                <Timer className="h-8 w-8 text-zinc-400" />
                            </div>
                            <h4 className="text-sm font-bold text-zinc-300">No time entries for this week</h4>
                            <p className="text-xs text-zinc-500 mt-1">Add tasks or track time to begin.</p>
                        </div>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
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
          onOpenChange={(isOpen) => { if (!isOpen) setSelectedTask(null); }}
          onUpdateTask={handleUpdateTask}
          onAddTask={async (task) => { return task as Task; }}
          onRemoveTask={(tid) => setTasks(prev => prev.filter(t => t.id !== tid))}
          onTaskSelect={handleTaskClick}
          onLogTime={() => {}}
          statuses={statuses.map(s => s.name)}
          projects={projects}
        />
      )}
    </>
  );
}
