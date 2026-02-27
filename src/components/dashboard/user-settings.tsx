
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { User, Space, Invite, SpaceMember, Hub } from '@/lib/data';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

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
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);

  useEffect(() => {
    if (userSpaces.length > 0) {
      const spaceIds = userSpaces.map(s => s.id);
      db.getPendingInvites(spaceIds).then(setPendingInvites);
    }
  }, [userSpaces]);


  const usersInMySpaces = useMemo(() => {
    if (!userSpaces.length || !initialUsers.length) return [];
    const memberIds = new Set<string>();
    userSpaces.forEach(space => {
        if (space.members) {
            Object.keys(space.members).forEach(id => memberIds.add(id));
        }
    });
    return initialUsers.filter(user => memberIds.has(user.id));
  }, [initialUsers, userSpaces]);
  
  const getRoleInSpace = (user: User, space: Space): string | null => {
      if (!space.members) return null;
      return space.members[user.id]?.role || null;
  }

  const handleRemoveUser = (user: User) => {
    setUserToRemove(user);
  }

  const handleConfirmRemove = async () => {
    if (!userToRemove || !activeSpace) return;
    try {
        await db.removeUserFromSpace(activeSpace.id, userToRemove.id);
        toast({ title: 'User Removed', description: `${userToRemove.name} has been removed from ${activeSpace.name}.` });
        onInvite(); 
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove user.' });
    } finally {
        setUserToRemove(null);
    }
  }

  const handleInviteAndClose = async (values: Omit<Invite, 'id' | 'tokenHash' | 'sentAt' | 'expiresAt' | 'createdAt' | 'status'>) => {
    handleInvite(values);
    
    setTimeout(() => {
        const spaceIds = userSpaces.map(s => s.id);
        db.getPendingInvites(spaceIds).then(setPendingInvites);
    }, 2000);

    setIsInviteOpen(false);
    toast({
      title: "Invitation Sent",
      description: `An invitation has been sent to ${values.email}.`,
    });
  }

  const handleResend = async (inviteId: string, email: string) => {
    try {
      await db.resendInvite(inviteId);
      toast({
        title: "Invitation Resent",
        description: `A new invitation has been sent to ${email}.`,
      });
      const spaceIds = userSpaces.map(s => s.id);
      db.getPendingInvites(spaceIds).then(setPendingInvites);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Resend",
        description: error.message || "There was a problem resending the invitation.",
      });
    }
  };

  const handleRevoke = async () => {
    if (!inviteToRevoke) return;
    try {
      await db.revokeInvite(inviteToRevoke.id);
      toast({
        title: "Invitation Revoked",
        description: `The invitation for ${inviteToRevoke.email} has been revoked.`,
      });
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteToRevoke.id));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to Revoke",
        description: "There was a problem revoking the invitation.",
      });
    } finally {
        setInviteToRevoke(null);
    }
  };


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
                        {usersInMySpaces.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    No members found in your workspaces.
                                </TableCell>
                            </TableRow>
                        ) : usersInMySpaces.map(user => {
                            const userMemberships = userSpaces
                                .map(space => ({ space, role: getRoleInSpace(user, space) }))
                                .filter(item => item.role);

                            if (userMemberships.length === 0) return null;

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
                                                <div key={space.id} className="flex items-center h-6">
                                                    {space.name}
                                                    {space.isSystem && <Badge variant="outline" className="ml-2 text-[10px] h-4">System</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-col gap-2 items-start">
                                            {userMemberships.map(({ space, role }) => (
                                                <div key={space.id} className="flex items-center h-6">
                                                    <Badge variant={role === 'Admin' ? 'default' : 'secondary'}>
                                                        {role}
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
                                                    <DropdownMenuItem onClick={() => handleRemoveUser(user)} className="text-destructive">
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
                                                     <DropdownMenuItem onSelect={() => handleResend(invite.id, invite.email)}>
                                                        Resend Invitation
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={(e) => {
                                                            e.preventDefault();
                                                            setInviteToRevoke(invite);
                                                        }}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Revoke Invitation
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
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

        <AlertDialog open={!!inviteToRevoke} onOpenChange={setInviteToRevoke}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently revoke the invitation for <span className="font-semibold">{inviteToRevoke?.email}</span>. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevoke} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Revoke
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToRemove} onOpenChange={(open) => !open && setUserToRemove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove User from Space?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove <span className="font-semibold">{userToRemove?.name}</span> from the <span className="font-semibold">{activeSpace?.name}</span> workspace. 
                        They will lose access to all hubs and projects within this space.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmRemove} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Remove User
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
