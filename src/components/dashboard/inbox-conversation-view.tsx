'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, ChatMessage, Visitor, User, Ticket, Hub, Space, EscalationIntakeRule, Project, Contact } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { PanelLeftClose, ArrowLeft, Info, Send, Plus, StickyNote, User as UserIcon, Ticket as TicketIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '../ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '../ui/card';
import CreateTicketDialog from './create-ticket-dialog';

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
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

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
    onCreateTicket
}: InboxConversationViewProps) {
  const [isNote, setIsNote] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);

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

  const renderMessageBubble = (msg: ChatMessage) => {
    const isCustomer = msg.senderType === 'contact';
    const agent = isCustomer ? null : users.find(u => u.id === msg.authorId);

    if (msg.type === 'event') {
      return (
        <div key={msg.id} className="text-center text-xs text-muted-foreground my-4">
          <span>{msg.content}</span>
        </div>
      )
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

    return (
      <div key={msg.id} className={cn("flex items-end gap-2", isCustomer ? "" : "justify-end")}>
        {isCustomer && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={contact.avatarUrl} />
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
        )}
        <div>
          <div className={cn("rounded-2xl p-3 max-w-md", isCustomer ? "bg-muted rounded-bl-none" : "bg-primary text-primary-foreground rounded-br-none")}>
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
          <p className={cn("text-[11px] mt-1 opacity-70", isCustomer ? "" : "text-right")}>
            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>
    );
  };


  return (
    <>
      <div className="relative grid grid-rows-[auto_1fr_auto] h-full min-h-0 bg-background md:bg-card">
        {/* Floating mini header */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-background/90 to-transparent">
          <div className="pointer-events-auto grid grid-cols-3 items-center gap-3 p-3">
            <div className="flex justify-start">
              {isMobile && onBack && (
                <Button variant="ghost" size="icon" className="-ml-1" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
            </div>
            
            <div className="flex justify-center">
              <button
                  onClick={isMobile ? onToggleContactDailog : onToggleContactPanel}
                  className={cn(
                  "flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1.5 shadow-sm hover:bg-accent transition-colors"
                  )}
              >
                  <Avatar className="h-7 w-7">
                  <AvatarImage src={contact.avatarUrl || undefined} alt={contact.name || ''} />
                  <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold leading-none">{contact.name}</span>
              </button>
            </div>

            <div className="flex justify-end">
              {isMobile ? (
                <Button variant="ghost" size="icon" onClick={onToggleContactDailog}>
                  <Info className="h-5 w-5" />
                </Button>
              ) : (
                !isContactPanelOpen && (
                  <Button variant="ghost" size="icon" onClick={onToggleContactPanel}>
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="h-full min-h-0">
          {/* IMPORTANT: top padding so messages never go under the floating header */}
          <div className="p-4 pt-16 space-y-6">
            {conversationMessages.map(renderMessageBubble)}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className={cn("p-2 border-t bg-background md:bg-card flex items-end gap-2", isNote && "bg-amber-50 dark:bg-amber-950/50")}>
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
                title: ticketData.title || `Ticket from conversation with ${contact.name}`,
                description: ticketData.description || `Created from conversation: ${conversation.lastMessage}`
            };
            onCreateTicket(ticketWithConvo, escalate, ruleId);
        }}
        allHubs={allHubs}
        escalationRules={escalationRules}
        projects={projects}
        contactInfo={contact ? { id: contact.id, name: contact.name, email: contact.email } : undefined}
        disableContactSelection={true}
      />
    </>
  );
}
