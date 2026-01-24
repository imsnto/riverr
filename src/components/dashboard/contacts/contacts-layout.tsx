'use client';

import React, { useState } from 'react';
import { Contact } from '@/lib/contacts-types';
import ContactsList from './contacts-list';
import ContactDetail from './contact-detail';
import { Space } from '@/lib/data';

interface ContactsLayoutProps {
    activeSpace: Space | null;
}

export default function ContactsLayout({ activeSpace }: ContactsLayoutProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Mock data for now
  const mockContacts: Contact[] = []; 

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[380px_1fr]">
      <ContactsList
        contacts={mockContacts}
        selectedContact={selectedContact}
        onSelectContact={setSelectedContact}
      />
      <ContactDetail contact={selectedContact} />
    </div>
  );
}
