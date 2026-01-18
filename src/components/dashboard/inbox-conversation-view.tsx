'use client';

import React, { useState } from 'react';
import { Conversation, ChatMessage, ChatContact, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { PanelLeftClose, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface InboxConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  contact: ChatContact | null;
  users: User[];
  appUser: User;
  isContactPanelOpen: boolean;
  onToggleContactPanel: () => void;
  onSendMessage: (conversationId: string, message: Omit<ChatMessage, 'id' | 'conversationId'>) => void;
  onAssignConversation: (conversationId: string, assigneeId: string | null) => void;
  onBack?: () => void;
}

const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


export default function InboxConversationView({ conversation, messages, contact, users, appUser, isContactPanelOpen, onToggleContactPanel, onSendMessage, onAssignConversation, onBack }: InboxConversationViewProps) {
  const [activeTab, setActiveTab] = useState<'reply' | 'note'>('reply');
  const [messageText, setMessageText] = useState('');
  
  if (!conversation || !contact) {
    return (
      <div className="grid grid-rows-[auto_1fr_auto] h-full items-center justify-center p-4">
        <p className="text-muted-foreground">Select a conversation to start</p>
      </div>
    );
  }
  
  const handleSend = () => {
    if (!messageText.trim()) return;

    const newMessage: Omit<ChatMessage, 'id' | 'conversationId'> = {
      authorId: appUser.id,
      type: activeTab,
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    onSendMessage(conversation.id, newMessage);
    setMessageText('');
  }

  const handleAssign = (userId: string | null) => {
    onAssignConversation(conversation.id, userId);
  };

  const assignee = users.find(u => u.id === conversation.assigneeId);
  const conversationMessages = messages.filter(m => m.conversationId === conversation.id);

  const renderMessageBubble = (msg: ChatMessage) => {
    const isCustomer = msg.authorId === contact.id;
    const agent = isCustomer ? null : users.find(u => u.id === msg.authorId);
    
    if (msg.type === 'event') {
        return (
             <div key={msg.id} className="text-center text-xs text-muted-foreground my-4">
                <span>{msg.content}</span>
            </div>
        )
    }

    if (msg.type === 'note') {
        const noteAuthor = users.find(u => u.id === msg.authorId);
        return (
             <div key={msg.id} className="flex justify-center">
                 <Card className="w-full max-w-2xl bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 my-2">
                     <div className="p-3">
                         <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                           {noteAuthor?.name || 'A user'} added an internal note {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                         </p>
                         <p className="text-sm mt-1">{msg.content}</p>
                     </div>
                 </Card>
             </div>
        )
    }
    
    return (
      <div key={msg.id} className="flex items-start gap-4">
        <Avatar className="h-8 w-8">
            <AvatarImage src={isCustomer ? contact.avatarUrl : agent?.avatarUrl} />
            <AvatarFallback>{isCustomer ? getInitials(contact.name) : getInitials(agent?.name || '')}</AvatarFallback>
        </Avatar>
        <div className={cn("rounded-lg p-3 max-w-xl", isCustomer ? "bg-card" : "bg-primary text-primary-foreground")}>
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          <p className={cn("text-xs mt-1 opacity-70", isCustomer ? "" : "text-primary-foreground/70")}>
            Sent {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
            {onBack && (
                <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            )}
            <p className="text-sm">
                Conversation with <span className="font-semibold">{contact.name}</span>
                {assignee && <> assigned to <span className="font-semibold">{assignee.name}</span></>}
            </p>
        </div>
        {!isContactPanelOpen && (
            <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onToggleContactPanel}>
                <PanelLeftClose className="h-4 w-4" />
            </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-6">
            {conversationMessages.map(renderMessageBubble)}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="p-4 border-t bg-card flex-shrink-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'reply' | 'note')}>
            <TabsList>
                <TabsTrigger value="reply">Reply</TabsTrigger>
                <TabsTrigger value="note">Note</TabsTrigger>
            </TabsList>
            <TabsContent value="reply" className="mt-2">
                 <Textarea 
                    placeholder="Type your reply..." 
                    className="mb-2" 
                    minRows={3} 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                 />
            </TabsContent>
             <TabsContent value="note" className="mt-2">
                 <Textarea 
                    placeholder="Add an internal note..." 
                    className="mb-2 bg-amber-50 dark:bg-amber-950/50" 
                    minRows={3} 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)}
                     onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
            </TabsContent>
        </Tabs>
        <div className="flex justify-between items-center mt-2">
            <div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm">Assign</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => handleAssign(null)}>Unassigned</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {users.map(user => (
                            <DropdownMenuItem key={user.id} onSelect={() => handleAssign(user.id)}>
                                {user.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" size="sm">Close</Button>
                <Button onClick={handleSend} disabled={!messageText.trim()}>Send {activeTab === 'note' && ' Note'}</Button>
            </div>
        </div>
      </div>
    </div>
  );
}
