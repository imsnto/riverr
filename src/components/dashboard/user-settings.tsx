'use client';

import React, { useState, useEffect } from 'react';
import { User, Space, Invite } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Plus, Edit, Trash2, Mail, UserPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import InviteUserDialog from './invite-user-dialog';
import { getAllInvites, deleteInvite, resendInvite, addInvite as dbAddInvite, addPreApprovedUser } from '@/lib/db';
import AddUserDialog from './add-user-dialog';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

interface UserSettingsProps {
    allUsers: User[];
    allSpaces: Space[];
    onInviteUser: (values: Omit<Invite, 'token'>) => void;
    appUser: User | null;
}

export default function UserSettings({ allUsers: initialUsers, allSpaces, onInviteUser, appUser }: UserSettingsProps) {
  const [allUsers, setAllUsers] = useState<User[]>(initialUsers);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchInvites = async () => {
    const invites = await getAllInvites();
    setPendingInvites(invites);
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleRemoveUser = (userId: string) => {
    const userToRemove = allUsers.find(u => u.id === userId);
    setAllUsers(allUsers.filter(u => u.id !== userId));
    toast({
        title: 'User Removed',
        description: `${userToRemove?.name || 'The user'} has been removed from the list.`
    })
  }

  const handleResendInvite = async (email: string) => {
    const success = await resendInvite(email);
    if (success) {
      toast({
          title: 'Invite Resent',
          description: `A new invitation has been sent to ${email}.`
      });
       // Re-fetch invites to get the new token if needed, or just for UI consistency
      await fetchInvites();
    } else {
      toast({
          variant: 'destructive',
          title: 'Resend Failed',
          description: `Could not find an invite for ${email}. It may have already been accepted.`
      })
    }
  }
  
  const handleRevokeInvite = async (email: string) => {
    await deleteInvite(email);
    setPendingInvites(pendingInvites.filter(i => i.email !== email));
    toast({
        variant: 'destructive',
        title: 'Invite Revoked',
        description: `The invitation for ${email} has been revoked.`
    })
  }
  
  const handleNewInvite = async (values: Omit<Invite, 'token'>) => {
    await dbAddInvite(values);
    // Optimistically add to the list, but re-fetch to get the real data with token
    await fetchInvites();
    toast({
        title: 'User Invited',
        description: `${values.email} has been invited.`
    });
  }
  
  const handleAddUser = async (values: Omit<Invite, 'token'>) => {
      try {
        await addPreApprovedUser(values);
        toast({
            title: 'User Added',
            description: `${values.email} has been pre-approved. They can now sign in.`
        });
      } catch (error) {
        console.error("Error pre-approving user:", error);
        toast({
            variant: 'destructive',
            title: 'Failed to Add User',
            description: `Could not pre-approve ${values.email}.`
        });
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
                            <CardDescription>Add new users or send email invitations.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                           <Button variant="outline" onClick={() => setIsAddUserDialogOpen(true)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add User
                            </Button>
                            <Button onClick={() => setIsInviteDialogOpen(true)}>
                                <Mail className="mr-2 h-4 w-4" />
                                Invite User
                            </Button>
                        </div>
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
                                                    Edit Role
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

             {pendingInvites.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Invitations</CardTitle>
                        <CardDescription>These users have been invited but have not yet signed in.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Spaces</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingInvites.map(invite => (
                                <TableRow key={invite.email}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback><Mail className="h-4 w-4 text-muted-foreground"/></AvatarFallback>
                                            </Avatar>
                                            <p className="font-medium">{invite.email}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{invite.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {invite.spaces.map(spaceId => {
                                                const space = allSpaces.find(s => s.id === spaceId);
                                                return space ? <Badge key={spaceId} variant="secondary">{space.name}</Badge> : null;
                                            })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleResendInvite(invite.email)}>
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    Resend Invite
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleRevokeInvite(invite.email)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Revoke Invite
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
            )}
        </div>

        <InviteUserDialog 
            isOpen={isInviteDialogOpen}
            onOpenChange={setIsInviteDialogOpen}
            onInvite={handleNewInvite}
            allSpaces={allSpaces}
        />
        <AddUserDialog 
            isOpen={isAddUserDialogOpen}
            onOpenChange={setIsAddUserDialogOpen}
            onAddUser={handleAddUser}
            allSpaces={allSpaces}
        />
    </>
  );
}
