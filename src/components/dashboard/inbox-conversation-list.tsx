

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
import { SidebarTrigger } from '../ui/sidebar';

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
        console.log({ convo, contact, appUser })
        return (
          <div
            key={convo.id}
            onClick={() => onSelectConversation(convo.id)}
            className={cn(
              "p-4 cursor-pointer border-b !border-b-[#7c808375]",
              isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-gray/50'
            )}
          >
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                  <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <p
                className={cn(
                  "font-semibold truncate pl-1 text-sm",
                  isSelected ? 'text-primary' : ''
                )}
                >{contact.name}</p>
              </div>
              <p
              className={cn(
                "text-xs text-muted-foreground whitespace-nowrap pl-2",
                isSelected ? 'text-white' : ''
              )}
              >
                {format(new Date(convo.lastMessageAt), "d MMM")}
              </p>
            </div>
            <div className="mt-4 overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[13px] flex items-center space-x-2 text-muted-foreground truncate">
                    {youReplied &&
                      (
                        <>
                          {
                            appUser.avatarUrl ? (
                              <Avatar className="h-[1.1rem] w-[1.1rem]">
                                <AvatarImage src={appUser.avatarUrl} alt={appUser.name} />
                                <AvatarFallback>{getInitials(appUser.name)}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="font-semibold">You: </span>
                            )
                          }
                        </>
                      )
                    }
                    <p className='font-medium truncate w-[260px]'>{convo.lastMessage}</p>
                  </div>
                </div>
              </div>
              {/* <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{contact.location}</span>
                </div> */}
            </div>
          </div>
        );
      })}
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Header */}
      <div className="p-4 border-b shrink-0 flex items-center justify-between">
        <SidebarTrigger className="md:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h2 className="text-lg font-semibold">All incoming</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 12H17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M10 18H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      {conversationListContent}
    </div>
  );
}
