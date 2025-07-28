
'use client';

import React, { useState } from 'react';
import { User, Space } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import InviteUserDialog from './invite-user-dialog';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

interface UserSettingsProps {
    allUsers: User[];
    allSpaces: Space[];
    onUsersChange: (users: User[]) => void;
    onSpacesChange: (spaces: Space[]) => void;
}

interface InviteFormValues {
    email: string;
    role: 'Admin' | 'Member';
    spaces: string[];
}

export default function UserSettings({ allUsers, allSpaces, onUsersChange, onSpacesChange }: UserSettingsProps) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAddUser = (values: InviteFormValues) => {
    const newUser: User = {
        id: `user-${Date.now()}`,
        name: values.email.split('@')[0], // Default name from email
        email: values.email,
        role: values.role,
        slack_id: '',
        avatarUrl: `https://placehold.co/100x100?text=${values.email[0].toUpperCase()}`
    };

    onUsersChange([...allUsers, newUser]);
    
    const updatedSpaces = allSpaces.map(space => {
        if (values.spaces.includes(space.id)) {
            return {
                ...space,
                members: [...space.members, newUser.id]
            }
        }
        return space;
    });
    onSpacesChange(updatedSpaces);

    toast({
        title: 'User Added',
        description: `${values.email} has been added to the system and selected spaces.`
    });
  }

  const handleRemoveUser = (userId: string) => {
    onUsersChange(allUsers.filter(u => u.id !== userId));
    // Also remove from spaces
    const updatedSpaces = allSpaces.map(space => ({
      ...space,
      members: space.members.filter(memberId => memberId !== userId)
    }));
    onSpacesChange(updatedSpaces);

    toast({
        title: 'User Removed',
        description: 'The user has been removed from the system.'
    })
  }

  return (
    <>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Manage Users</CardTitle>
                        <CardDescription>Invite, remove, and manage user roles.</CardDescription>
                    </div>
                    <Button onClick={() => setIsInviteDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Invite User
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Slack ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allUsers.map(user => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">{user.name}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                                <span className="font-mono text-xs">{user.slack_id || 'N/A'}</span>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem disabled>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Role
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRemoveUser(user.id)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove User
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </CardContent>
        </Card>

        <InviteUserDialog 
            isOpen={isInviteDialogOpen}
            onOpenChange={setIsInviteDialogOpen}
            onInvite={handleAddUser}
            allSpaces={allSpaces}
        />
    </>
  );
}
