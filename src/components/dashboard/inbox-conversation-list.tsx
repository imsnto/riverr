
'use client';

import React, { useMemo, useState } from 'react';
import { Conversation, ChatContact, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ChevronDown, Calendar, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

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
    const [filter, setFilter] = useState<'me' | 'unassigned' | 'all'>('unassigned');

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

  return (
    <div className="flex flex-col h-full border-r bg-card">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Button variant={filter === 'me' ? 'secondary' : 'ghost'} onClick={() => setFilter('me')}>
                    Me ({counts.me})
                </Button>
                <Button variant={filter === 'unassigned' ? 'secondary' : 'ghost'} onClick={() => setFilter('unassigned')}>
                    Unassigned ({counts.unassigned})
                </Button>
                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>
                    All ({counts.all})
                </Button>
            </div>
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-9 w-32" />
            </div>
        </div>
      </div>
      <div className="p-4 border-b flex justify-between items-center shrink-0">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">Open ({conversations.filter(c=>c.status === 'open' || c.status === 'unassigned').length}) <ChevronDown className="h-4 w-4 ml-1" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Snoozed</DropdownMenuItem>
                <DropdownMenuItem>Closed</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm"><Calendar className="h-4 w-4 mr-1" /> Date <ChevronDown className="h-4 w-4 ml-1" /></Button>
            </DropdownMenuTrigger>
             <DropdownMenuContent>
                <DropdownMenuItem>Newest</DropdownMenuItem>
                <DropdownMenuItem>Oldest</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea className="flex-1">
        {filteredConversations.map(convo => {
          const contact = contacts.find(c => c.id === convo.contactId);
          if (!contact) return null;
          const isSelected = selectedConversationId === convo.id;
          return (
            <div
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={cn(
                "flex items-start gap-3 p-3 cursor-pointer border-b",
                isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}
            >
              <Checkbox className="mt-1" />
              <Avatar className="h-8 w-8">
                <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <p className="font-semibold truncate text-sm">{contact.name}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: false })}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground truncate">{contact.companyName}</p>
                <p className="text-sm text-muted-foreground truncate mt-1">
                  <span className="font-medium text-foreground">{convo.lastMessageAuthor}:</span> {convo.lastMessage}
                </p>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
