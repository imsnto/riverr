

'use client';

import React, { useState, useEffect } from 'react';
import { Conversation, Visitor, ChatMessage, User } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import ContactDetailDialog from './inbox-contact-dailog';

interface InboxLayoutProps {
  users: User[];
  appUser: User;
  visitors: Visitor[];
  conversations: Conversation[];
  messages: ChatMessage[];
  onSendMessage: (conversationId: string, content: string, type: 'reply' | 'note') => void;
  onAssignConversation: (conversationId: string, assigneeId: string | null) => void;
}

export default function InboxLayout({
  users,
  appUser,
  visitors,
  conversations,
  messages,
  onSendMessage,
  onAssignConversation,
}: InboxLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const [isContactDailog, setIsContactDailog] = useState(false);

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
  const selectedVisitor = selectedConversation ? visitors.find(c => c.id === selectedConversation.visitorId) : null;

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
          visitors={visitors}
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
        {
          selectedConversation ?
            <div className={cn("grid h-full grid-cols-[1fr]", isContactPanelOpen ? "xl:grid-cols-[1fr_380px]" : "grid-cols-[1fr]")}>
              <InboxConversationView
                conversation={selectedConversation}
                messages={messages}
                contact={selectedVisitor}
                users={users}
                appUser={appUser}
                isContactPanelOpen={isContactPanelOpen}
                onToggleContactPanel={() => setIsContactPanelOpen(prev => !prev)}
                onToggleContactDailog={() => setIsContactDailog(true)}
                onSendMessage={handleAgentSendMessage}
                onAssignConversation={onAssignConversation}
                onBack={() => setSelectedConversationId(null)}
              />
              {isContactPanelOpen && (
                <div className="hidden xl:block h-full">
                  <InboxContactPanel
                    visitor={selectedVisitor}
                    onToggle={() => setIsContactPanelOpen(false)}
                  />
                </div>
              )}
              <ContactDetailDialog
                visitor={selectedVisitor}
                open={isContactDailog}
                onOpenChange={setIsContactDailog}
              />
            </div> : <div className='flex justify-center items-center w-full h-screen'>Select or start a new conversation.</div>
        }
      </div>
    </div>
  );
}
