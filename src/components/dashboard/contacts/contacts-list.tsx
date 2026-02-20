
'use client';

import React from 'react';
import { Contact } from '@/lib/contacts-types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, MessageSquare, Phone, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/utils';

const getDateFromTimestamp = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date();
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};


interface ContactsListProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
  onNewContact: () => void;
}

export default function ContactsList({
  contacts,
  selectedContact,
  onSelectContact,
  onNewContact,
}: ContactsListProps) {
  return (
    <div className="flex flex-col h-full border-r bg-card">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Contacts</h2>
            <Button variant="ghost" size="icon" onClick={onNewContact}>
                <Plus className="h-5 w-5" />
            </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." className="pl-10 h-9" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {contacts.length === 0 && (
            <div className="text-center p-8">
                <p className="text-muted-foreground">No contacts found.</p>
            </div>
        )}
        <div className="divide-y divide-border/50">
            {contacts.map((contact) => {
                const isAnonymous = !contact.name && !contact.primaryEmail && !contact.primaryPhone;
                return (
                    <button
                        key={contact.id}
                        onClick={() => onSelectContact(contact)}
                        className={cn(
                        "w-full text-left px-3 py-2 cursor-pointer transition-colors",
                        selectedContact?.id === contact.id ? 'bg-primary/5' : 'hover:bg-muted/30'
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback className="text-[10px]">{getInitials(contact.name)}</AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden">
                                    <div className="font-semibold text-sm truncate flex items-center gap-2">
                                        {contact.name || 'Anonymous'}
                                        {isAnonymous && <Badge variant="outline" className="text-[9px] h-4 px-1">Anon</Badge>}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">{contact.primaryEmail || contact.primaryPhone || 'No contact info'}</p>
                                </div>
                            </div>
                            {contact.lastSeenAt && (
                                <p className="text-[9px] text-muted-foreground flex-shrink-0 ml-2 mt-0.5">
                                    {formatDistanceToNow(getDateFromTimestamp(contact.lastSeenAt), { addSuffix: false })}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden">
                            {contact.lastMessageAt && <MessageSquare className="h-3 w-3 text-primary/60" />}
                            {contact.lastOrderAt && <ShoppingCart className="h-3 w-3 text-green-500/60" />}
                            {contact.lastCallAt && <Phone className="h-3 w-3 text-blue-500/60" />}
                            {contact.tags.slice(0,1).map(tag => <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1 py-0">{tag}</Badge>)}
                        </div>
                    </button>
                )
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
