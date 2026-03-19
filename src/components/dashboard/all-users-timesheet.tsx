
'use client';

import React from 'react';
import { TimeEntry, User } from '@/lib/data';
import { ChevronLeft, ChevronRight, DollarSign, Tag as TagIcon, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { eachDayOfInterval, format, isWithinInterval } from 'date-fns';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AllUsersTimesheetProps {
  onUserSelect: (userId: string) => void;
  users: User[];
  timeEntries: TimeEntry[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
}

const FilterPill = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <Button variant="outline" size="sm" className="h-8 rounded-full border-zinc-800 bg-zinc-900/50 text-zinc-400 text-xs gap-2 hover:bg-zinc-800 hover:text-zinc-200">
        <Icon className="h-3.5 w-3.5" />
        {label}
    </Button>
);

export default function AllUsersTimesheet({ onUserSelect, users, timeEntries, weekStart, onPrevWeek, onNextWeek, onThisWeek }: AllUsersTimesheetProps) {
  const weekStartsOn = 0; // Sunday
  const weekInterval = {
    start: weekStart,
    end: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
  };

  const daysOfWeek = eachDayOfInterval(weekInterval);

  const userWeeklyTotals = users.map(user => {
    const userEntriesThisWeek = timeEntries.filter(entry => 
        entry.user_id === user.id && isWithinInterval(new Date(entry.start_time), weekInterval)
    );
    const dailyHours = Array(7).fill(0);
    let total = 0;
    
    userEntriesThisWeek.forEach(entry => {
      const dayIndex = new Date(entry.start_time).getDay() - weekStartsOn;
      const validDayIndex = (dayIndex + 7) % 7;
      dailyHours[validDayIndex] += entry.duration;
      total += entry.duration;
    });

    return {
      ...user,
      dailyHours,
      total,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Filters Toolbar */}
      <div className="flex items-center gap-2 px-6 pt-4">
        <FilterPill icon={DollarSign} label="Billable status" />
        <FilterPill icon={TagIcon} label="Tag" />
        <FilterPill icon={Clock} label="Tracked time" />
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center border rounded-lg bg-zinc-950 p-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={onPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="h-4 mx-1 bg-zinc-800" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={onNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h3 className="text-sm font-bold text-zinc-200">
            {format(weekInterval.start, 'MMM d')} - {format(weekInterval.end, 'MMM d, yyyy')}
          </h3>
          <Button variant="outline" size="sm" onClick={onThisWeek} className="h-8 text-xs font-bold border-zinc-800 bg-zinc-900/50">Today</Button>
        </div>
      </div>
      
      {/* Grid Table */}
      <div className="px-6 overflow-x-auto pb-10">
        <table className="w-full border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 w-[300px]">
                People ({users.length})
              </th>
              {daysOfWeek.map((day) => (
                <th key={day.toISOString()} className="px-1 py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  {format(day, 'EEE, MMM d')}
                </th>
              ))}
              <th className="px-1 py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {userWeeklyTotals.map((user) => (
              <tr key={user.id} className="group hover:bg-zinc-900/30 transition-colors">
                <td className="py-4 pr-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 rounded-full border border-zinc-800">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-200 truncate">{user.name}</p>
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">40h target</p>
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onUserSelect(user.id)}
                        className="h-8 text-[10px] font-black uppercase tracking-widest bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    >
                        Open <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>
                </td>
                {user.dailyHours.map((hours, i) => (
                  <td key={i} className="px-1 py-4">
                    <div className={cn(
                        "h-12 w-full rounded-md flex items-center justify-center text-xs font-bold transition-all",
                        hours > 0 ? "bg-primary/20 text-primary border border-primary/20" : "bg-zinc-900/40 text-zinc-600 border border-transparent"
                    )}>
                      {hours > 0 ? `${hours.toFixed(0)}h` : '0h'}
                    </div>
                  </td>
                ))}
                <td className="px-1 py-4">
                  <div className={cn(
                      "h-12 w-full rounded-md flex items-center justify-center text-xs font-bold transition-all shadow-inner",
                      user.total > 0 ? "bg-primary/30 text-white border border-primary/40" : "bg-zinc-900/40 text-zinc-600 border border-transparent"
                  )}>
                    {user.total.toFixed(0)}h
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Separator({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical', className?: string }) {
    return (
        <div className={cn(
            "shrink-0 bg-border",
            orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
            className
        )} />
    );
}
