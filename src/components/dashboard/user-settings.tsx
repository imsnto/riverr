

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { User, Space, Invite, SpaceMember, Hub } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Edit, Trash2, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import InviteUserDialog from './invite-user-dialog';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';

interface UserSettingsProps {
    allUsers: User[];
    allSpaces: Space[];
    allHubs: Hub[];
    appUser: User | null;
    onInvite: () => void;
    handleInvite: (values: Omit<Invite, 'id' | 'token' | 'status'>) => void;
}

export default function UserSettings({ allUsers: initialUsers, allHubs, handleInvite, onInvite }: UserSettingsProps) {
  const { toast } = useToast();
  const { appUser, userSpaces, activeSpace } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (userSpaces.length > 0) {
      const spaceIds = userSpaces.map(s => s.id);
      db.getPendingInvites(spaceIds).then(setPendingInvites);
    }
  }, [userSpaces]);


  const usersInMySpaces = useMemo(() => {
    if (!userSpaces.length) return [];
    const memberIds = new Set<string>();
    userSpaces.forEach(space => {
        Object.keys(space.members).forEach(id => memberIds.add(id));
    });
    return initialUsers.filter(user => memberIds.has(user.id));
  }, [initialUsers, userSpaces]);
  
  const getRoleInSpace = (user: User, space: Space): SpaceMember | null => {
      return space.members[user.id] || null;
  }

  const handleRemoveUser = (userId: string) => {
    const userToRemove = initialUsers.find(u => u.id === userId);
    toast({
        variant: 'destructive',
        title: 'Action Not Implemented',
        description: `Removing users is not yet implemented.`
    })
  }

  const handleInviteAndClose = async (values: Omit<Invite, 'id' | 'tokenHash' | 'sentAt' | 'expiresAt' | 'createdAt' | 'status'>) => {
    handleInvite(values);
    
    // Refetch pending invites after sending a new one
    const spaceIds = userSpaces.map(s => s.id);
    db.getPendingInvites(spaceIds).then(setPendingInvites);

    setIsInviteOpen(false);
    toast({
      title: "Invitation Sent",
      description: `An invitation has been sent to ${values.email}.`,
    });
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
                        <TableHead>Space</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usersInMySpaces.map(user => {
                            const userMemberships = userSpaces
                                .map(space => ({ space, membership: getRoleInSpace(user, space) }))
                                .filter(item => item.membership && !item.space.isSystem);

                            return (
                                <TableRow key={user.id}>
                                    <TableCell className="align-top">
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
                                    <TableCell className="align-top">
                                         <div className="flex flex-col gap-2 items-start">
                                            {userMemberships.map(({ space }) => (
                                                <div key={space.id} className="flex items-center h-6">{space.name}</div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col gap-2 items-start">
                                            {userMemberships.map(({ space, membership }) => (
                                                <div key={space.id} className="flex items-center h-6">
                                                    <Badge variant={membership!.role === 'Admin' ? 'default' : 'secondary'}>
                                                        {membership!.role}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right align-top">
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
                            )
                        })}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>These users have been invited but have not yet joined.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Space</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingInvites.length > 0 ? (
                                pendingInvites.map(invite => (
                                    <TableRow key={invite.id}>
                                        <TableCell className="font-medium">{invite.email}</TableCell>
                                        <TableCell>{invite.spaceName}</TableCell>
                                        <TableCell><Badge variant="secondary">{invite.spaceRole}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem disabled>Resend Invitation</DropdownMenuItem>
                                                    <DropdownMenuItem disabled className="text-destructive">Revoke Invitation</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        No pending invitations.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        {activeSpace && <InviteUserDialog 
            isOpen={isInviteOpen}
            onOpenChange={setIsInviteOpen}
            onInvite={handleInviteAndClose}
            activeSpace={activeSpace}
            allHubs={allHubs.filter(h => h.spaceId === activeSpace.id)}
        />}
    </>
  );
}
