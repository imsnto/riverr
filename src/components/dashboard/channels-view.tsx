
'use client';

import React, { useState } from 'react';
import { Channel, Message, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { addMessage } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('');
};

interface ChannelsViewProps {
  channels: Channel[];
  messages: Message[];
  allUsers: User[];
  activeChannelId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export default function ChannelsView({ channels, messages, allUsers, activeChannelId, setMessages }: ChannelsViewProps) {
  const { appUser } = useAuth();
  const [newMessage, setNewMessage] = useState('');

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const channelMessages = messages.filter(m => m.channel_id === activeChannelId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannelId || !appUser) return;

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      channel_id: activeChannelId,
      user_id: appUser.id,
      content: newMessage,
      timestamp: new Date().toISOString(),
    }
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
        const savedMessage = await addMessage({
            channel_id: activeChannelId,
            user_id: appUser.id,
            content: newMessage,
            timestamp: new Date().toISOString(),
        });
        setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? savedMessage : m));
    } catch(err) {
        // Revert optimistic update on failure
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        setNewMessage(newMessage); // Restore user input
        // Optionally, show a toast notification for the error
    }
  };

  if (channels.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">No channels in this space.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {activeChannel ? (
        <>
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">#{activeChannel.name}</h3>
            <p className="text-sm text-muted-foreground">{activeChannel.description}</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {channelMessages.map(message => {
                const user = allUsers.find(u => u.id === message.user_id);
                return (
                  <div key={message.id} className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={user?.avatarUrl} />
                      <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-card">
            <form onSubmit={handleSendMessage} className="relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message #${activeChannel.name}`}
                className="pr-12"
              />
              <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Select a channel to start messaging
        </div>
      )}
    </div>
  );
}

    