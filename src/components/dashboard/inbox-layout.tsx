
'use client';

import React, { useState } from 'react';
import { Conversation, ChatContact, ChatMessage, User } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';

interface InboxLayoutProps {
  conversations: Conversation[];
  contacts: ChatContact[];
  messages: ChatMessage[];
  users: User[];
  appUser: User;
}

export default function InboxLayout({
  conversations,
  contacts,
  messages,
  users,
  appUser,
}: InboxLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversations.length > 0 ? conversations[0].id : null);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const selectedContact = selectedConversation ? contacts.find(c => c.id === selectedConversation.contactId) : null;

  return (
    <div className="grid grid-cols-[350px_1fr_320px] h-full">
      <InboxConversationList
        conversations={conversations}
        contacts={contacts}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
      />
      <InboxConversationView
        conversation={selectedConversation}
        messages={messages}
        contact={selectedContact}
        users={users}
        appUser={appUser}
      />
      <InboxContactPanel contact={selectedContact} />
    </div>
  );
}
