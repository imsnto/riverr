// src/components/dashboard/tickets-board.tsx
'use client';

import React, { useState, DragEvent, useRef, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Ticket, Hub, Status, Visitor, Conversation, Space, EscalationIntakeRule } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Plus, Edit } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import TicketDetailsDialog from './ticket-details-dialog';
import BoardSettingsDialog from './board-settings-dialog';
import CreateTicketDialog from './create-ticket-dialog';
import { addTicket, updateTask } from '@/lib/db';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
}

const TicketCard = ({ ticket, onClick, isDragging, allUsers, visitors }: { ticket: Ticket, onClick: () => void, isDragging: boolean, allUsers: User[], visitors: Visitor[] }) => {
  const assignee = allUsers.find(u => u.id === ticket.assignedTo);
  const contact = visitors.find(v => v.id === ticket.contactId);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "mb-2 bg-card hover:shadow-md transition-shadow duration-200 cursor-pointer",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <CardHeader className="p-3 cursor-grab">
        <CardTitle className="text-sm font-medium">{ticket.title}</CardTitle>
        {ticket.lastMessagePreview && <p className="text-xs text-muted-foreground truncate">{ticket.lastMessagePreview}</p>}
      </CardHeader>
      <CardFooter className="flex justify-between items-center p-3 pt-0">
         <div className="flex items-center gap-2 text-muted-foreground">
            {contact && (
                <div className="flex items-center gap-1 text-xs">
                    <Avatar className="h-4 w-4"><AvatarFallback>{getInitials(contact.name || '?')}</AvatarFallback></Avatar>
                    {contact.name}
                </div>
            )}
         </div>
        {assignee && (
            <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                <AvatarFallback>{assignee ? getInitials(assignee.name) : 'U'}</AvatarFallback>
            </Avatar>
        )}
      </CardFooter>
    </Card>
  );
};

interface TicketsBoardProps {
  tickets: Ticket[];
  onUpdateTickets: (tickets: Ticket[]) => void;
  activeHub: Hub;
  activeSpace: Space;
  allUsers: User[];
  visitors: Visitor[];
  conversations: Conversation[];
  onUpdateActiveHub: (updatedHub: Partial<Hub>) => void;
  onNavigateToSettings: () => void;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
}

const defaultStatuses: Status[] = [
    { name: 'New', color: '#6b7280' }, { name: 'Open', color: '#3b82f6' }, 
    { name: 'Waiting on Customer', color: '#f59e0b' }, { name: 'Escalated', color: '#ef4444' }, 
    { name: 'Closed', color: '#22c55e' },
];

