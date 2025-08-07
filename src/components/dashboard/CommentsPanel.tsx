
'use client';

import React, { useState } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import TextareaAutosize from 'react-textarea-autosize';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function CommentsPanel({ document, onClose, allUsers, appUser, onPostComment }: { document: Document, onClose: () => void, allUsers: User[], appUser: User, onPostComment: (content: string) => void }) {
    const [newComment, setNewComment] = useState('');
    const [isTagging, setIsTagging] = useState(false);
    const [tagQuery, setTagQuery] = useState('');
    const comments = document.comments || [];

    const handlePost = () => {
        if (!newComment.trim()) return;
        onPostComment(newComment);
        setNewComment('');
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewComment(value);

        const lastAt = value.lastIndexOf('@');
        if (lastAt !== -1 && !value.slice(lastAt + 1).includes(' ')) {
            setIsTagging(true);
            setTagQuery(value.slice(lastAt + 1));
        } else {
            setIsTagging(false);
        }
      }

      const handleUserTag = (userName: string) => {
        const lastAt = newComment.lastIndexOf('@');
        setNewComment(newComment.slice(0, lastAt) + `@${userName} `);
        setIsTagging(false);
      }

    const renderCommentContent = (content: string) => {
        const parts = content.split(/(@\w+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const userName = part.substring(1);
                const user = allUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
                if (user) {
                    return <strong key={index} className="bg-primary/20 text-primary px-1 rounded-sm">@{user.name}</strong>;
                }
            }
            return part;
        });
    }

    const filteredMembers = allUsers.filter(member =>
        member.name.toLowerCase().includes(tagQuery.toLowerCase()) && member.id !== appUser?.id
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Comments</h3>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {comments.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground pt-8">
                            No comments yet.
                        </div>
                    ) : (
                        comments.map(comment => {
                             const user = allUsers.find(u => u.id === comment.userId);
                             return (
                                <div key={comment.id} className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user?.avatarUrl} />
                                        <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{user?.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(comment.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{renderCommentContent(comment.content)}</p>
                                    </div>
                                </div>
                             )
                        })
                    )}
                </div>
            </ScrollArea>
            <div className="p-4 border-t">
                <Popover open={isTagging} onOpenChange={setIsTagging}>
                    <PopoverTrigger asChild>
                        <TextareaAutosize
                            placeholder="Write a comment... use @ to mention users"
                            value={newComment}
                            onChange={handleInputChange}
                            className="mb-2"
                            minRows={3}
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput
                            placeholder="Tag user..."
                            value={tagQuery}
                            onValueChange={setTagQuery}
                        />
                        <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                                {filteredMembers.map(member => (
                                    <CommandItem
                                        key={member.id}
                                        value={member.name}
                                        onSelect={() => handleUserTag(member.name)}
                                    >
                                    <Avatar className="mr-2 h-6 w-6">
                                        <AvatarImage src={member.avatarUrl} />
                                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                    </Avatar>
                                    {member.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                    </PopoverContent>
                </Popover>
                <Button className="w-full" onClick={handlePost}>Post Comment</Button>
            </div>
        </div>
    );
}
