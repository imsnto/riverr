
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Project, Task, TimeEntry, Space, User, Hub, Status } from '@/lib/data';
import WeeklyTimesheet from './weekly-timesheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import AllUsersTimesheet from './all-users-timesheet';
import { startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
}

type ViewMode = 'all-users' | 'single-user';

interface TeamTimesheetsProps {
  allSpaces: Space[];
  allUsers: User[];
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  appUser: User;
  activeHub: Hub | null;
}

export default function TeamTimesheets({ allSpaces, allUsers, projects, tasks, timeEntries, appUser, activeHub }: TeamTimesheetsProps) {
  
  const usersInAccessibleSpaces = useMemo(() => {
    const allMemberIds = new Set<string>();
    allSpaces.forEach(space => {
      Object.keys(space.members).forEach(memberId => {
        allMemberIds.add(memberId);
      });
    });
    return allUsers.filter(u => allMemberIds.has(u.id));
  }, [allSpaces, allUsers]);

  const canSeeAllTimesheets = useMemo(() => {
    return allSpaces.some(space => space.members[appUser.id]?.role === 'Admin');
  }, [allSpaces, appUser.id]);

  const [selectedUserId, setSelectedUserId] = useState(appUser.id);
  const [viewMode, setViewMode] = useState<ViewMode>(() => canSeeAllTimesheets ? 'all-users' : 'single-user');
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStartsOn = 0; // Sunday
  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn });

  const handlePreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };
  
  const handleThisWeek = () => {
    setCurrentDate(new Date());
  }

  const selectedUser = usersInAccessibleSpaces.find(u => u.id === selectedUserId) || appUser;

  const handleUserSelectAndSwitchView = (userId: string) => {
    setSelectedUserId(userId);
    setViewMode('single-user');
  };
  
  if (usersInAccessibleSpaces.length === 0) {
    return <div className="text-center p-8">No users found in your spaces.</div>;
  }
  
  const statuses: Status[] = activeHub?.statuses || [];


  if (viewMode === 'single-user' && selectedUser) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-4">
           {canSeeAllTimesheets && (
            <Button variant="outline" onClick={() => setViewMode('all-users')}>
                Back to All Users
            </Button>
           )}
          <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!canSeeAllTimesheets}>
              <SelectTrigger className="w-[250px]">
                  <SelectValue>
                      <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                              <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} />
                              <AvatarFallback>{getInitials(selectedUser.name)}</AvatarFallback>
                          </Avatar>
                          <span>{selectedUser.name}</span>
                      </div>
                  </SelectValue>
              </SelectTrigger>
              <SelectContent>
                  {usersInAccessibleSpaces.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                           <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                                  <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                              <span>{user.name}</span>
                          </div>
                      </SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-0">
            <WeeklyTimesheet 
              userId={selectedUserId}
              timeEntries={timeEntries.filter(t => t.user_id === selectedUserId)}
              projects={projects}
              tasks={tasks}
              weekStart={startOfCurrentWeek}
              onPrevWeek={handlePreviousWeek}
              onNextWeek={handleNextWeek}
              onThisWeek={handleThisWeek}
              allUsers={usersInAccessibleSpaces}
              statuses={statuses}
             />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
     <AllUsersTimesheet 
        onUserSelect={handleUserSelectAndSwitchView}
        timeEntries={timeEntries}
        users={usersInAccessibleSpaces}
        weekStart={startOfCurrentWeek}
        onPrevWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onThisWeek={handleThisWeek}
      />
  )
}
