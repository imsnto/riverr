
// src/components/dashboard/inbox-conversation-view.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Conversation, ChatMessage, Visitor, User, Ticket, Hub, Space, EscalationIntakeRule, Project, Task, Contact, ResponderType } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn, getInitials } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { PanelLeftClose, ArrowLeft, Info, Send, Plus, StickyNote, User as UserIcon, Ticket as TicketIcon, ChevronRight, FileIcon, Check, Bot, Smartphone, Phone, PhoneMissed, PhoneIncoming, PhoneOutgoing, Mic, Share2, Mail, Loader2, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '../ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '../ui/card';
import CreateTicketDialog from './create-ticket-dialog';
import { Badge } from '../ui/badge';
import TicketDetailsDialog from './ticket-details-dialog';
import { marked } from 'marked';
import * as db from '@/lib/db';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';

interface InboxConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  contact: Visitor | null;
  users: User[];
  appUser: User;
  isContactPanelOpen: boolean;
  onToggleContactPanel: () => void;
  onSendMessage: (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => void;
  onAssignConversation: (conversationId: string, assigneeIds: string[]) => void;
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
  onEscalate: (ticket: Ticket, intakeRuleId: string) => void;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
}

const defaultTicketStatuses = [
    { name: 'New', color: '#6b7280' }, { name: 'Open', color: '#3b82f6' }, 
    { name: 'Waiting on Customer', color: '#f59e0b' }, { name: 'Escalated', color: '#ef4444' }, 
    { name: 'Closed', color: '#22c55e' },
];

