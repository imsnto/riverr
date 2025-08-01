
'use client';

import React from 'react';
import { TimeEntry, User } from '@/lib/data';
import { ChevronLeft, ChevronRight, DollarSign, Tag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { eachDayOfInterval, format, isWithinInterval } from 'date-fns';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
};

interface AllUsersTimesheetProps {
  onUserSelect: (userId: string) => void;
  users: User[];
  timeEntries: TimeEntry[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
}

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
    <div className="p-1 sm:p-4 rounded-lg bg-card text-card-foreground">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPrevWeek}>Previous week</Button>
          <Button variant="ghost" size="icon" onClick={onPrevWeek}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" onClick={onNextWeek}><ChevronRight /></Button>
          <h3 className="text-lg font-semibold whitespace-nowrap">{format(weekInterval.start, 'MMM d')} - {format(weekInterval.end, 'MMM d')}</h3>
          <Button variant="outline" onClick={onThisWeek}>This week</Button>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all-members">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-members">All members</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm"><DollarSign className="mr-2 h-4 w-4"/>Billable status</Button>
          <Button variant="outline" size="sm"><Tag className="mr-2 h-4 w-4"/>Tag</Button>
          <Button variant="outline" size="sm"><Clock className="mr-2 h-4 w-4"/>Tracked time</Button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th scope="col" className="w-1/4 sm:w-1/3 px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">People ({users.length})</th>
              {daysOfWeek.map((day) => (
                <th key={day.toISOString()} scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  <div>{format(day, 'E, MMM d')}</div>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {userWeeklyTotals.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.total.toFixed(2)}h</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onUserSelect(user.id)}>
                      Open &rarr;
                    </Button>
                  </div>
                </td>
                {user.dailyHours.map((hours, i) => (
                  <td key={i} className="px-4 py-3 text-sm font-mono text-center">
                    <div className={`w-full rounded-md p-2 text-center ${hours > 0 ? 'bg-primary/10 text-primary' : 'bg-transparent'}`}>
                      {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <div className={`w-full rounded-md p-2 text-center ${user.total > 0 ? 'bg-primary/20 text-primary font-bold' : 'bg-transparent'}`}>
                    {user.total.toFixed(1)}h
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
