
'use client';

import React, { useState, useEffect } from 'react';
import { Channel, Message, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { addMessage } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const getInitials = (name: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('');
};

const renderMessageContent = (content: string, allUsers: User[]) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            const userName = part.substring(1);
            const user = allUsers.find(u => u.name === userName);
            if (user) {
                return <strong key={index} className="bg-primary/20 text-primary px-1 rounded-sm">@{user.name}</strong>;
            }
        }
        return part;
    });
}

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
  const [isTagging, setIsTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState('');

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const channelMessages = messages.filter(m => m.channel_id === activeChannelId);
  const channelMembers = activeChannel ? allUsers.filter(u => activeChannel.members.includes(u.id)) : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    const lastAt = value.lastIndexOf('@');
    if (lastAt !== -1 && value.slice(lastAt + 1).match(/^\w*$/)) {
        setIsTagging(true);
        setTagQuery(value.slice(lastAt + 1));
    } else {
        setIsTagging(false);
    }
  }

  const handleUserTag = (userName: string) => {
    const lastAt = newMessage.lastIndexOf('@');
    setNewMessage(newMessage.slice(0, lastAt) + `@${userName} `);
    setIsTagging(false);
    document.getElementById('message-input')?.focus();
  }

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
    setIsTagging(false);

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

  const filteredMembers = channelMembers.filter(member => 
    member.name.toLowerCase().includes(tagQuery.toLowerCase()) && member.id !== appUser?.id
  );

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
                      <p className="text-sm">{renderMessageContent(message.content, allUsers)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-card">
            <Popover open={isTagging} onOpenChange={setIsTagging}>
                <PopoverTrigger asChild>
                    <form onSubmit={handleSendMessage} className="relative">
                      <Input
                        id="message-input"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder={`Message #${activeChannel.name}`}
                        className="pr-12"
                        autoComplete="off"
                      />
                      <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <ScrollArea className="max-h-48">
                            {filteredMembers.length > 0 ? filteredMembers.map(member => (
                                <div key={member.id} 
                                    onClick={() => handleUserTag(member.name)}
                                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent"
                                >
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={member.avatarUrl} />
                                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{member.name}</span>
                                </div>
                            )) : (
                                <div className="p-2 text-sm text-center text-muted-foreground">No users found</div>
                            )}
                        </ScrollArea>
                    </Command>
                </PopoverContent>
            </Popover>
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