const TypingBubble = ({ align = 'start' }: { align?: 'start' | 'end' }) => (
  <div className={cn("flex items-end gap-2 mb-4", align === 'end' ? 'justify-end' : 'justify-start')}>
    <div className={cn(
      "p-3 rounded-xl flex items-center gap-1 shadow-sm", 
      align === 'start' ? "bg-muted rounded-bl-none" : "bg-primary rounded-br-none"
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full bg-current typing-dot", align === 'end' ? 'text-primary-foreground' : 'text-foreground')} />
      <div className={cn("w-1.5 h-1.5 rounded-full bg-current typing-dot", align === 'end' ? 'text-primary-foreground' : 'text-foreground')} />
      <div className={cn("w-1.5 h-1.5 rounded-full bg-current typing-dot", align === 'end' ? 'text-primary-foreground' : 'text-foreground')} />
    </div>
  </div>
);

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
    onEscalate,
    allTasks,
    onTaskSelect,
}: InboxConversationViewProps) {
  const { toast } = useToast();
  const [isNote, setIsNote] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVisitorTyping, setIsVisitorTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isTicketDetailsOpen, setIsTicketDetailsOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const assignedAgents = useMemo(() => {
    if (!conversation) return [];
    const ids = conversation.assignedAgentIds || (conversation.assigneeId ? [conversation.assigneeId] : []);
    return users.filter(u => ids.includes(u.id));
  }, [conversation, users]);

  const activeTicket = useMemo(() => {
    if (!conversation || !tickets || !activeHub) return null;
    const closingStatus = activeHub.ticketClosingStatusName || 'Closed';
    return tickets
      .filter(t => t.conversationId === conversation.id && t.status !== closingStatus)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [conversation, tickets, activeHub]);

  const ticketPillAssignee = useMemo(() => {
    if (!activeTicket) return null;
    return users.find(u => u.id === activeTicket.assignedTo) || null;
  }, [activeTicket, users]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conversation?.id, isVisitorTyping]);

  useEffect(() => {
    if (conversation && appUser) {
      const markSeen = async () => {
        const lastSeen = conversation.lastAgentSeenAtByAgent?.[appUser.id] ? new Date(conversation.lastAgentSeenAtByAgent[appUser.id]).getTime() : 0;
        const lastMessageAt = new Date(convoLastMessageAt).getTime();
        
        if (lastMessageAt > lastSeen) {
          await db.updateAgentSeenAt(conversation.id, appUser.id);
        }
      };
      
      const convoLastMessageAt = conversation.lastMessageAt;
      markSeen();
      
      const onFocus = () => markSeen();
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  }, [conversation?.id, conversation?.lastMessageAt, appUser]);

  // Sync Typing Status from Firestore
  useEffect(() => {
    if (!conversation || !contact) return;
    const isTyping = conversation.typing?.[contact.id] || conversation.typing?.[conversation.visitorId || 'visitor'] || false;
    setIsVisitorTyping(isTyping);
  }, [conversation?.typing, contact, conversation?.visitorId]);

  if (!conversation || !contact) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground">Select a conversation to start messaging.</p>
      </div>
    );
  }

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;

    if (conversation.channel === 'sms' && !isNote) {
      setIsSending(true);
      try {
        const functions = getFunctions(getApp());
        const sendComms = httpsCallable(functions, 'sendCommsMessage');
        await sendComms({
          conversationId: conversation.id,
          content: messageText
        });
        setMessageText('');
        db.setTypingStatus(conversation.id, appUser.id, false);
      } catch (e: any) {
        console.error("SMS send failed", e);
      } finally {
        setIsSending(false);
      }
    } else {
      const newMessage: Omit<ChatMessage, 'id' | 'conversationId'> = {
        authorId: appUser.id,
        type: isNote ? 'note' : 'message',
        senderType: 'agent',
        responderType: 'human',
        content: messageText,
        timestamp: new Date().toISOString(),
      };
      onSendMessage(conversation.id, newMessage);
      setMessageText('');
      setIsNote(false);
      db.setTypingStatus(conversation.id, appUser.id, false);
    }
  }

  const handleResolve = async () => {
    try {
      await db.resolveConversation(conversation.id, appUser.id, appUser.name, 'resolved_human');
      toast({ title: 'Conversation resolved' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to resolve' });
    }
  };

  const handleReopen = async () => {
    try {
      const routeTo = conversation.assigneeId ? 'human_assigned' : 'ai_active';
      await db.reopenConversation(conversation.id, routeTo);
      toast({ title: 'Conversation reopened' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to reopen' });
    }
  };

  const handleWaitingOnCustomer = async () => {
    try {
      await db.setWaitingOnCustomer(conversation.id);
      toast({ title: 'Status updated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to update status' });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    
    if (conversation && !isNote) {
      db.setTypingStatus(conversation.id, appUser.id, true);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        db.setTypingStatus(conversation.id, appUser.id, false);
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleToggleAssignee = (userId: string | null) => {
    if (userId === null) {
        onAssignConversation(conversation.id, []);
        return;
    }
    
    const currentIds = conversation.assignedAgentIds || (conversation.assigneeId ? [conversation.assigneeId] : []);
    const newIds = currentIds.includes(userId)
        ? currentIds.filter(id => id !== userId)
        : [...currentIds, userId];
        
    onAssignConversation(conversation.id, newIds);
  };

  const handleShareWithTeam = async () => {
    await db.updateConversation(conversation.id, {
      sharedWithTeam: true,
      ownerType: 'hub',
      ownerAgentId: null,
      status: 'unassigned'
    });
    toast({ title: 'Shared with Team', description: 'Conversation is now in the Team Inbox.' });
    if (onBack) onBack();
  };

  const conversationMessages = messages.filter(m => m.conversationId === conversation.id);
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
    const isCustomer = msg.senderType === 'contact' || msg.senderType === 'visitor';
    const agent = isCustomer ? null : users.find(u => u.id === msg.authorId);
    
    const isAI = msg.responderType === 'ai';
    const isAutomation = msg.responderType === 'automation';
    const isSystem = msg.responderType === 'system' || msg.type === 'event';

    if (isSystem) {
        return (
            <div key={msg.id} className="flex justify-center py-2">
                <span className="text-[10px] text-muted-foreground font-semibold px-2 py-1 rounded bg-muted/50 border border-border/50 uppercase tracking-tight">
                    {msg.content}
                </span>
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
    
    const contentHtml = (isAI && msg.content) ? marked.parse(msg.content) : msg.content;

    return (
      <div key={msg.id} className={cn("flex items-end gap-2 min-w-0", isCustomer ? "" : "justify-end")}>
        {isCustomer && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={contact.avatarUrl || undefined} />
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
          <div className={cn("flex items-center gap-2 text-[11px] mt-1 opacity-70", isCustomer ? "" : "justify-end")}>
            <span className="font-bold uppercase tracking-tight">
                {isAI ? 'Manowar Assistant (AI)' : isAutomation ? 'Support Assistant' : (isCustomer ? displayName : agent?.name || 'You')}
            </span>
            {msg.deliveryStatus && (
              <span className="capitalize text-primary font-bold">· {msg.deliveryStatus}</span>
            )}
            <span>· {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
          </div>
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
        <div className="p-3 flex justify-between items-center shrink-0 border-b">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <Button variant="ghost" size="icon" className="-ml-1" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatarUrl || undefined} alt={displayName} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold truncate max-w-[120px]">{displayName}</span>
                        {conversation.ownerType === 'user' && (
                            <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary/10 text-primary border-primary/20 uppercase tracking-tighter">
                                Personal · {conversation.channel === 'sms' ? '📱 SMS' : conversation.channel === 'voice' ? '📞 Voice' : '✉️ Email'}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                        {conversation.channel === 'sms' && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-1">
                            <Smartphone className="h-2 w-2" /> SMS
                        </Badge>
                        )}
                        {conversation.channel === 'voice' && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-1">
                            <Phone className="h-2 w-2" /> Voice
                        </Badge>
                        )}
                        {conversation.channel === 'email' && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-1">
                            <Mail className="h-2 w-2" /> Email
                        </Badge>
                        )}
                        {db.isConversationResolved(conversation.resolutionStatus) && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] border-green-500/50 text-green-500 bg-green-500/5">
                            <CheckCircle2 className="h-2 w-2 mr-1" />
                            {conversation.resolutionStatus === 'resolved_user_confirmed'
                              ? 'Confirmed'
                              : conversation.resolutionStatus === 'resolved_ai'
                              ? 'Auto-resolved'
                              : 'Resolved'}
                          </Badge>
                        )}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => onToggleContactPanel()}>
                    <Info className="mr-2 h-4 w-4"/>
                    View Contact Details
                </DropdownMenuItem>
                {conversation.ownerType === 'user' && (
                  <DropdownMenuItem onSelect={handleShareWithTeam}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share with Team
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {conversation.ownerType === 'hub' && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Assign to...</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="min-w-[240px] p-0 overflow-hidden">
                        <DropdownMenuItem 
                          onSelect={() => handleToggleAssignee(null)}
                          className={cn("m-1", (conversation.assignedAgentIds || []).length === 0 && "bg-accent")}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>Unassigned</span>
                            {(conversation.assignedAgentIds || []).length === 0 && <Check className="h-4 w-4" />}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="max-h-[300px] overflow-y-auto p-1">
                          {users.map(user => {
                            const isSelected = (conversation.assignedAgentIds || []).includes(user.id);
                            return (
                              <DropdownMenuItem 
                                key={user.id} 
                                onSelect={() => handleToggleAssignee(user.id)}
                                className={cn(isSelected && "bg-accent font-medium")}
                              >
                                <div className="flex items-center justify-between w-full gap-4">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm truncate">{user.name}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                                  </div>
                                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex flex-col justify-center min-w-0 leading-tight">
              <div className="flex items-center gap-3">
                {conversation.ownerType === 'user' ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black tracking-tighter h-5">Personal</Badge>
                ) : conversation.status === 'ai_active' ? (
                  <div className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-sm font-semibold text-indigo-400">Handled by AI Agent</span>
                  </div>
                ) : conversation.status === 'automated' ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-400">Automated</span>
                  </div>
                ) : (
                  <span className="text-sm font-semibold truncate">
                    {assignedAgents.length === 0 ? 'Unassigned' : 
                    assignedAgents.length === 1 ? `Assigned to ${assignedAgents[0].name}` :
                    `Assigned to ${assignedAgents.length} people`}
                  </span>
                )}
                
                {assignedAgents.length > 0 && conversation.ownerType === 'hub' && (
                  <div className="flex -space-x-2 overflow-hidden">
                    {assignedAgents.map(agent => (
                      <Avatar key={agent.id} className="h-5 w-5 border-2 border-background">
                        <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                        <AvatarFallback className="text-[8px]">{getInitials(agent.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs font-bold gap-1.5"
                onClick={handleWaitingOnCustomer}
                disabled={conversation.status === 'waiting_on_customer'}
              >
                <Clock className="h-3.5 w-3.5" /> Waiting on Customer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold gap-1.5 border-green-500/20 text-green-500 hover:bg-green-500/10"
                onClick={handleResolve}
                disabled={db.isConversationResolved(conversation.resolutionStatus)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
              </Button>
              {db.isConversationResolved(conversation.resolutionStatus) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5"
                  onClick={handleReopen}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </Button>
              )}
            </div>
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
            {isVisitorTyping && <TypingBubble align="start" />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className={cn("p-3 pb-8 md:pb-4 border-t bg-background md:bg-card space-y-2", isNote && "bg-amber-50 dark:bg-amber-950/50")}>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleResolve} className="text-green-500 focus:text-green-500">
                    <CheckCircle2 className="mr-2 h-4 w-4"/>
                    Resolve Conversation
                </DropdownMenuItem>
                {db.isConversationResolved(conversation.resolutionStatus) && (
                  <DropdownMenuItem onSelect={handleReopen}>
                    <RotateCcw className="mr-2 h-4 w-4"/>
                    Reopen Conversation
                  </DropdownMenuItem>
                )}
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
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                style={{ fontSize: '16px' }}
                />
                <div className="absolute right-1.5 bottom-1.5 flex items-center gap-1">
                {isNote && <Button variant="ghost" size="sm" onClick={() => setIsNote(false)}>Cancel Note</Button>}
                <Button 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={handleSend}
                    disabled={!messageText.trim() || isSending}
                >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
            if (!conversation) return;
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
          contact={contact as any} 
          conversation={conversation}
          onEscalate={onEscalate}
          activeHub={activeHub}
          allHubs={allHubs}
          escalationRules={escalationRules}
          projects={projects}
          allTasks={allTasks}
          onTaskSelect={onTaskSelect}
        />
      )}
    </>
  );
}
