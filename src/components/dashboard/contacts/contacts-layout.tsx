
'use client';

import React, { useState, useEffect } from 'react';
import { Contact } from '@/lib/contacts-types';
import { Space, User } from '@/lib/data';
import ContactsList from './contacts-list';
import ContactDetail from './contact-detail';
import CreateContactDialog from './create-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactsLayoutProps {
    activeSpace: Space | null;
    contacts?: Contact[];
}

export default function ContactsLayout({ activeSpace, contacts: propContacts }: ContactsLayoutProps) {
  const searchParams = useSearchParams();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { appUser } = useAuth();

  const [localContacts, setLocalContacts] = useState<Contact[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const displayContacts = propContacts || localContacts;

  useEffect(() => {
    if (activeSpace && !propContacts) {
      setIsLoading(true);
      Promise.all([
          db.getContacts(activeSpace.id),
          db.getAllUsers()
      ]).then(([fetchedContacts, fetchedUsers]) => {
        setLocalContacts(fetchedContacts);
        setAllUsers(fetchedUsers);
        setIsLoading(false);
      });
    } else if (activeSpace) {
        db.getAllUsers().then(fetchedUsers => {
            setAllUsers(fetchedUsers);
            setIsLoading(false);
        });
    }
  }, [activeSpace, propContacts]);

  useEffect(() => {
    const contactIdFromUrl = searchParams.get('contactId');
    if (contactIdFromUrl && displayContacts.length > 0) {
      const contactToSelect = displayContacts.find(c => c.id === contactIdFromUrl);
      if (contactToSelect) {
        setSelectedContact(contactToSelect);
      }
    }
  }, [searchParams, displayContacts]);

  const handleNewContact = () => {
      setIsCreateDialogOpen(true);
  };
  
  const handleSaveContact = async (values: { name?: string; company?: string; email?: string; phone?: string; }) => {
    if (!activeSpace || !appUser) return;
    
    const now = new Date();
    const newContactData: Omit<Contact, 'id'> = {
        spaceId: activeSpace.id,
        name: values.name || null,
        company: values.company || null,
        emails: values.email ? [values.email.toLowerCase()] : [],
        phones: values.phone ? [values.phone] : [],
        primaryEmail: values.email ? values.email.toLowerCase() : null,
        primaryPhone: values.phone || null,
        source: 'manual',
        externalIds: {},
        tags: [],
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        lastMessageAt: null,
        lastOrderAt: null,
        lastCallAt: null,
        mergeParentId: null,
        isMerged: false,
    };
    
    const newContact = await db.addContact(newContactData);
    
    await db.addContactEvent(newContact.id, {
        type: 'identity_added',
        summary: `Contact created manually by ${appUser.name}.`,
        timestamp: new Date(),
        ref: { createdBy: appUser.id },
    });

    if (!propContacts) {
        setLocalContacts(prev => [newContact, ...prev]);
    }
    setSelectedContact(newContact);
    
    toast({
        title: "Contact Created",
        description: `${values.name || 'New contact'} has been added.`,
    });
  };

  if (isLoading) {
    return (
        <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr]">
            <div className="flex flex-col h-full border-r bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-8" />
                </div>
                <Skeleton className="h-9 w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </div>
            <div className="hidden md:flex flex-col h-full bg-background p-8 space-y-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-7 w-24" />
                </div>
                <div className="pt-6 space-y-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-full overflow-hidden">
        {!selectedContact ? (
          <ContactsList
            contacts={displayContacts}
            selectedContact={null}
            onSelectContact={setSelectedContact}
            onNewContact={handleNewContact}
          />
        ) : (
          <ContactDetail
            contact={selectedContact}
            onBack={() => setSelectedContact(null)}
            allUsers={allUsers}
            appUser={appUser}
          />
        )}
        <CreateContactDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSave={handleSaveContact}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr]">
      <ContactsList
        contacts={displayContacts}
        selectedContact={selectedContact}
        onSelectContact={setSelectedContact}
        onNewContact={handleNewContact}
      />
      <ContactDetail contact={selectedContact} allUsers={allUsers} appUser={appUser}/>
      
      <CreateContactDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveContact}
      />
    </div>
  );
}
