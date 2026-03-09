
// src/components/dashboard/inbox-conversation-list.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Conversation, Visitor, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Search, MapPin, Bot, MessageSquare, Filter, Smartphone, User as UserIcon, Users } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { getInitials } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { updateUser } from '@/lib/db';

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
  const [inboxView, setInboxView] = useState<'team' | 'mine'>(appUser.preferences?.inboxView || 'team');

  const filteredConversations = useMemo(() => {
    // 1. Filter by ownership
    // Resilience: If ownerType is missing, it's a legacy hub conversation
    const viewBase = inboxView === 'mine' 
      ? conversations.filter(c => c.ownerAgentId === appUser.id)
      : conversations.filter(c => !c.ownerType || c.ownerType === 'hub');

    // 2. Apply inbox sub-filters (Team view only)
    if (inboxView === 'team') {
      switch (filter) {
        case 'me':
          return viewBase.filter(c => c.assigneeId === appUser.id);
        case 'unassigned':
          return viewBase.filter(c => c.assigneeId === null);
        case 'all':
        default:
          return viewBase;
      }
    }
    
    return viewBase;
  }, [conversations, filter, inboxView, appUser.id]);

  const counts = useMemo(() => ({
    me: conversations.filter(c => (!c.ownerType || c.ownerType === 'hub') && c.assigneeId === appUser.id).length,
    unassigned: conversations.filter(c => (!c.ownerType || c.ownerType === 'hub') && c.assigneeId === null).length,
    all: conversations.filter(c => !c.ownerType || c.ownerType === 'hub').length,
    mine: conversations.filter(c => c.ownerAgentId === appUser.id).length,
  }), [conversations, appUser.id]);

  const handleViewChange = async (view: 'team' | 'mine') => {
    setInboxView(view);
    await updateUser(appUser.id, { preferences: { ...appUser.preferences, inboxView: view } });
  };

  const conversationListContent = (
    <ScrollArea className="flex-1">
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm italic">
            {inboxView === 'mine' ? 'No personal conversations yet' : 'No team conversations found'}
          </p>
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
          
          const displayName = convo.visitorName || visitor?.name || convo.externalAddress || 'Visitor';
          
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
                  <div className="flex flex-col">
                    <p
                    className={cn(
                      "font-semibold truncate pl-1 text-sm",
                      isSelected ? 'text-primary' : '',
                      isUnread ? 'font-bold' : ''
                    )}
                    >{displayName}</p>
                    <div className="flex gap-1 pl-1">
                      {convo.channel === 'sms' && (
                        <Badge variant="outline" className="h-3 px-1 text-[8px] w-fit">SMS</Badge>
                      )}
                      {convo.channel === 'email' && (
                        <Badge variant="outline" className="h-3 px-1 text-[8px] w-fit">EMAIL</Badge>
                      )}
                    </div>
                  </div>
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
      <div className="p-4 border-b shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inbox</h2>
          {inboxView === 'team' && (
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
          )}
        </div>

        <Tabs value={inboxView} onValueChange={(v) => handleViewChange(v as 'team' | 'mine')}>
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="team" className="text-xs gap-2">
              <Users className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-xs gap-2">
              <UserIcon className="h-3.5 w-3.5" /> Mine
              {counts.mine > 0 && <Badge variant="secondary" className="h-4 px-1 ml-auto text-[10px]">{counts.mine}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {conversationListContent}
    </div>
  );
}
