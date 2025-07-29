
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Project, Task, TimeEntry, Space, User } from '@/lib/data';
import WeeklyTimesheet from './weekly-timesheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import AllUsersTimesheet from './all-users-timesheet';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
}

type ViewMode = 'all-users' | 'single-user';

interface TeamTimesheetsProps {
  space: Space;
  allUsers: User[];
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
}

export default function TeamTimesheets({ space, allUsers, projects, tasks, timeEntries }: TeamTimesheetsProps) {
  const usersInSpace = allUsers.filter(u => space.members.includes(u.id));
  const [selectedUserId, setSelectedUserId] = useState(usersInSpace.length > 0 ? usersInSpace[0].id : '');
  const [viewMode, setViewMode] = useState<ViewMode>('all-users');

  const selectedUser = usersInSpace.find(u => u.id === selectedUserId) || (usersInSpace.length > 0 ? usersInSpace[0] : null);

  const handleUserSelectAndSwitchView = (userId: string) => {
    setSelectedUserId(userId);
    setViewMode('single-user');
  };
  
  if (usersInSpace.length === 0) {
    return <div className="text-center p-8">No users in this space.</div>;
  }

  if (viewMode === 'single-user' && selectedUser) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
           <Button variant="outline" onClick={() => setViewMode('all-users')}>
            Back to All Users
          </Button>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
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
                  {usersInSpace.map(user => (
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
              timeEntries={timeEntries}
              projects={projects}
              tasks={tasks} 
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
        users={usersInSpace}
      />
  )
}
