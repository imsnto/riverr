'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Task, User, Status } from '@/lib/data';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  getTimelineRange, 
  getTaskBarPosition, 
  normalizeTaskDates, 
  getTimelineTicks,
  ZoomLevel,
  TimelineRange
} from '@/lib/projects/timeline-utils';
import { cn, getInitials } from '@/lib/utils';
import { format, isToday, isSameDay } from 'date-fns';
import { ChevronRight, ChevronDown, Flag, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface TimelineViewProps {
  tasks: Task[];
  allUsers: User[];
  statuses: Status[];
  onTaskClick: (task: Task) => void;
}

const DAY_WIDTH = 40; // Base width for a day in 'day' zoom

export default function TimelineView({ tasks, allUsers, statuses, onTaskClick }: TimelineViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hierarchical task processing
  const displayTasks = useMemo(() => {
    const rootTasks = tasks.filter(t => !t.parentId);
    const result: { task: Task; level: number; hasChildren: boolean }[] = [];

    const process = (t: Task, level: number) => {
      const children = tasks.filter(child => child.parentId === t.id);
      result.push({ task: t, level, hasChildren: children.length > 0 });
      
      if (expandedTasks.has(t.id)) {
        children.forEach(c => process(c, level + 1));
      }
    };

    rootTasks.forEach(t => process(t, 0));
    return result;
  }, [tasks, expandedTasks]);

  const range = useMemo(() => getTimelineRange(tasks), [tasks]);
  const ticks = useMemo(() => getTimelineTicks(range, zoom), [range, zoom]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Scroll to "Today" on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayIndex = ticks.findIndex(t => isSameDay(t.date, new Date()));
      if (todayIndex !== -1) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          // Approximate position
          viewport.scrollLeft = (todayIndex * DAY_WIDTH) - 200;
        }
      }
    }
  }, [range, ticks]);

  return (
    <div className="flex flex-col h-full bg-background border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background">
            {format(range.start, 'MMM yyyy')} — {format(range.end, 'MMM yyyy')}
          </Badge>
        </div>
        <div className="flex items-center bg-background border rounded-lg p-1">
          <button 
            onClick={() => setZoom('day')}
            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", zoom === 'day' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted")}
          >Day</button>
          <button 
            onClick={() => setZoom('week')}
            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", zoom === 'week' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted")}
          >Week</button>
          <button 
            onClick={() => setZoom('month')}
            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", zoom === 'month' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted")}
          >Month</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel: Task List */}
        <div className="w-[300px] border-r bg-card shrink-0 flex flex-col min-h-0">
          <div className="h-14 border-b flex items-center px-4 shrink-0 bg-muted/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Hierarchy</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/50">
              {displayTasks.map(({ task, level, hasChildren }) => (
                <div 
                  key={task.id} 
                  className="group h-12 flex items-center px-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onTaskClick(task)}
                >
                  <div style={{ width: level * 16 }} />
                  <button 
                    onClick={(e) => hasChildren && toggleExpand(task.id, e)}
                    className={cn(
                      "h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted shrink-0 transition-opacity",
                      !hasChildren && "opacity-0 pointer-events-none"
                    )}
                  >
                    {expandedTasks.has(task.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex flex-col min-w-0 flex-1 ml-1">
                    <span className="text-xs font-semibold truncate pr-2">{task.name || 'Untitled Task'}</span>
                    <div className="flex items-center gap-1.5 opacity-60">
                      <span className="text-[9px] font-mono font-bold text-muted-foreground">{task.taskKey}</span>
                      <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground">{task.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: Grid & Bars */}
        <ScrollArea className="flex-1 bg-[#090909]" ref={scrollRef}>
          <div className="relative min-h-full flex flex-col" style={{ width: range.days * DAY_WIDTH }}>
            {/* Grid Header */}
            <div className="h-14 flex border-b sticky top-0 bg-[#090909]/95 backdrop-blur z-20">
              {ticks.map((tick, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col items-center justify-center border-r border-white/5 shrink-0 transition-colors",
                    isToday(tick.date) && "bg-primary/5 text-primary"
                  )} 
                  style={{ width: zoom === 'day' ? DAY_WIDTH : tick.width }}
                >
                  <span className="text-[10px] font-black tracking-tighter opacity-40 uppercase">{tick.subLabel}</span>
                  <span className="text-xs font-bold">{tick.label}</span>
                </div>
              ))}
            </div>

            {/* Grid Lines */}
            <div className="absolute inset-0 top-14 pointer-events-none flex">
              {ticks.map((tick, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-full border-r border-white/[0.03] shrink-0",
                    isToday(tick.date) && "bg-primary/[0.02] border-primary/10 border-r-2"
                  )} 
                  style={{ width: zoom === 'day' ? DAY_WIDTH : tick.width }}
                />
              ))}
            </div>

            {/* Today Indicator Line */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              style={{ left: (differenceInDays(new Date(), range.start) * DAY_WIDTH) + (DAY_WIDTH / 2) }}
            />

            {/* Task Rows */}
            <div className="flex-1 relative">
              {displayTasks.map(({ task }) => {
                const pos = getTaskBarPosition(task, range, DAY_WIDTH);
                const statusObj = statuses.find(s => s.name === task.status);
                const assignee = allUsers.find(u => u.id === task.assigned_to);

                return (
                  <div key={task.id} className="h-12 border-b border-white/[0.02] relative group hover:bg-white/[0.01]">
                    {pos && (
                      <div 
                        className="absolute top-2 h-8 rounded-lg flex items-center px-3 cursor-pointer shadow-lg transition-all hover:ring-2 ring-primary/50"
                        style={{ 
                          left: pos.left, 
                          width: Math.max(pos.width, 24),
                          backgroundColor: statusObj?.color || '#3b82f6',
                          opacity: task.status === 'Done' ? 0.6 : 1
                        }}
                        onClick={() => onTaskClick(task)}
                      >
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                          {assignee && (
                            <Avatar className="h-5 w-5 border border-white/20 shrink-0">
                              <AvatarImage src={assignee.avatarUrl} />
                              <AvatarFallback className="text-[8px]">{getInitials(assignee.name)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-xs font-bold text-white truncate drop-shadow-sm">
                            {task.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

function differenceInDays(d1: Date, d2: Date) {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}
