
'use client';

import React, { useState } from 'react';
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversations.length > 0 ? conversations[0].id : null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const isMobile = useIsMobile();

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const selectedContact = selectedConversation ? contacts.find(c => c.id === selectedConversation.contactId) : null;
  
  const handleAgentSendMessage = (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => {
    onSendMessage(conversationId, message.content, message.type as 'reply' | 'note');
  };

  if (isMobile) {
    if (selectedConversationId && selectedConversation && selectedContact) {
        return (
            <div className="flex flex-col h-full">
                <div className="p-2 border-b">
                    <Button variant="ghost" onClick={() => setSelectedConversationId(null)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Inbox
                    </Button>
                </div>
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
                />
            </div>
        )
    }
    return (
        <InboxConversationList
            conversations={conversations}
            contacts={contacts}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            appUser={appUser}
        />
    )
  }

  return (
    <div className={cn(
        "grid h-full",
        isContactPanelOpen ? "grid-cols-[320px_1fr_320px]" : "grid-cols-[320px_1fr]"
    )}>
      <InboxConversationList
        conversations={conversations}
        contacts={contacts}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
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
