'use client';

import React from 'react';
import { Contact } from '@/lib/contacts-types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


interface ContactsListProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
}

export default function ContactsList({
  contacts,
  selectedContact,
  onSelectContact,
}: ContactsListProps) {
  return (
    <div className="flex flex-col h-full border-r bg-card">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Contacts</h2>
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
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelectContact(contact)}
            className={cn(
              "w-full text-left p-4 cursor-pointer border-b",
              selectedContact?.id === contact.id ? 'bg-muted' : 'hover:bg-muted/50'
            )}
          >
             <div className="flex items-center space-x-3">
                <Avatar>
                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold truncate">{contact.name || 'Unknown Contact'}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.primaryEmail || contact.primaryPhone}</p>
                </div>
            </div>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}
