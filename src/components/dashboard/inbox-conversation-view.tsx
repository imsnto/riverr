
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Conversation, ChatMessage, Visitor, User, Ticket, Hub, Space, EscalationIntakeRule, Project, Contact, Status } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { PanelLeftClose, ArrowLeft, Info, Send, Plus, StickyNote, User as UserIcon, Ticket as TicketIcon, ChevronRight, FileIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '../ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '../ui/card';
import CreateTicketDialog from './create-ticket-dialog';
import { Badge } from '../ui/badge';
import TicketDetailsDialog from './ticket-details-dialog';
import { marked } from 'marked';

interface InboxConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  contact: Visitor | null;
  users: User[];
  appUser: User;
  isContactPanelOpen: boolean;
  onToggleContactPanel: () => void;
  onSendMessage: (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => void;
  onAssignConversation: (conversationId: string, assigneeId: string | null) => void;
  onBack?: () => void;
  onToggleContactDailog: () => void;
  activeHub: Hub;
  activeSpace: Space;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
  contacts: Contact[];
  onDataRefresh: () => void;
  onCreateTicket: (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => void;
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const defaultTicketStatuses: Status[] = [
    { name: 'New', color: '#6b7280' }, { name: 'Open', color: '#3b82f6' }, 
    { name: 'Waiting on Customer', color: '#f59e0b' }, { name: 'Escalated', color: '#ef4444' }, 
    { name: 'Closed', color: '#22c55e' },
];

export default function InboxConversationView({ 
    conversation, 
    messages, 
    contact, 
    users, 
    appUser, 
    isContactPanelOpen, 
    onToggleContactPanel, 
    onSendMessage, 
    onAssignConversation, 
    onBack, 
    onToggleContactDailog,
    activeHub,
    activeSpace,
    allHubs,
    escalationRules,
    projects,
    contacts,
    onDataRefresh,
    onCreateTicket,
    tickets,
    onUpdateTicket,
}: InboxConversationViewProps) {
  const [isNote, setIsNote] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isTicketDetailsOpen, setIsTicketDetailsOpen] = useState(false);

  const activeTicket = useMemo(() => {
    if (!conversation || !tickets || !activeHub) return null;
    const closingStatus = activeHub.ticketClosingStatusName || 'Closed';
    // Find the most recent, non-closed ticket for this conversation
    return tickets
      .filter(t => t.conversationId === conversation.id && t.status !== closingStatus)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [conversation, tickets, activeHub]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conversation?.id]);

  if (!conversation || !contact) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground">Select a conversation to start messaging.</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!messageText.trim()) return;

    const newMessage: Omit<ChatMessage, 'id' | 'conversationId'> = {
      authorId: appUser.id,
      type: isNote ? 'note' : 'message',
      senderType: 'agent',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    onSendMessage(conversation.id, newMessage);
    setMessageText('');
    setIsNote(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleAssign = (userId: string | null) => {
    onAssignConversation(conversation.id, userId);
  };

  const assignee = users.find(u => u.id === conversation.assigneeId);
  const conversationMessages = messages.filter(m => m.conversationId === conversation.id);
  const ticketPillAssignee = activeTicket ? users.find(u => u.id === activeTicket.assignedTo) : null;
  const displayName = conversation.visitorName || contact.name || 'Visitor';

   const renderAttachments = (msg: ChatMessage) => {
      if (!msg.attachments || msg.attachments.length === 0) return null;
      
      return (
        <div className="mt-2 space-y-2 overflow-hidden">
          {msg.attachments.map(att => (
            <div key={att.id}>
              {att.type === 'image' ? (
                <img src={att.url} alt={att.name} className="rounded-lg max-w-xs max-h-64 object-cover" />
              ) : (
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-white hover:underline bg-zinc-700/50 p-2 rounded-md max-w-xs">
                  <FileIcon className="h-4 w-4" />
                  <span className="truncate">{att.name}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )
    }


  const renderMessageBubble = (msg: ChatMessage) => {
    const isCustomer = msg.senderType === 'contact';
    const agent = isCustomer ? null : users.find(u => u.id === msg.authorId);
    const isAI = msg.authorId === 'ai_agent';

    if (msg.type === 'event') {
        const eventAuthor = users.find(u => u.id === msg.authorId);
        return (
            <div key={msg.id} className="flex justify-center py-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <TicketIcon className="h-4 w-4" />
                    <span className="font-semibold">{eventAuthor?.name}</span>
                    <span>{msg.content}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
                </div>
            </div>
        );
    }

    if (msg.type === 'note') {
      const noteAuthor = users.find(u => u.id === msg.authorId);
      return (
        <div key={msg.id} className="flex justify-center">
          <Card className="w-full max-w-2xl bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 my-2">
            <div className="p-3">
              <div className='flex items-center justify-between'>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {noteAuthor?.name || 'A user'} added an internal note
                </p>
                <p className='text-[11px]'>{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</p>
              </div>
              <p className="text-sm mt-2">{msg.content}</p>
            </div>
          </Card>
        </div>
      )
    }
    
    const contentHtml = (isAI && msg.content) ? marked.parse(msg.content) : msg.content;

    return (
      <div key={msg.id} className={cn("flex items-end gap-2 min-w-0", isCustomer ? "" : "justify-end")}>
        {isCustomer && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={contact.avatarUrl} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
        )}
        <div className="min-w-0">
          <div className={cn("rounded-2xl p-3 max-w-md", isCustomer ? "bg-muted rounded-bl-none" : "bg-primary text-primary-foreground rounded-br-none")}>
             {isAI ? (
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words overflow-hidden [&_a]:break-all [&_a]:whitespace-normal [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-x-auto [&_code]:break-words" dangerouslySetInnerHTML={{ __html: contentHtml as string }}/>
            ) : (
                <div className="text-sm whitespace-pre-wrap break-all">
                  {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                {renderAttachments(msg)}
                </div>
            )}
          </div>
          <p className={cn("text-[11px] mt-1 opacity-70", isCustomer ? "" : "text-right")}>
            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
          </p>
        </div>
         {!isCustomer && agent && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={agent.avatarUrl} alt={agent.name || ''} />
              <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
            </Avatar>
        )}
      </div>
    );
  };


  return (
    <>
      <div className="relative grid grid-rows-[auto_1fr_auto] h-full min-h-0 bg-background md:bg-card">
        {/* Header */}
        <div className="p-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && onBack && (
              <Button variant="ghost" size="icon" className="-ml-1" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatarUrl || undefined} alt={displayName} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => onToggleContactPanel()}>
                    <Info className="mr-2 h-4 w-4"/>
                    View Contact Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Assign to...</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onSelect={() => handleAssign(null)}>Unassigned</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {users.map(user => (
                        <DropdownMenuItem key={user.id} onSelect={() => handleAssign(user.id)}>
                          {user.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge variant={assignee ? 'secondary' : 'outline'}>
              {assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}
            </Badge>

          </div>
          <div className="flex items-center">
            {!isMobile && (
              <Button variant="ghost" size="icon" onClick={onToggleContactPanel}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        

        {/* Messages */}
        <ScrollArea className="h-full min-h-0">
          <div className="p-4 space-y-6">
            {conversationMessages.map(renderMessageBubble)}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className={cn("p-2 border-t bg-background md:bg-card space-y-2", isNote && "bg-amber-50 dark:bg-amber-950/50")}>
            {activeTicket && (
                <button
                    onClick={() => setIsTicketDetailsOpen(true)}
                    className="w-full text-left p-2 rounded-lg bg-muted hover:bg-muted/80 flex justify-between items-center"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <TicketIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold truncate flex-1">{activeTicket.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {ticketPillAssignee && (
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={ticketPillAssignee.avatarUrl} />
                                <AvatarFallback>{getInitials(ticketPillAssignee.name)}</AvatarFallback>
                            </Avatar>
                        )}
                        <Badge variant="outline">{activeTicket.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                </button>
            )}
          <div className="flex items-end gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full">
                    <Plus className="h-5 w-5" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem onSelect={() => setIsNote(true)}>
                    <StickyNote className="mr-2 h-4 w-4"/>
                    Add Internal Note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsCreateTicketOpen(true)}>
                    <TicketIcon className="mr-2 h-4 w-4"/>
                    Create Ticket
                </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative flex-1">
                <Textarea
                placeholder={isNote ? "Add an internal note..." : "Message..."}
                className={cn(
                    "rounded-2xl pr-12 py-2.5",
                    isNote ? "bg-amber-100 dark:bg-amber-950/50" : "bg-muted"
                )}
                minRows={1}
                maxRows={5}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ fontSize: '16px' }}
                />
                <div className="absolute right-1.5 bottom-1.5 flex items-center gap-1">
                {isNote && <Button variant="ghost" size="sm" onClick={() => setIsNote(false)}>Cancel Note</Button>}
                <Button 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                >
                    <Send className="h-4 w-4" />
                </Button>
                </div>
            </div>
          </div>
        </div>
      </div>
      <CreateTicketDialog
        isOpen={isCreateTicketOpen}
        onOpenChange={setIsCreateTicketOpen}
        activeHub={activeHub}
        activeSpace={activeSpace}
        allUsers={users}
        contacts={contacts}
        onDataRefresh={onDataRefresh}
        onCreateTicket={(ticketData, escalate, ruleId) => {
            const ticketWithConvo = {
                ...ticketData,
                conversationId: conversation.id,
                contactId: conversation.contactId,
                title: ticketData.title || `Ticket from conversation with ${displayName}`,
                description: ticketData.description || `Created from conversation: ${conversation.lastMessage}`,
                lastMessagePreview: conversation.lastMessage,
                lastMessageAt: conversation.lastMessageAt,
                lastMessageAuthor: conversation.lastMessageAuthor,
            };
            onCreateTicket(ticketWithConvo, escalate, ruleId);
        }}
        allHubs={allHubs}
        escalationRules={escalationRules}
        projects={projects}
        contactInfo={contact ? { id: contact.id, name: contact.name, email: contact.email } : undefined}
        disableContactSelection={true}
      />
      {activeTicket && (
        <TicketDetailsDialog
          ticket={activeTicket}
          isOpen={isTicketDetailsOpen}
          onOpenChange={setIsTicketDetailsOpen}
          onUpdateTicket={onUpdateTicket}
          statuses={activeHub.ticketStatuses?.map(s => s.name) || defaultTicketStatuses.map(s => s.name)}
          allUsers={users}
          contact={contact}
          conversation={conversation}
        />
      )}
    </>
  );
}
