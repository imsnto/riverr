
'use client';
import React, { useState, useEffect } from 'react';
import { Contact, ContactEvent } from '@/lib/contacts-types';
import { User } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AtSign, Edit, Phone, Tag, MoreHorizontal, MessageSquare, Mail, PlusCircle, Copy, ArrowLeft, Users2 } from 'lucide-react';
import TimelineFeed from './timeline-feed';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Textarea } from '@/components/ui/textarea';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getInitials } from '@/lib/utils';

interface ContactDetailProps {
  contact: Contact | null;
  onBack?: () => void;
  allUsers: User[];
  appUser: User | null;
}

export default function ContactDetail({ contact, onBack, allUsers, appUser }: ContactDetailProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  useEffect(() => {
    if (contact) {
      db.getContactEvents(contact.id).then(setEvents);
    } else {
      setEvents([]);
    }
  }, [contact]);

  const handleCopy = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: text,
      });
    }
  };
  
  const handleMessage = () => {
    toast({ title: "Feature not available", description: "Messaging integration is coming soon." });
  };
  
  const handleCall = () => {
      toast({ title: "Feature not available", description: "Calling integration is coming soon." });
  };
  
  const handleEmail = () => {
      if (contact?.primaryEmail) {
          window.location.href = `mailto:${contact.primaryEmail}`;
      } else {
          toast({ variant: 'destructive', title: "No email address", description: "This contact doesn't have an email address." });
      }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !contact || !appUser) return;

    const eventData: Omit<ContactEvent, 'id'> = {
        type: 'note',
        timestamp: new Date(),
        summary: noteContent,
        ref: { contactId: contact.id, createdBy: appUser.id },
    };

    const newEvent = await db.addContactEvent(contact.id, eventData);

    setEvents(prev => [newEvent, ...prev]);
    setNoteContent('');
    setIsAddingNote(false);

    toast({ title: 'Note Added' });
  };
  
  const handleDeleteNote = async (eventId: string) => {
    if (!contact) return;
    await db.deleteContactEvent(contact.id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    toast({ title: 'Note deleted' });
  };
  
  const handleOpenConversation = (conversationId: string) => {
      // In a real app this would navigate to the inbox view with the conversation selected.
      toast({ title: "Action not yet implemented", description: "Navigating to conversations is coming soon." });
  }


  if (!contact) {
    return (
      <div className="hidden h-full flex-col items-center justify-center bg-background md:flex p-12 text-center">
        <div className="max-w-sm space-y-6">
            <div className="mx-auto w-24 h-24 rounded-full bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center">
                <Users2 className="h-10 w-10 text-primary/40" />
            </div>
            <div>
                <h3 className="text-xl font-bold tracking-tight">Select a contact</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Choose a customer or lead from the list to view their full profile, timeline, and communication history.
                </p>
            </div>
            <div className="pt-4 flex flex-col gap-2">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">Pro Tip</p>
                <p className="text-xs text-muted-foreground/70">Use the search bar to find contacts by name, email, or company.</p>
            </div>
        </div>
      </div>
    );
  }

  const contactInfoContent = (
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
  );

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 md:p-6 border-b shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 md:gap-4">
              {isMobile && onBack && (
                <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <Avatar className="h-12 w-12 md:h-16 md:w-16">
                  <AvatarFallback className="text-2xl">{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                      {contact.name || 'Unknown Contact'}
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-4 w-4"/></Button>
                  </h2>
                  <p className="text-muted-foreground">{contact.company}</p>
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

        <div className="mt-4">
            {isAddingNote ? (
                <div className="space-y-2">
                    <Textarea
                        placeholder="Add a note about this contact..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={3}
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNote}>Save Note</Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsAddingNote(false)}>Cancel</Button>
                    </div>
                </div>
            ) : isMobile ? (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 flex-1" onClick={handleMessage}><MessageSquare className="h-3 w-3 mr-1.5" /> Message</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="outline" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleCall}><Phone className="mr-2 h-4 w-4"/> Call</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleEmail}><Mail className="mr-2 h-4 w-4"/> Email</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsAddingNote(true)}><PlusCircle className="mr-2 h-4 w-4"/> Add Note</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7" onClick={handleMessage}><MessageSquare className="h-3 w-3 mr-1.5" /> Message</Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={handleCall}><Phone className="h-3 w-3 mr-1.5" /> Call</Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={handleEmail}><Mail className="h-3 w-3 mr-1.5" /> Email</Button>
                    <Button variant="outline" size="sm" className="h-7" onClick={() => setIsAddingNote(true)}><PlusCircle className="h-3 w-3 mr-1.5" /> Add Note</Button>
                </div>
            )}
        </div>
      </div>


      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          <TimelineFeed 
            contactId={contact.id} 
            events={events} 
            allUsers={allUsers} 
            appUser={appUser} 
            onDeleteNote={handleDeleteNote}
            onOpenConversation={handleOpenConversation}
          />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t bg-card shrink-0 md:hidden">
        <Button variant="outline" className="w-full" onClick={() => setIsSheetOpen(true)}>View Details</Button>
      </div>

      <div className="hidden p-4 md:p-6 border-t bg-card shrink-0 md:block">
          {contactInfoContent}
      </div>
    </div>
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-lg">
            <SheetHeader className="text-left">
                <SheetTitle>Contact Details</SheetTitle>
            </SheetHeader>
            <div className="py-4">
                {contactInfoContent}
            </div>
        </SheetContent>
    </Sheet>
    </>
  );
}
