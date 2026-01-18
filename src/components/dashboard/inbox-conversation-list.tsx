'use client';

import React, { useMemo, useState } from 'react';
import { Conversation, ChatContact, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Search, Menu, MapPin } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebar, SidebarTrigger } from '../ui/sidebar';

interface InboxSidebarProps {
  conversations: Conversation[];
  contacts: ChatContact[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  appUser: User;
}

const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


export default function InboxConversationList({
  conversations,
  contacts,
  selectedConversationId,
  onSelectConversation,
  appUser,
}: InboxSidebarProps) {
    const [filter, setFilter] = useState<'me' | 'unassigned' | 'all'>('all');
    const { toggleSidebar } = useSidebar();

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
        {filteredConversations.map(convo => {
          const contact = contacts.find(c => c.id === convo.contactId);
          if (!contact) return null;
          const isSelected = selectedConversationId === convo.id;
          const youReplied = convo.lastMessageAuthor === appUser.name;
          return (
            <div
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={cn(
                "flex items-start gap-4 p-4 cursor-pointer border-b",
                isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold truncate">{contact.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                           {youReplied && <span className="font-semibold">You: </span>}
                           {convo.lastMessage}
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap pl-2">
                        {format(new Date(convo.lastMessageAt), "d MMM yyyy")}
                    </p>
                </div>
                 <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{contact.location}</span>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full md:border-r bg-card">
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b shrink-0 flex items-center justify-between">
            <SidebarTrigger>
                <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <h2 className="text-lg font-semibold">All incoming</h2>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M6.5 12H17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M10 18H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setFilter('all')}>All ({counts.all})</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFilter('me')}>Me ({counts.me})</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFilter('unassigned')}>Unassigned ({counts.unassigned})</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block p-4 border-b shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>
                        All ({counts.all})
                    </Button>
                    <Button variant={filter === 'me' ? 'secondary' : 'ghost'} onClick={() => setFilter('me')}>
                        Me ({counts.me})
                    </Button>
                    <Button variant={filter === 'unassigned' ? 'secondary' : 'ghost'} onClick={() => setFilter('unassigned')}>
                        Unassigned ({counts.unassigned})
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-8 h-9 w-32" />
                </div>
            </div>
      </div>
      {conversationListContent}
    </div>
  );
}
