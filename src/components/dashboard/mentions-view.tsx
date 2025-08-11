// src/components/dashboard/mentions-view.tsx
'use client';

import React from 'react';
import { User, Message, Activity, DocumentComment } from '@/lib/data';
import { Button } from '../ui/button';
import { X, MessageSquare, CheckSquare, FileText } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

type Mention = (Message | Activity | DocumentComment) & {
    parentType?: 'task' | 'document';
    parentId?: string;
    parentName?: string;
};

interface MentionsViewProps {
    mentions: Mention[];
    allUsers: User[];
    onClose: () => void;
    isDialog?: boolean;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

const renderMentionContent = (content: string, allUsers: User[]) => {
    const parts = content.split(/(@[\w\s]+)/g).filter(Boolean);
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            const userName = part.substring(1).trim();
            const user = allUsers.find(u => u.name === userName);
            if (user) {
                return <strong key={index} className="text-primary font-semibold">@{user.name}</strong>;
            }
        }
        return part;
    });
};

export default function MentionsView({ mentions, allUsers, onClose, isDialog = true }: MentionsViewProps) {
    if (mentions.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                {isDialog && <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4"><X className="h-4 w-4" /></Button>}
                <p className="text-sm text-muted-foreground">No unread mentions.</p>
            </div>
        );
    }
    
    const getParentIcon = (mention: Mention) => {
        if ('channel_id' in mention) return <MessageSquare className="h-3 w-3" />;
        if (mention.parentType === 'task') return <CheckSquare className="h-3 w-3" />;
        if (mention.parentType === 'document') return <FileText className="h-3 w-3" />;
        return null;
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {isDialog && (
                <div className="p-4 border-b flex-shrink-0 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Mentions</h3>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
            )}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                    {mentions.map((mention, index) => {
                        const userId = 'user_id' in mention ? mention.user_id : mention.userId;
                        const timestamp = 'timestamp' in mention ? mention.timestamp : mention.createdAt;
                        const content = 'content' in mention ? mention.content : mention.comment || '';
                        
                        const user = allUsers.find(u => String(u.id) === String(userId));

                        return (
                            <div key={index} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user?.avatarUrl} />
                                    <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{user?.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground my-1">
                                        {renderMentionContent(content, allUsers)}
                                    </div>
                                     <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:underline">
                                        {getParentIcon(mention)}
                                        {mention.parentName || ('channel_id' in mention ? `#${mention.channel_id}`: '')}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
             {!isDialog && (
                <div className="p-4 border-t">
                    <Button variant="outline" size="sm" className="w-full" onClick={onClose}>Mark all as read</Button>
                </div>
            )}
        </div>
    );
}
