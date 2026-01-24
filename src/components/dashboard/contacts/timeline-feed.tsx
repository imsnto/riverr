'use client';
import React, { useState } from 'react';
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TimelineFeedProps {
  contactId: string;
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


export default function TimelineFeed({ contactId }: TimelineFeedProps) {
  // Mock events for now
  const events: ContactEvent[] = [];
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  if (events.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-12 text-center">
        <h3 className="text-lg font-semibold">No activity yet</h3>
        <p className="text-sm text-muted-foreground">
          This contact's timeline is empty.
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
                    {filter.label}
                </Button>
            ))}
        </div>
        <div className="space-y-8">
            {events.map((event) => {
                const Icon = eventIcons[event.type] || StickyNote;
                return (
                <div key={event.id} className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm">{event.summary}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </p>
                    </div>
                </div>
                );
            })}
        </div>
    </div>
  );
}
