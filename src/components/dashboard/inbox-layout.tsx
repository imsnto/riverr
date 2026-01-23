

'use client';

import React, { useState, useEffect } from 'react';
import { Conversation, ChatContact, ChatMessage, User } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface InboxLayoutProps {
  users: User[];
  appUser: User;
  contacts: ChatContact[];
  conversations: Conversation[];
  messages: ChatMessage[];
  onSendMessage: (conversationId: string, content: string, type: 'reply' | 'note') => void;
  onAssignConversation: (conversationId: string, assigneeId: string | null) => void;
}

export default function InboxLayout({
  users,
  appUser,
  contacts,
  conversations,
  messages,
  onSendMessage,
  onAssignConversation,
}: InboxLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);

  useEffect(() => {
    // On desktop, select the first conversation by default
    if (window.innerWidth >= 768 && !selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [selectedConversationId, conversations]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
  };
  
  const handleAgentSendMessage = (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => {
    onSendMessage(conversationId, message.content, message.type as 'reply' | 'note');
  };
  
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const selectedContact = selectedConversation ? contacts.find(c => c.id === selectedConversation.contactId) : null;

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
      {/* Conversation List - Always rendered, hidden on mobile when a convo is selected */}
      <div
        className={cn(
          "h-full flex-col border-r bg-card",
          selectedConversationId ? 'hidden md:flex' : 'flex'
        )}
      >
        <InboxConversationList
          conversations={conversations}
          contacts={contacts}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          appUser={appUser}
        />
      </div>

      {/* Conversation View & Contact Panel Wrapper */}
      <div
        className={cn(
          "h-full flex-col",
          !selectedConversationId ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className={cn("grid h-full grid-cols-[1fr]", isContactPanelOpen ? "lg:grid-cols-[1fr_380px]" : "grid-cols-[1fr]")}>
            <InboxConversationView
                conversation={selectedConversation}
                messages={messages}
                contact={selectedContact}
                users={users}
                appUser={appUser}
                isContactPanelOpen={isContactPanelOpen}
                onToggleContactPanel={() => setIsContactPanelOpen(prev => !prev)}
                onSendMessage={handleAgentSendMessage}
                onAssignConversation={onAssignConversation}
                onBack={() => setSelectedConversationId(null)}
            />
            {isContactPanelOpen && (
                <div className="hidden lg:block h-full">
                    <InboxContactPanel 
                        contact={selectedContact} 
                        onToggle={() => setIsContactPanelOpen(false)}
                    />
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
