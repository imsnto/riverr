'use client';

import React, { useState } from 'react';
import { Contact } from '@/lib/contacts-types';
import ContactsList from './contacts-list';
import ContactDetail from './contact-detail';
import { Space } from '@/lib/data';
import CreateContactDialog from './create-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface ContactsLayoutProps {
    activeSpace: Space | null;
}

export default function ContactsLayout({ activeSpace }: ContactsLayoutProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Mock data for now
  const [contacts, setContacts] = useState<Contact[]>([]); 

  const handleNewContact = () => {
      setIsCreateDialogOpen(true);
  };
  
  const handleSaveContact = (values: { name?: string; company?: string; email?: string; phone?: string; }) => {
    // This is where you would call a db function to create the contact
    // For now, we'll just add it to the local state and show a toast
    const newContact: Contact = {
        id: `contact_${Date.now()}`,
        tenantId: activeSpace?.id || 'tenant-1',
        name: values.name || null,
        company: values.company || null,
        emails: values.email ? [values.email.toLowerCase()] : [],
        phones: values.phone ? [values.phone] : [],
        primaryEmail: values.email ? values.email.toLowerCase() : null,
        primaryPhone: values.phone || null,
        source: 'manual',
        externalIds: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        lastMessageAt: null,
        lastOrderAt: null,
        lastCallAt: null,
        mergeParentId: null,
        isMerged: false,
    };
    
    setContacts(prev => [newContact, ...prev]);
    setSelectedContact(newContact); // select the newly created contact
    
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
