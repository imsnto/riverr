
'use client';

import React, { useState } from 'react';
import { Conversation, ChatContact, ChatMessage, User } from '@/lib/data';
import InboxConversationList from './inbox-conversation-list';
import InboxConversationView from './inbox-conversation-view';
import InboxContactPanel from './inbox-contact-panel';
import { cn } from '@/lib/utils';

// Move mock data here from dashboard.tsx
const initialContacts: ChatContact[] = [
    { id: 'contact-1', name: 'Stefanie Crisman', email: 'stefanie@virtucon.com', avatarUrl: 'https://i.pravatar.cc/150?u=stefanie', companyName: 'Virtucon', location: 'Dublin, Ireland', lastSeen: '1hr ago', sessions: 90, companyId: '141', companyUsers: 10, companyPlan: 'Dynamite+', companySpend: '$99.00' },
    { id: 'contact-2', name: 'Louise Tiernan', email: 'louise@virtucon.com', avatarUrl: 'https://i.pravatar.cc/150?u=louise', companyName: 'Virtucon', location: 'London, UK', lastSeen: '2hr ago', sessions: 12, companyId: '141', companyUsers: 10, companyPlan: 'Dynamite+', companySpend: '$99.00' },
    { id: 'contact-3', name: 'Gustavs Cirulis', email: 'gustavs@thatherton.com', avatarUrl: 'https://i.pravatar.cc/150?u=gustavs', companyName: 'ThathertonFuels.com', location: 'Riga, Latvia', lastSeen: '5hr ago', sessions: 25, companyId: '142', companyUsers: 5, companyPlan: 'Basic', companySpend: '$29.00' },
    { id: 'contact-4', name: 'Ignacio Delgado', email: 'ignacio@powell.com', avatarUrl: 'https://i.pravatar.cc/150?u=ignacio', companyName: 'Powell Motors', location: 'Madrid, Spain', lastSeen: '10hr ago', sessions: 45, companyId: '143', companyUsers: 22, companyPlan: 'Pro', companySpend: '$199.00' },
];

const initialConversations: Conversation[] = [
    { id: 'conv-1', contactId: 'contact-1', assigneeId: 'user-2', status: 'open', lastMessage: "Can you guys take a look? Thanks, Stefanie", lastMessageAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), lastMessageAuthor: 'Stefanie Crisman' },
    { id: 'conv-2', contactId: 'contact-2', assigneeId: 'user-1', status: 'open', lastMessage: "I know what is happening here, I will reply to Louise.", lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), lastMessageAuthor: 'Martin' },
    { id: 'conv-3', contactId: 'contact-3', assigneeId: null, status: 'unassigned', lastMessage: "Could I speak with one of your engineers? We can't update to version 3.0. I think we have the wrong...", lastMessageAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), lastMessageAuthor: 'Gustavs Cirulis' },
    { id: 'conv-4', contactId: 'contact-4', assigneeId: null, status: 'open', lastMessage: "Hey, It looks like you have a bug on the team page. All the icons are showing twice.", lastMessageAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), lastMessageAuthor: 'Ignacio Delgado' },
];

const initialMessages: ChatMessage[] = [
    { id: 'msg-1', conversationId: 'conv-1', authorId: 'contact-1', type: 'message', content: "Hi there, it looks like all of my files have disappeared. They were in my account yesterday, but today they're not there. Can you guys take a look? Thanks, Stefanie", timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-2', conversationId: 'conv-1', authorId: 'system', type: 'event', content: "You assigned this conversation to Sara Yin 8m ago", timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
    { id: 'msg-3', conversationId: 'conv-1', authorId: 'user-2', type: 'message', content: "Hi Stefanie,\n\nI'm sorry for the inconvenience. I'll have someone from our team get working on this now. We should have your files back to you shortly.", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    { id: 'msg-4', conversationId: 'conv-1', authorId: 'user-1', type: 'note', content: "Sara Yin can you take a look at this? Looks like Stefanie may have been affected by our database migration yesterday. Adam McCarthy might be able to help on the engineering side.", timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString() }
];

interface InboxLayoutProps {
  users: User[];
  appUser: User;
}

export default function InboxLayout({
  users,
  appUser,
}: InboxLayoutProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversations.length > 0 ? conversations[0].id : null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const selectedContact = selectedConversation ? contacts.find(c => c.id === selectedConversation.contactId) : null;
  
  const handleSendMessage = (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      conversationId: conversationId,
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    setConversations(prev => prev.map(convo => {
      if (convo.id === conversationId) {
        return {
          ...convo,
          lastMessage: message.content,
          lastMessageAt: message.timestamp,
          lastMessageAuthor: message.authorId === appUser.id ? appUser.name : 'Customer', // Simple author name
        }
      }
      return convo;
    }));
  };

  return (
    <div className={cn(
        "grid h-full",
        isContactPanelOpen ? "grid-cols-[350px_1fr_320px]" : "grid-cols-[350px_1fr]"
    )}>
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
        isContactPanelOpen={isContactPanelOpen}
        onToggleContactPanel={() => setIsContactPanelOpen(prev => !prev)}
        onSendMessage={handleSendMessage}
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