export default function TicketsBoard({ tickets, onUpdateTickets, activeHub, activeSpace, allUsers, visitors, conversations, onUpdateActiveHub, onNavigateToSettings, allHubs, escalationRules, projects }: TicketsBoardProps) {
  const [draggedTicket, setDraggedTicket] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAuth();
  
  const statuses = activeHub.ticketStatuses || defaultStatuses;
  
  const [dropIndicator, setDropIndicator] = useState<{ status: string; index: number } | null>(null);
  const ticketCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hubMembers = useMemo(() => {
    if (!activeHub || !activeSpace) return [];
    
    let memberIds: string[] | undefined;

    if (activeHub.settings?.ticketMembers) {
      memberIds = activeHub.settings.ticketMembers;
    } else if (activeHub.isPrivate && activeHub.memberIds) {
      memberIds = activeHub.memberIds;
    } else {
      memberIds = Object.keys(activeSpace.members);
    }
    
    return allUsers.filter(u => memberIds?.includes(u.id));
  }, [activeHub, activeSpace, allUsers]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, ticketId: string) => {
    e.dataTransfer.setData('ticketId', ticketId);
    setDraggedTicket(ticketId);
  };

    const handleDragOver = (e: DragEvent<HTMLDivElement>, status: string) => {
        e.preventDefault();
        const columnTickets = tickets.filter(t => t.status === status);
        const mouseY = e.clientY;
        let closestTaskIndex = columnTickets.length;

        for (let i = 0; i < columnTickets.length; i++) {
            const t = columnTickets[i];
            if (t.id === draggedTicket) continue;
            const el = ticketCardRefs.current[t.id];
            if (!el) continue;
            const { top, height } = el.getBoundingClientRect();
            const mid = top + height / 2;
            if (mouseY < mid) {
                closestTaskIndex = i;
                break;
            }
        }
        if (dropIndicator?.status !== status || dropIndicator?.index !== closestTaskIndex) {
            setDropIndicator({ status, index: closestTaskIndex });
        }
    };
  
    const handleColumnDragLeave = (e: DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropIndicator(null);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, newStatus: string) => {
        e.preventDefault();
        const ticketId = e.dataTransfer.getData('ticketId');
        if (!ticketId || !dropIndicator) return;
        const ticketToMove = tickets.find(t => t.id === ticketId);
        if (!ticketToMove) return;

        const sameColumn = ticketToMove.status === newStatus;
        const fromIndex = tickets.filter(t => t.status === ticketToMove.status).findIndex(t => t.id === ticketId);
        let insertIndex = dropIndicator.index;
        if (sameColumn && fromIndex !== -1 && fromIndex < insertIndex) {
            insertIndex -= 1;
        }

        const newTickets = tickets.filter(t => t.id !== ticketId);
        const targetColumnTickets = newTickets.filter(t => t.status === newStatus);
        targetColumnTickets.splice(insertIndex, 0, { ...ticketToMove, status: newStatus, updatedAt: new Date().toISOString() });
        const otherColumnTickets = newTickets.filter(t => t.status !== newStatus);
        
        onUpdateTickets([...otherColumnTickets, ...targetColumnTickets]);
        setDropIndicator(null);
        setDraggedTicket(null);
    };

    const handleDragEnd = () => {
        setDraggedTicket(null);
        setDropIndicator(null);
    };
    
    const handleUpdateTicket = (updatedTicket: Ticket) => {
        onUpdateTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
    };

     const handleSaveSettings = (newMemberIds: string[]) => {
        onUpdateActiveHub({
            settings: {
                ...activeHub.settings,
                ticketMembers: newMemberIds,
            }
        });
        setIsSettingsOpen(false);
        toast({ title: "Ticket members updated." });
    }
    
    const handleCreateTicket = async (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => {
        // In a real app, this would call a cloud function `createTicketAndMaybeEscalate`
        const finalTicketData = { ...ticketData };
        if (escalateNow) {
            finalTicketData.status = 'Escalated';
            finalTicketData.escalation = {
                status: 'queued', // Backend would change this to 'sent' or 'failed'
                requestedAt: new Date().toISOString(),
                requestedBy: appUser?.id,
                intakeRuleId: intakeRuleId
            };
        }
        await addTicket(finalTicketData);
        // Refresh data
        // For optimistic UI, we would add the ticket to the local state here.
        toast({ title: "Ticket created" });
    }


    const renderStatusColumn = (status: Status) => {
      const columnTickets = tickets.filter(ticket => ticket.status === status.name);
      return (
        <div key={status.name} className="flex-shrink-0 w-64 md:w-72 h-full min-h-0 flex flex-col"
            onDrop={(e) => handleDrop(e, status.name)}
            onDragOver={(e) => handleDragOver(e, status.name)}
            onDragLeave={handleColumnDragLeave}
        >
            <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}/>
                    <h2 className="text-lg font-semibold">{status.name}</h2>
                </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-0.5">
                    {columnTickets.map((ticket, index) => {
                        const showIndicator = dropIndicator?.status === status.name && dropIndicator.index === index;
                        return (
                            <React.Fragment key={ticket.id}>
                                {showIndicator && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                                <div ref={el => ticketCardRefs.current[ticket.id] = el} draggable onDragStart={(e) => handleDragStart(e, ticket.id)} onDragEnd={handleDragEnd}
                                    className={cn("transition-all duration-200", draggedTicket === ticket.id ? "opacity-30" : "opacity-100")}>
                                    <TicketCard ticket={ticket} onClick={() => setSelectedTicket(ticket)} isDragging={draggedTicket === ticket.id} allUsers={allUsers} visitors={visitors} />
                                </div>
                            </React.Fragment>
                        );
                    })}
                    {dropIndicator?.status === status.name && dropIndicator.index === columnTickets.length && <div className="h-10 border-2 border-dashed border-primary rounded-lg" />}
                </div>
            </div>
        </div>
      )
    };

  return (
    <>
      <div className="flex h-full min-w-0 flex-col overflow-hidden">
        <div className="hidden md:flex w-full min-w-0 shrink-0 justify-between items-center px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Tickets</h1>
                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSettingsOpen(true)}>
                    <Edit className="h-4 w-4" />
                </Button>
            </div>
             <div className="flex items-center gap-4">
                <Button onClick={() => setIsCreateTicketOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Ticket
                </Button>
                <div className="flex -space-x-2">
                    {hubMembers.slice(0, 5).map(member => (
                        <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={member.avatarUrl} alt={member.name} />
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                    ))}
                    {hubMembers.length > 5 && (
                        <Avatar className="h-8 w-8 border-2 border-background">
                            <AvatarFallback>+{hubMembers.length - 5}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
                <Button variant="outline" onClick={onNavigateToSettings}>Invite</Button>
            </div>
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="h-full w-full min-w-0 overflow-x-auto overflow-y-hidden">
            <div className="flex w-max gap-4 p-4 md:p-6 md:pt-2 h-full">
              {statuses.map(renderStatusColumn)}
            </div>
          </div>
        </div>
      </div>
      {selectedTicket && (
        <TicketDetailsDialog
            ticket={selectedTicket}
            isOpen={!!selectedTicket}
            onOpenChange={() => setSelectedTicket(null)}
            onUpdateTicket={handleUpdateTicket}
            statuses={statuses.map(s => s.name)}
            allUsers={allUsers}
            contact={visitors.find(v => v.id === selectedTicket.contactId) || null}
            conversation={conversations.find(c => c.id === selectedTicket.conversationId) || null}
        />
      )}
       <BoardSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        boardName="Ticket"
        allUsers={allUsers.filter(u => activeSpace.members[u.id])}
        initialMembers={activeHub.settings?.ticketMembers || Object.keys(activeSpace.members)}
        onSave={handleSaveSettings}
        appUser={appUser}
      />
      <CreateTicketDialog
        isOpen={isCreateTicketOpen}
        onOpenChange={setIsCreateTicketOpen}
        activeHub={activeHub}
        activeSpace={activeSpace}
        allUsers={allUsers}
        visitors={visitors}
        onCreateTicket={handleCreateTicket}
        allHubs={allHubs}
        escalationRules={escalationRules}
        projects={projects}
      />
    </>
  );
}

    