'use client';
import React, { useState } from 'react';
import { Contact } from '@/lib/contacts-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AtSign, Edit, Phone, Tag, MoreHorizontal, MessageSquare, Mail, PlusCircle, Copy } from 'lucide-react';
import TimelineFeed from './timeline-feed';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

interface ContactDetailProps {
  contact: Contact | null;
}

export default function ContactDetail({ contact }: ContactDetailProps) {
  const { toast } = useToast();

  const handleCopy = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: text,
      });
    }
  };

  if (!contact) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <div className="text-center">
          <AtSign className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Select a contact</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a contact from the list to see their details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-6 border-b flex items-start justify-between">
        <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
                <AvatarFallback className="text-2xl">{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    {contact.name || 'Unknown Contact'}
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-4 w-4"/></Button>
                </h2>
                <p className="text-muted-foreground">{contact.company}</p>
                 <div className="flex items-center gap-1 pt-1">
                    <Button variant="outline" size="sm" className="h-7"><MessageSquare className="h-3 w-3 mr-1.5" /> Message</Button>
                    <Button variant="outline" size="sm" className="h-7"><Phone className="h-3 w-3 mr-1.5" /> Call</Button>
                    <Button variant="outline" size="sm" className="h-7"><Mail className="h-3 w-3 mr-1.5" /> Email</Button>
                    <Button variant="outline" size="sm" className="h-7"><PlusCircle className="h-3 w-3 mr-1.5" /> Add Note</Button>
                </div>
            </div>
        </div>
        <div>
           <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem>Merge contact...</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timeline */}
            <div className="lg:col-span-2 space-y-6">
                <TimelineFeed contactId={contact.id} />
            </div>

            {/* Details Sidebar */}
            <div className="space-y-6">
                 <div>
                    <h4 className="font-semibold mb-2">Contact Info</h4>
                    <div className="space-y-2 text-sm">
                        {contact.primaryEmail && (
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2 truncate">
                                    <AtSign className="h-4 w-4 text-muted-foreground" />
                                    <span className="truncate">{contact.primaryEmail}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleCopy(contact.primaryEmail)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        {contact.primaryPhone && (
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{contact.primaryPhone}</span>
                                </div>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleCopy(contact.primaryPhone)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        {!contact.primaryEmail && !contact.primaryPhone && (
                             <p className="text-xs text-muted-foreground">No contact info provided.</p>
                        )}
                    </div>
                 </div>
                 <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                       {contact.tags.map(tag => (
                           <div key={tag} className="flex items-center text-sm bg-muted px-2 py-1 rounded-md">
                               <Tag className="h-3 w-3 mr-1.5" /> {tag}
                           </div>
                       ))}
                       <Button variant="outline" size="sm">Add tag</Button>
                    </div>
                 </div>
            </div>
        </div>
      </ScrollArea>
    </div>
  );
}
