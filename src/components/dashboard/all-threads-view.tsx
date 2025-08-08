
'use client';

import React from 'react';
import { Message, User } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

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

interface AllThreadsViewProps {
  messages: Message[];
  allUsers: User[];
  appUser: User | null;
  onViewThread: (thread: Message) => void;
  isThreadUnread: (thread: Message) => boolean;
}

export default function AllThreadsView({ messages, allUsers, appUser, onViewThread, isThreadUnread }: AllThreadsViewProps) {
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
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Threads</h3>
                <p className="text-sm text-muted-foreground">All your thread conversations in one place.</p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-0">
                    {sortedThreads.map((thread, index) => {
                         const user = allUsers.find(u => u.id === thread.user_id);
                         const threadReplies = messages.filter(m => m.thread_id === thread.id);
                         const repliers = allUsers.filter(u => [...new Set(threadReplies.map(r => r.user_id))].includes(u.id));
                         const unread = isThreadUnread(thread);
                         const showUnreadSeparator = index === firstUnreadIndex;


                         return (
                            <div key={thread.id}>
                                {showUnreadSeparator && (
                                     <div className="relative px-4">
                                        <Separator />
                                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                            <span className="bg-background px-2 text-xs text-primary font-semibold">Unread</span>
                                        </div>
                                    </div>
                                )}
                                <button className={cn("w-full text-left p-4 hover:bg-accent/50", unread && "bg-primary/5")} onClick={() => onViewThread(thread)}>
                                    <div className="flex items-start gap-3">
                                        <Avatar>
                                            <AvatarImage src={user?.avatarUrl} />
                                            <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("font-semibold", unread && "text-primary")}>{user?.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{renderMessageContent(thread.content, allUsers)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 pl-12">
                                        <div className="flex -space-x-2">
                                            {repliers.slice(0,3).map(replyUser => (
                                                <Avatar key={replyUser.id} className="h-5 w-5 border-2 border-background">
                                                    <AvatarImage src={replyUser?.avatarUrl} />
                                                    <AvatarFallback>{replyUser ? getInitials(replyUser.name) : '?'}</AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                        <span className={cn("text-sm", unread ? "text-primary font-semibold" : "text-muted-foreground")}>
                                            {thread.reply_count} {thread.reply_count! > 1 ? 'replies' : 'reply'}
                                        </span>
                                    </div>
                                </button>
                            </div>
                         )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
