
'use client';

import React, { useState } from 'react';
import { User, Space, Invite, SpaceMember } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Edit, Trash2, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import InviteUserDialog from './invite-user-dialog';
import { addInvite } from '@/lib/db';
import { randomBytes } from 'crypto';


const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

interface UserSettingsProps {
    allUsers: User[];
    allSpaces: Space[];
    appUser: User | null;
}

export default function UserSettings({ allUsers: initialUsers, allSpaces, appUser }: UserSettingsProps) {
  const [allUsers, setAllUsers] = useState<User[]>(initialUsers);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { toast } = useToast();
  
  const getRoleInSpace = (user: User, space: Space): SpaceMember | null => {
      return space.members[user.id] || null;
  }

  const handleRemoveUser = (userId: string) => {
    // This would be a more complex operation, removing user from all spaces, etc.
    // For now, we just toast.
    const userToRemove = allUsers.find(u => u.id === userId);
    toast({
        variant: 'destructive',
        title: 'Action Not Implemented',
        description: `Removing users is not yet implemented.`
    })
  }

  const handleInvite = async (values: Omit<Invite, 'token'>) => {
    try {
      const token = randomBytes(16).toString('hex');
      await addInvite({ ...values, token });
      toast({
        title: 'Invite Sent',
        description: `${values.email} has been invited. They will get access once they sign in.`,
      })
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Invite Failed',
        description: 'Could not send the invitation. Please try again.',
      })
    }
  }


  return (
    <>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Manage Users</CardTitle>
                            <CardDescription>View and invite users to your spaces.</CardDescription>
                        </div>
                         <Button onClick={() => setIsInviteOpen(true)}>
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
                        <TableHead>Spaces & Roles</TableHead>
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
                                    <div className="flex flex-wrap gap-2">
                                        {allSpaces.map(space => {
                                            const membership = getRoleInSpace(user, space);
                                            if (membership) {
                                                return (
                                                    <Badge key={space.id} variant={membership.role === 'Admin' ? 'default' : 'secondary'}>
                                                        {space.name}: {membership.role}
                                                    </Badge>
                                                )
                                            }
                                            return null;
                                        })}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {user.id !== appUser?.id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem disabled>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit Permissions
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleRemoveUser(user.id)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Remove User
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </div>
        <InviteUserDialog 
            isOpen={isInviteOpen}
            onOpenChange={setIsInviteOpen}
            onInvite={handleInvite}
            allSpaces={allSpaces}
        />
    </>
  );
}
