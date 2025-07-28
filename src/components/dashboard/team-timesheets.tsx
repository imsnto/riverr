'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { users } from '@/lib/data';
import WeeklyTimesheet from './weekly-timesheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import AllUsersTimesheet from './all-users-timesheet';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
}

type ViewMode = 'all-users' | 'single-user';

export default function TeamTimesheets() {
  const [selectedUserId, setSelectedUserId] = useState(users[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('all-users');

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  const handleUserSelectAndSwitchView = (userId: string) => {
    setSelectedUserId(userId);
    setViewMode('single-user');
  };

  if (viewMode === 'single-user') {
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
                  {users.map(user => (
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
            <WeeklyTimesheet userId={selectedUserId} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
     <AllUsersTimesheet onUserSelect={handleUserSelectAndSwitchView} />
  )
}
