
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message, User, Attachment } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Send, X, Paperclip, File, ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

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

interface ThreadViewProps {
    thread: Message;
    messages: Message[];
    allUsers: User[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    onClose: () => void;
    onAddMessage: (message: Omit<Message, 'id'>) => Promise<void>;
}

export default function ThreadView({ thread, messages, allUsers, setMessages, onClose, onAddMessage }: ThreadViewProps) {
    const { appUser } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const threadMessages = [thread, ...messages.filter(m => m.thread_id === thread.id)];
    const threadUser = allUsers.find(u => u.id === thread.user_id);

    useEffect(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo(0, scrollAreaRef.current.scrollHeight);
        }
    }, [messages, thread.id]);
    

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
        
        await onAddMessage(messageData);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const renderSingleMessage = (message: Message) => {
        const user = allUsers.find(u => u.id === message.user_id);
        return (
             <div key={message.id} className="flex items-start gap-3 p-2 rounded-md">
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

    return (
        <div className="flex flex-col h-full bg-card">
            <div className="p-4 border-b flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Thread</h3>
                    <p className="text-sm text-muted-foreground">Replies to {threadUser?.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                    {threadMessages.map(renderSingleMessage)}
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-card">
                {attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                        {attachments.map((file, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded-md">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 flex-shrink-0" /> : <File className="h-4 w-4 flex-shrink-0" />}
                                <span className="truncate">{file.name}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}
                            >
                            &times;
                            </Button>
                        </div>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="relative">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={`Reply to thread...`}
                        className="pr-20"
                        autoComplete="off"
                    />
                     <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button type="submit" size="icon" className="h-8 w-8">
                            <Send className="h-4 w-4" />
                        </Button>
                      </div>
                </form>
            </div>
        </div>
    );
}
