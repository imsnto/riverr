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


const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

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
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Contacts</h2>
            <Button variant="ghost" size="icon" onClick={onNewContact}>
                <Plus className="h-5 w-5" />
            </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." className="pl-10" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {contacts.length === 0 && (
            <div className="text-center p-8">
                <p className="text-muted-foreground">No contacts found.</p>
            </div>
        )}
        {contacts.map((contact) => {
            const isAnonymous = !contact.name && !contact.primaryEmail && !contact.primaryPhone;
            return (
                <button
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className={cn(
                    "w-full text-left p-4 cursor-pointer border-b",
                    selectedContact?.id === contact.id ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <Avatar>
                                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden">
                                <p className="font-semibold truncate flex items-center gap-2">
                                    {contact.name || 'Anonymous'}
                                    {isAnonymous && <Badge variant="outline">Anonymous</Badge>}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">{contact.primaryEmail || contact.primaryPhone}</p>
                            </div>
                        </div>
                        {contact.lastSeenAt && (
                             <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                {formatDistanceToNow(getDateFromTimestamp(contact.lastSeenAt), { addSuffix: true })}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        {contact.lastMessageAt && <Badge variant="secondary"><MessageSquare className="h-3 w-3 mr-1.5" />Chat</Badge>}
                        {contact.lastOrderAt && <Badge variant="secondary"><ShoppingCart className="h-3 w-3 mr-1.5" />Order</Badge>}
                        {contact.lastCallAt && <Badge variant="secondary"><Phone className="h-3 w-3 mr-1.5" />Call</Badge>}
                        {contact.tags.slice(0,2).map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    </div>
                </button>
            )
        })}
      </ScrollArea>
    </div>
  );
}
