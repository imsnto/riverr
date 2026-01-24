'use client';

import React, { useState, useEffect } from 'react';
import { Contact } from '@/lib/contacts-types';
import ContactsList from './contacts-list';
import ContactDetail from './contact-detail';
import { Space } from '@/lib/data';
import CreateContactDialog from './create-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';

interface ContactsLayoutProps {
    activeSpace: Space | null;
}

export default function ContactsLayout({ activeSpace }: ContactsLayoutProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { appUser } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeSpace) {
      setIsLoading(true);
      db.getContacts(activeSpace.id).then(fetchedContacts => {
        setContacts(fetchedContacts);
        setIsLoading(false);
      });
    }
  }, [activeSpace]);

  const handleNewContact = () => {
      setIsCreateDialogOpen(true);
  };
  
  const handleSaveContact = async (values: { name?: string; company?: string; email?: string; phone?: string; }) => {
    if (!activeSpace || !appUser) return;
    
    const now = new Date();
    const newContactData: Omit<Contact, 'id'> = {
        tenantId: activeSpace.id,
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

    setContacts(prev => [newContact, ...prev]);
    setSelectedContact(newContact);
    
    toast({
        title: "Contact Created",
        description: `${values.name || 'New contact'} has been added.`,
    });
  };

  if (isMobile) {
    return (
      <div className="h-full overflow-hidden">
        {!selectedContact ? (
          <ContactsList
            contacts={contacts}
            selectedContact={null}
            onSelectContact={setSelectedContact}
            onNewContact={handleNewContact}
          />
        ) : (
          <ContactDetail
            contact={selectedContact}
            onBack={() => setSelectedContact(null)}
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
    <div className="grid h-full grid-cols-1 md:grid-cols-[380px_1fr]">
      <ContactsList
        contacts={contacts}
        selectedContact={selectedContact}
        onSelectContact={setSelectedContact}
        onNewContact={handleNewContact}
      />
      <ContactDetail contact={selectedContact} />
      
      <CreateContactDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveContact}
      />
    </div>
  );
}
