

'use client';

import React, { useState, useRef } from 'react';
import { Message, User, Channel, Attachment } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { Command } from '../ui/command';
import { Send, Paperclip, File, ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

const renderMessageContent = (content: string, allUsers: User[]) => {
    const parts = content.split(/(@[\w\s]+)/g).filter(Boolean);
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            const userName = part.substring(1).trim();
            const user = allUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
            if (user) {
                return <strong key={index} className="text-blue-500 dark:text-blue-400">@{user.name}</strong>;
            }
        }
        return part;
    });
}

const renderSingleMessage = (message: Message, allUsers: User[]) => {
    const user = allUsers.find(u => u.id === message.user_id);
    return (
         <div key={message.id} className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                {message.content && <p className="text-sm">{renderMessageContent(message.content, allUsers)}</p>}
                 {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {message.attachments.map(att => (
                            <div key={att.id}>
                                {att.type === 'image' ? (
                                    <img src={att.url} alt={att.name} className="rounded-lg max-w-xs max-h-64 object-cover" />
                                ) : (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline bg-primary/10 p-2 rounded-md max-w-xs">
                                        <File className="h-4 w-4" />
                                        <span className="truncate">{att.name}</span>
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ReplyComposer({ thread, onAddMessage, allUsers, channels }: { thread: Message, onAddMessage: (message: Omit<Message, 'id'>) => Promise<void>, allUsers: User[], channels: Channel[] }) {
    const { appUser } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isTagging, setIsTagging] = useState(false);
    const [tagQuery, setTagQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);
    
    const activeChannel = channels.find(c => c.id === thread.channel_id);
    const channelMembers = activeChannel ? allUsers.filter(u => activeChannel.members.includes(u.id)) : [];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessage(value);
        const lastAt = value.lastIndexOf('@');
        if (lastAt !== -1 && !value.slice(lastAt + 1).includes(' ')) {
            setIsTagging(true);
            setTagQuery(value.slice(lastAt + 1));
        } else {
            setIsTagging(false);
        }
    };

    const handleUserTag = (userName: string) => {
        const lastAt = newMessage.lastIndexOf('@');
        setNewMessage(newMessage.slice(0, lastAt) + `@${userName} `);
        setIsTagging(false);
        messageInputRef.current?.focus();
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && attachments.length === 0) || !appUser) return;

        const newAttachments: Attachment[] = attachments.map(file => ({
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'file',
        }));

        const messageData: Omit<Message, 'id'> = {
            channel_id: thread.channel_id,
            user_id: appUser.id,
            content: newMessage,
            timestamp: new Date().toISOString(),
            attachments: newAttachments,
            thread_id: thread.id,
            reactions: [],
        };
        
        setNewMessage('');
        setAttachments([]);
        setIsTagging(false);
        await onAddMessage(messageData);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };

    const filteredMembers = channelMembers.filter(member => 
        member.name.toLowerCase().includes(tagQuery.toLowerCase()) && member.id !== appUser?.id
    );

    return (
        <div className="pl-6 ml-4 border-l-2 pt-2">
            {attachments.length > 0 && (
                <div className="mb-2 space-y-2">
                    {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded-md">
                        <div className="flex items-center gap-2 overflow-hidden">
                            {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 flex-shrink-0" /> : <File className="h-4 w-4 flex-shrink-0" />}
                            <span className="truncate">{file.name}</span>
                        </div>
                        <Button
                            variant="ghost" size="sm"
                            onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}
                        > &times; </Button>
                    </div>
                    ))}
                </div>
            )}
            <Popover open={isTagging} onOpenChange={setIsTagging}>
                <form onSubmit={handleSendMessage} className="relative">
                    <PopoverAnchor asChild>
                        <Input
                            ref={messageInputRef}
                            value={newMessage}
                            onChange={handleInputChange}
                            placeholder="Reply..."
                            className="h-9 pr-20"
                            autoComplete="off"
                        />
                    </PopoverAnchor>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
                        <Button type="submit" size="icon" className="h-8 w-8"><Send className="h-4 w-4" /></Button>
                    </div>
                </form>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                        <ScrollArea className="max-h-48">
                            {filteredMembers.length > 0 ? filteredMembers.map(member => (
                                <div key={member.id} onClick={() => handleUserTag(member.name)} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent">
                                    <Avatar className="h-6 w-6"><AvatarImage src={member.avatarUrl} /><AvatarFallback>{getInitials(member.name)}</AvatarFallback></Avatar>
                                    <span className="text-sm">{member.name}</span>
                                </div>
                            )) : <div className="p-2 text-sm text-center text-muted-foreground">No users found</div>}
                        </ScrollArea>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}


interface AllThreadsViewProps {
  messages: Message[];
  allUsers: User[];
  appUser: User | null;
  onViewThread: (thread: Message) => void;
  isThreadUnread: (thread: Message) => boolean;
  onAddMessage: (message: Omit<Message, 'id'>) => Promise<void>;
  channels: Channel[];
}

export default function AllThreadsView({ messages, allUsers, appUser, onViewThread, isThreadUnread, onAddMessage, channels }: AllThreadsViewProps) {
    if (!appUser) return null;

    const parentMessagesWithReplies = messages.filter(m => m.reply_count && m.reply_count > 0);
    const userInvolvedThreads = parentMessagesWithReplies.filter(parent => {
        const threadMessages = messages.filter(m => m.thread_id === parent.id);
        const participants = new Set([parent.user_id, ...threadMessages.map(m => m.user_id)]);
        return participants.has(appUser.id);
    });

    const sortedThreads = userInvolvedThreads.sort((a,b) => {
        const lastReplyA = messages.filter(m => m.thread_id === a.id).sort((x,y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0] || a;
        const lastReplyB = messages.filter(m => m.thread_id === b.id).sort((x,y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0] || b;
        return new Date(lastReplyB.timestamp).getTime() - new Date(lastReplyA.timestamp).getTime();
    })
    
    const firstUnreadIndex = sortedThreads.findIndex(isThreadUnread);

    if (sortedThreads.length === 0) {
        return <div className="flex h-full items-center justify-center text-muted-foreground">You have no threads yet.</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold">Threads</h3>
                <p className="text-sm text-muted-foreground">All your thread conversations in one place.</p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {sortedThreads.map((thread, index) => {
                         const threadReplies = messages.filter(m => m.thread_id === thread.id).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                         const unread = isThreadUnread(thread);
                         const showUnreadSeparator = index === firstUnreadIndex;


                         return (
                            <div key={thread.id}>
                                {showUnreadSeparator && (
                                     <div className="relative my-4 px-4">
                                        <Separator />
                                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                            <span className="bg-background px-2 text-xs text-primary font-semibold">Unread</span>
                                        </div>
                                    </div>
                                )}
                                <div className={cn("w-full text-left p-2 rounded-lg", unread && "bg-primary/5")}>
                                    <div className="space-y-4">
                                        {renderSingleMessage(thread, allUsers)}
                                        <div className="pl-6 border-l-2 ml-4 space-y-4">
                                            {threadReplies.map(reply => renderSingleMessage(reply, allUsers))}
                                        </div>
                                         <ReplyComposer 
                                            thread={thread}
                                            onAddMessage={onAddMessage}
                                            allUsers={allUsers}
                                            channels={channels}
                                         />
                                    </div>
                                </div>
                                <Separator className="my-2" />
                            </div>
                         )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
