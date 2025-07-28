'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { users, User } from '@/lib/data';
import WeeklyTimesheet from './weekly-timesheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
}

export default function TeamTimesheets() {
  const [selectedUserId, setSelectedUserId] = useState(users[0].id);

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-4">
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
