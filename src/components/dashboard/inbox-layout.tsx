'use client';

import React, { useState, useEffect } from 'react';
import { Conversation, ChatContact, ChatMessage, User } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';

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
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');

  useEffect(() => {
    if (isMobile) {
      // On mobile, if a convo is selected, show it. Otherwise show the list.
      setMobileView(selectedConversationId ? 'conversation' : 'list');
    }
  }, [isMobile, selectedConversationId]);

  useEffect(() => {
    // If not on mobile, and no conversation is selected, select the first one if available.
    if (!isMobile && !selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [isMobile, selectedConversationId, conversations]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
  };
  
  const handleAgentSendMessage = (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => {
    onSendMessage(conversationId, message.content, message.type as 'reply' | 'note');
  };
  
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const selectedContact = selectedConversation ? contacts.find(c => c.id === selectedConversation.contactId) : null;

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        {mobileView === 'list' ? (
          <InboxConversationList
            conversations={conversations}
            contacts={contacts}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            appUser={appUser}
          />
        ) : (
          <InboxConversationView
            conversation={selectedConversation}
            messages={messages}
            contact={selectedContact}
            users={users}
            appUser={appUser}
            isContactPanelOpen={false}
            onToggleContactPanel={() => {}}
            onSendMessage={handleAgentSendMessage}
            onAssignConversation={onAssignConversation}
            onBack={() => setMobileView('list')}
          />
        )}
      </div>
    );
  }

  // Desktop View
  return (
    <div className={cn(
        "grid h-full",
        isContactPanelOpen ? "grid-cols-[320px_1fr_320px]" : "grid-cols-[320px_1fr]"
    )}>
      <InboxConversationList
        conversations={conversations}
        contacts={contacts}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        appUser={appUser}
      />
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
      />
      {isContactPanelOpen && (
        <InboxContactPanel 
          contact={selectedContact} 
          onToggle={() => setIsContactPanelOpen(false)}
        />
      )}
    </div>
  );
}
