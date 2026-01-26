
'use client';

import React, { useState, useEffect } from 'react';
import { Conversation, Visitor, ChatMessage, User, Hub, Space, EscalationIntakeRule, Project, Contact, Ticket } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import ContactDetailDialog from './inbox-contact-dailog';
import { useIsMobile } from '@/hooks/use-mobile';

interface InboxLayoutProps {
  users: User[];
  appUser: User;
  visitors: Visitor[];
  conversations: Conversation[];
  messages: ChatMessage[];
  onSendMessage: (conversationId: string, content: string, type: 'reply' | 'note') => void;
  onAssignConversation: (conversationId: string, assigneeId: string | null) => void;
  setHideMobileBottomNav?: (hide: boolean) => void;
  activeHub: Hub;
  activeSpace: Space;
  allHubs: Hub[];
  escalationRules: EscalationIntakeRule[];
  projects: Project[];
  contacts: Contact[];
  onDataRefresh: () => void;
  onCreateTicket: (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => void;
}

export default function InboxLayout({
  users,
  appUser,
  visitors,
  conversations,
  messages,
  onSendMessage,
  onAssignConversation,
  setHideMobileBottomNav,
  activeHub,
  activeSpace,
  allHubs,
  escalationRules,
  projects,
  contacts,
  onDataRefresh,
  onCreateTicket,
}: InboxLayoutProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const [isContactDailog, setIsContactDailog] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (setHideMobileBottomNav) {
      setHideMobileBottomNav(isMobile && !!selectedConversationId);
    }
  }, [isMobile, selectedConversationId, setHideMobileBottomNav]);

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
          "h-full flex-col border-r bg-card min-h-0",
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
          "h-full flex-col overflow-hidden min-h-0",
          !selectedConversationId ? 'hidden md:flex' : 'flex'
        )}
      >
        {
          selectedConversation ?
            <div className={cn("grid h-full min-h-0 grid-cols-[1fr]", isContactPanelOpen ? "xl:grid-cols-[1fr_380px]" : "grid-cols-[1fr]")}>
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
                activeHub={activeHub}
                activeSpace={activeSpace}
                allHubs={allHubs}
                escalationRules={escalationRules}
                projects={projects}
                contacts={contacts}
                onDataRefresh={onDataRefresh}
                onCreateTicket={onCreateTicket}
              />
              {isContactPanelOpen && (
                <div className="hidden xl:block h-full min-h-0">
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
            </div> : <div className='flex justify-center items-center w-full h-full'>Select or start a new conversation.</div>
        }
      </div>
    </div>
  );
}
