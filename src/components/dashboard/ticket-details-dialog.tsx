
'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Ticket, User, Conversation, Visitor } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { AtSign, Calendar, Flag, MessageSquare, User as UserIcon, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '../ui/input';
import { format, parseISO } from 'date-fns';

const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('') : '';
}

interface DetailRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    className?: string;
}
const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, children, className }) => (
    <div className={cn("space-y-2 md:grid md:grid-cols-[8rem_1fr] md:items-start md:gap-4 md:space-y-0", className)}>
        <div className="flex items-center gap-2 text-muted-foreground md:pt-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="md:col-span-1">{children}</div>
    </div>
);

interface TicketDetailsDialogProps {
    ticket: Ticket | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateTicket: (ticket: Ticket) => void;
    statuses: string[];
    allUsers: User[];
    contact: Visitor | null;
    conversation: Conversation | null;
}

export default function TicketDetailsDialog({ ticket: initialTicket, isOpen, onOpenChange, onUpdateTicket, statuses, allUsers, contact, conversation }: TicketDetailsDialogProps) {
    const { appUser } = useAuth();
    const [ticket, setTicket] = useState(initialTicket);

    useEffect(() => {
        setTicket(initialTicket);
    }, [initialTicket]);

    if (!appUser || !ticket) {
        return null;
    }

    const handleFieldChange = (field: keyof Ticket, value: any) => {
        if (!ticket) return;

        const updatedTicket = {
             ...ticket,
             [field]: value,
             updatedAt: new Date().toISOString(),
        };
        setTicket(updatedTicket);
        onUpdateTicket(updatedTicket);
    }
    
    const assignee = allUsers.find(u => u.id === ticket.assignedTo);
    const createdBy = allUsers.find(u => u.id === ticket.createdBy) || visitors.find(v => v.id === ticket.createdBy);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-4xl h-[90vh] flex flex-col p-0 gap-0")}>
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle>{ticket.title}</DialogTitle>
                    <DialogDescription>
                        Created by {createdBy?.name || 'System'} on {format(parseISO(ticket.createdAt), "PPP")}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-4 md:p-6 space-y-6">
                        <DetailRow icon={Flag} label="Status">
                            <Select value={ticket.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                            </Select>
                        </DetailRow>
                        <DetailRow icon={UserIcon} label="Assignee">
                            <Select value={ticket.assignedTo || ''} onValueChange={(value) => handleFieldChange('assignedTo', value)}>
                                <SelectTrigger className="h-8">
                                    <SelectValue>
                                        {assignee ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarImage src={assignee.avatarUrl} /><AvatarFallback>{getInitials(assignee.name)}</AvatarFallback></Avatar>
                                                {assignee.name}
                                            </div>
                                        ) : 'Unassigned'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Unassigned</SelectItem>
                                    {allUsers.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                                {user.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DetailRow>
                         <DetailRow icon={Flag} label="Priority">
                            <Select value={ticket.priority || ''} onValueChange={(value) => handleFieldChange('priority', value)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="Set priority" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </DetailRow>
                        {contact && (
                            <DetailRow icon={AtSign} label="Contact">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6"><AvatarFallback>{getInitials(contact.name || '?')}</AvatarFallback></Avatar>
                                    {contact.name} ({contact.email})
                                </div>
                            </DetailRow>
                        )}
                        {conversation && (
                            <DetailRow icon={MessageSquare} label="Conversation">
                                <Button variant="link" className="p-0 h-auto">View Conversation</Button>
                            </DetailRow>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
