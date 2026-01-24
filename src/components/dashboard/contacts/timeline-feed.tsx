'use client';
import React, { useState, useMemo } from 'react';
import { ContactEvent, ContactEventType } from '@/lib/contacts-types';
import {
  MessageSquare,
  ShoppingCart,
  Phone,
  StickyNote,
  UserPlus,
  GitMerge,
  PhoneMissed,
  Voicemail,
  PhoneOutgoing,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User } from '@/lib/data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TimelineFeedProps {
  contactId: string;
  events?: ContactEvent[];
  allUsers: User[];
  appUser: User | null;
}

type FilterType = 'all' | 'messages' | 'orders' | 'calls' | 'notes';

const FILTERS: { key: FilterType, label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'messages', label: 'Messages' },
    { key: 'orders', label: 'Orders' },
    { key: 'calls', label: 'Calls' },
    { key: 'notes', label: 'Notes' },
]

const eventIcons: Record<ContactEventType, React.ElementType> = {
  chat_started: MessageSquare,
  chat_message: MessageSquare,
  order_created: ShoppingCart,
  call_started: Phone,
  call_missed: PhoneMissed,
  call_completed: PhoneOutgoing,
  voicemail_received: Voicemail,
  note: StickyNote,
  identity_added: UserPlus,
  contact_merged: GitMerge,
};

const getDateFromTimestamp = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date(); // Or handle as an invalid date
  }
  if (typeof timestamp.toDate === 'function') {
    // Firestore Timestamp
    return timestamp.toDate();
  }
  // JS Date object, ISO string, etc.
  return new Date(timestamp);
};


const DateSeparator = ({ date }: { date: string }) => (
    <div className="relative py-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs font-medium text-muted-foreground">{date}</span>
        </div>
    </div>
);

const TimelineEventRow = ({ event, allUsers, appUser }: { event: ContactEvent, allUsers: User[], appUser: User | null }) => {
    const Icon = eventIcons[event.type] || StickyNote;
    const canView = event.ref.conversationId || event.ref.callId;
    const createdByAgent = event.ref?.createdBy && event.ref.createdBy === appUser?.id;

    return (
        <div className="relative flex items-start gap-4 group py-2">
            <div className="absolute left-[-22px] top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-border">
                 <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 rounded-md p-3 transition-colors hover:bg-muted/50">
                <div className="flex justify-between items-start">
                    <div className="text-sm space-y-1">
                        <p>{event.summary}</p>
                        {event.type.startsWith('chat_') && (
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Badge variant="outline">{createdByAgent ? `From: ${appUser?.name}` : `From: Contact`}</Badge>
                                <Badge variant="secondary">Widget</Badge>
                            </div>
                        )}
                    </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {canView && <Button variant="ghost" size="sm" className="h-7 px-2">View</Button>}
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem>Action 1</DropdownMenuItem>
                                <DropdownMenuItem>Action 2</DropdownMenuItem>
                            </DropdownMenuContent>
                         </DropdownMenu>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(getDateFromTimestamp(event.timestamp), { addSuffix: true })}
                </p>
            </div>
        </div>
    );
};


export default function TimelineFeed({ contactId, events = [], allUsers, appUser }: TimelineFeedProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  const eventCounts = useMemo(() => {
    return {
        all: events.length,
        messages: events.filter(e => e.type.startsWith('chat_')).length,
        orders: events.filter(e => e.type === 'order_created').length,
        calls: events.filter(e => e.type.startsWith('call_')).length,
        notes: events.filter(e => e.type === 'note').length
    }
  }, [events]);

  const groupedEvents = useMemo(() => {
    const filtered = events.filter(event => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'messages') return event.type.startsWith('chat_');
      if (activeFilter === 'orders') return event.type === 'order_created';
      if (activeFilter === 'calls') return event.type.startsWith('call_');
      if (activeFilter === 'notes') return event.type === 'note';
      return false;
    });

    return filtered.reduce((acc, event) => {
        const date = getDateFromTimestamp(event.timestamp);
        let dateKey: string;
        if (isToday(date)) {
            dateKey = 'Today';
        } else if (isYesterday(date)) {
            dateKey = 'Yesterday';
        } else {
            dateKey = format(date, 'MMMM d, yyyy');
        }

        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(event);
        return acc;
    }, {} as Record<string, ContactEvent[]>);
  }, [events, activeFilter]);

  if (events.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <h3 className="text-lg font-semibold">No activity yet</h3>
        <p className="text-sm text-muted-foreground">
          This contact's timeline is empty. Notes and events will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-2">
            {FILTERS.map(filter => (
                <Button 
                    key={filter.key} 
                    variant={activeFilter === filter.key ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveFilter(filter.key)}
                >
                    {filter.label} {eventCounts[filter.key] > 0 && `(${eventCounts[filter.key]})`}
                </Button>
            ))}
        </div>
        <div className="relative pl-8">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                <div key={date} className="relative">
                    <DateSeparator date={date} />
                    <div className="space-y-0">
                         {dateEvents.map((event) => (
                            <TimelineEventRow key={event.id} event={event} allUsers={allUsers} appUser={appUser} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
