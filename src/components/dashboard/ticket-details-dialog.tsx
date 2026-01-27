
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ticket, User, Conversation, Contact, Activity } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { 
    AtSign, Calendar, Flag, MessageSquare, User as UserIcon, X, Tag, Copy, 
    GitMerge, Briefcase, Clock, FileText, ChevronRight, CheckCircle, Edit3, Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

interface DetailRowProps {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    className?: string;
}
const DetailRow: React.FC<DetailRowProps> = ({ icon: Icon, label, children, className }) => (
    <div className={cn("flex items-center text-sm", className)}>
        <Icon className="h-4 w-4 w-8 text-muted-foreground" />
        <span className="text-muted-foreground w-24">{label}</span>
        <div className="flex-1">{children}</div>
    </div>
);

const PriorityBadge = ({ priority }: { priority: Ticket['priority'] }) => {
  if (!priority) return null;
  const priorityStyles: Record<string, string> = {
    'Low': 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
    'Medium': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
    'High': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
    'Urgent': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
  };
  return <Badge variant="outline" className={cn('font-semibold', priorityStyles[priority] || 'bg-gray-100')}>{priority}</Badge>
};


const TicketActivityItem = ({ activity, allUsers }: { activity: Activity; allUsers: User[] }) => {
    const user = allUsers.find(u => u.id === activity.user_id);
    const renderContent = () => {
        switch (activity.type) {
            case 'ticket_creation':
                return (
                    <div><span className="font-semibold">{user?.name || 'Unknown'}</span> created this ticket.</div>
                );
            case 'status_change':
                return (
                    <div><span className="font-semibold">{user?.name}</span> changed status from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></div>
                );
            case 'assignee_change':
                const fromUser = allUsers.find(u => u.id === activity.from)?.name || activity.from || 'Unassigned';
                const toUser = allUsers.find(u => u.id === activity.to)?.name || activity.to || 'Unassigned';
                return (
                    <div><span className="font-semibold">{user?.name}</span> changed assignee from <Badge variant="outline">{fromUser}</Badge> to <Badge variant="outline">{toUser}</Badge></div>
                );
            default:
                return null;
        }
    }
    if (!renderContent()) return null;

    return (
        <div className="flex items-start gap-3">
            <Avatar className="h-6 w-6 mt-1">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback>{user ? getInitials(user.name) : 'U'}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
                {renderContent()}
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</p>
            </div>
        </div>
    )
}


interface TicketDetailsDialogProps {
    ticket: Ticket | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onUpdateTicket: (ticket: Ticket) => void;
    statuses: string[];
    allUsers: User[];
    contact: Contact | null;
    conversation: Conversation | null;
}

export default function TicketDetailsDialog({ ticket: initialTicket, isOpen, onOpenChange, onUpdateTicket, statuses, allUsers, contact, conversation }: TicketDetailsDialogProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [ticket, setTicket] = useState(initialTicket);
    const { appUser } = useAuth();

    useEffect(() => {
        setTicket(initialTicket);
    }, [initialTicket]);

    if (!ticket) return null;
    
    const handleFieldChange = (field: keyof Ticket, value: any) => {
        let updatedTicket = { ...ticket, [field]: value, updatedAt: new Date().toISOString() };

        if (appUser) {
            if (field === 'status' && ticket.status !== value) {
                const newActivity: Activity = {
                    id: `act-${Date.now()}`,
                    user_id: appUser.id,
                    timestamp: new Date().toISOString(),
                    type: 'status_change',
                    from: ticket.status,
                    to: value,
                };
                updatedTicket.activities = [...(updatedTicket.activities || []), newActivity];
            }

            if (field === 'assignedTo' && ticket.assignedTo !== value) {
                const fromUser = allUsers.find(u => u.id === ticket.assignedTo)?.name || 'Unassigned';
                const toUser = allUsers.find(u => u.id === value)?.name || 'Unassigned';
                const newActivity: Activity = {
                    id: `act-${Date.now()}`,
                    user_id: appUser.id,
                    timestamp: new Date().toISOString(),
                    type: 'assignee_change',
                    from: fromUser,
                    to: toUser,
                };
                updatedTicket.activities = [...(updatedTicket.activities || []), newActivity];
            }
        }
        
        setTicket(updatedTicket);
        onUpdateTicket(updatedTicket);
    };

    const handleCopy = (text: string | null) => {
      if (!text) return;
      navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard', description: text });
    };

    const handleOpenConversation = () => {
        if (ticket?.conversationId && ticket.hubId && ticket.spaceId) {
          onOpenChange(false);
          router.push(`/space/${ticket.spaceId}/hub/${ticket.hubId}/inbox?conversationId=${ticket.conversationId}`);
        } else {
          toast({
            variant: "destructive",
            title: "Conversation not found",
            description: "This ticket is not linked to a conversation.",
          });
        }
    };
    
    const handleOpenContactProfile = () => {
        if (contact?.id) {
            onOpenChange(false);
            router.push(`/contacts?contactId=${contact.id}`);
        } else {
            toast({
                variant: "destructive",
                title: "Contact not found"
            });
        }
    };

    const assignee = allUsers.find(u => u.id === ticket.assignedTo);
    const createdBy = allUsers.find(u => u.id === ticket.createdBy) || (contact && contact.id === ticket.createdBy ? contact : null);
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-4xl h-[90vh] flex flex-col p-0 gap-0")}>
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <DialogTitle>{ticket.title}</DialogTitle>
                        <PriorityBadge priority={ticket.priority} />
                    </div>
                    <DialogDescription>
                        Created by {createdBy?.name || 'System'} on {format(parseISO(ticket.createdAt), "PPP")}
                        <span className="mx-2 text-muted-foreground">•</span>
                        Updated {formatDistanceToNow(parseISO(ticket.updatedAt), { addSuffix: true })}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1">
                  <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* ACTIVITY TIMELINE */}
                        <div>
                            <h4 className="font-semibold mb-2">Activity</h4>
                             <Card>
                                <CardContent className="p-4 max-h-60 overflow-y-auto">
                                    <div className="space-y-4">
                                    {ticket.activities && ticket.activities.length > 0 ? (
                                        ticket.activities
                                            .slice()
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                            .map(activity => (
                                                <TicketActivityItem key={activity.id} activity={activity} allUsers={allUsers} />
                                            ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
                                    )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* LINKED DEV WORK */}
                        <div>
                             <h4 className="font-semibold mb-2">Linked Dev Work</h4>
                             <div className="border rounded-lg p-4">
                                {ticket.escalation?.devItemId ? (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">Task: {ticket.escalation.devItemId}</p>
                                            <Badge>{ticket.escalation.lastKnownDevStatus || 'Unknown'}</Badge>
                                        </div>
                                        <Button variant="outline">Open Dev Task</Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-muted-foreground">Not escalated</p>
                                        <Button variant="secondary"><GitMerge className="mr-2" /> Escalate to Devs</Button>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        {/* CUSTOMER */}
                        {contact && (
                            <Card>
                                <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-semibold">{contact.name}</p>
                                    </div>
                                    {contact.primaryEmail && (
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2 text-sm truncate">
                                                <AtSign className="h-4 w-4 text-muted-foreground"/>
                                                <span className="truncate">{contact.primaryEmail}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleCopy(contact.primaryEmail!)}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                     <Button variant="secondary" className="w-full" onClick={handleOpenContactProfile}>View Full Profile</Button>
                                </CardFooter>
                            </Card>
                        )}
                         {/* CONVERSATION */}
                        {ticket.conversationId && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        Linked Conversation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Button variant="outline" className="w-full" onClick={handleOpenConversation}>
                                        View Conversation
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                        {/* DETAILS */}
                        <Card>
                            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                 <DetailRow icon={CheckCircle} label="Status">
                                    <Select value={ticket.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>{statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                                    </Select>
                                </DetailRow>
                                <DetailRow icon={UserIcon} label="Assignee">
                                    <Select value={ticket.assignedTo || 'unassigned'} onValueChange={(value) => handleFieldChange('assignedTo', value === 'unassigned' ? null : value)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue>{assignee?.name || 'Unassigned'}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {allUsers.map(user => (<SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>))}
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
                                <DetailRow icon={MessageSquare} label="Channel">
                                    <Badge variant="outline">{ticket.channel}</Badge>
                                </DetailRow>
                            </CardContent>
                        </Card>
                    </div>
                  </div>
                </ScrollArea>
                 <DialogFooter className="p-6 pt-4 border-t flex justify-between">
                    <div/>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => {}}><Edit3 className="mr-2 h-4 w-4" /> Add Note</Button>
                        <Button variant="destructive">Close Ticket</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
