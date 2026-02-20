
// src/components/dashboard/inbox-conversation-list.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Conversation, Visitor, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Search, MapPin, Bot, MessageSquare, Filter } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { getInitials } from '@/lib/utils';

interface InboxSidebarProps {
  conversations: Conversation[];
  visitors: Visitor[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  appUser: User;
}

export default function InboxConversationList({
  conversations,
  visitors,
  selectedConversationId,
  onSelectConversation,
  appUser,
}: InboxSidebarProps) {
  const [filter, setFilter] = useState<'me' | 'unassigned' | 'all'>('all');

  const filteredConversations = useMemo(() => {
    switch (filter) {
      case 'me':
        return conversations.filter(c => c.assigneeId === appUser.id);
      case 'unassigned':
        return conversations.filter(c => c.assigneeId === null);
      case 'all':
      default:
        return conversations;
    }
  }, [conversations, filter, appUser.id]);

  const counts = useMemo(() => ({
    me: conversations.filter(c => c.assigneeId === appUser.id).length,
    unassigned: conversations.filter(c => c.assigneeId === null).length,
    all: conversations.length,
  }), [conversations, appUser.id]);

  const conversationListContent = (
    <ScrollArea className="flex-1">
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm italic">No conversations found</p>
        </div>
      ) : (
        filteredConversations.map(convo => {
          const visitor = visitors.find(c => c.id === convo.visitorId);
          const isSelected = selectedConversationId === convo.id;
          const isYou = convo.lastMessageAuthor === appUser.name;
          const isAI = convo.lastMessageAuthor === 'AI Agent';
          
          const lastSeen = convo.lastAgentSeenAtByAgent?.[appUser.id] ? new Date(convo.lastAgentSeenAtByAgent[appUser.id]).getTime() : 0;
          const lastMessageAt = new Date(convo.lastMessageAt).getTime();
          const isUnread = convo.lastMessageAuthor !== appUser.name && lastMessageAt > lastSeen;
          
          // Prefer cached conversation name for UI stability
          const displayName = convo.visitorName || visitor?.name || 'Visitor';
          
          return (
            <div
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={cn(
                "p-4 cursor-pointer border-b !border-b-border/50 transition-colors relative",
                isSelected ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-muted/30',
                isUnread && !isSelected ? "bg-primary/5" : ""
              )}
            >
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={visitor?.avatarUrl} alt={displayName} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <p
                  className={cn(
                    "font-semibold truncate pl-1 text-sm",
                    isSelected ? 'text-primary' : '',
                    isUnread ? 'font-bold' : ''
                  )}
                  >{displayName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground whitespace-nowrap pl-2">
                    {convo.lastMessageAt ? format(new Date(convo.lastMessageAt), "d MMM") : '---'}
                  </p>
                  {isUnread && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>
              
              <div className="mt-3 overflow-hidden">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isYou ? (
                    <span className="font-bold text-primary flex-shrink-0">You:</span>
                  ) : isAI ? (
                    <span className="font-bold text-indigo-400 flex-shrink-0 flex items-center gap-1">
                      <Bot className="h-3 w-3" /> AI:
                    </span>
                  ) : convo.lastMessageAuthor && convo.lastMessageAuthor !== displayName ? (
                    <span className={cn("font-bold flex-shrink-0", isUnread ? "text-foreground" : "")}>{convo.lastMessageAuthor}:</span>
                  ) : null}
                  
                  <p className={cn(
                    "truncate flex-1 font-medium",
                    isSelected ? "text-foreground" : "",
                    isUnread ? "text-foreground font-semibold" : ""
                  )}>
                    {convo.lastMessage || 'No messages'}
                  </p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Header */}
      <div className="p-4 border-b shrink-0 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setFilter('all')}>All ({counts.all})</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setFilter('me')}>Me ({counts.me})</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setFilter('unassigned')}>Unassigned ({counts.unassigned})</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {conversationListContent}
    </div>
  );
}
