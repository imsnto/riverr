
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Document, User, DocumentComment } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Bot, Loader2, Save, Trash2, X, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assistInDocument } from '@/ai/flows/assist-in-document';
import { Separator } from '../ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

interface DocumentEditorProps {
  document: Document | null;
  onBack: () => void;
  onSave: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string) => Promise<Document | null>;
  onDelete: (docId: string) => void;
  onCreate: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  spaceId: string;
  appUser: User;
  allUsers: User[];
}

export default function DocumentEditor({ document, onBack, onSave, onDelete, onCreate, spaceId, appUser, allUsers }: DocumentEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sidebarView, setSidebarView] = useState<'ai' | 'comments' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (document) {
      setTitle(document.name);
      setContent(document.content);
    } else {
        setTitle('Untitled Document');
        setContent('');
    }
  }, [document]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    
    const docData = {
        name: title,
        content: content,
        spaceId: spaceId,
        createdBy: document?.createdBy || appUser.id,
        type: document?.type || 'notes',
        isLocked: document?.isLocked || false,
        tags: document?.tags || [],
        comments: document?.comments || [],
    };
    
    if (document) {
        await onSave(docData, document.id);
    } else {
        await onCreate(docData);
    }
  };
  
  const handleDelete = () => {
    if (document) {
        onDelete(document.id);
        onBack();
    }
  }

  const handlePostComment = async (commentContent: string) => {
    if (!document) return;

    const newComment: DocumentComment = {
        id: `comment-${Date.now()}`,
        userId: appUser.id,
        content: commentContent,
        createdAt: new Date().toISOString(),
    };

    const docData = {
        name: document.name,
        content: document.content,
        spaceId: document.spaceId,
        createdBy: document.createdBy,
        type: document.type,
        isLocked: document.isLocked,
        tags: document.tags,
        comments: [...(document.comments || []), newComment],
    };
    
    await onSave(docData, document.id);
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Document"
                    className="text-2xl font-bold border-none focus-visible:ring-0 p-0 h-auto"
                />
            </div>

            <div className="flex items-center gap-2 mb-4 border-b pb-2">
                 <Button size="sm" onClick={handleSave}><Save className="mr-2 h-4 w-4"/> Save</Button>
                 {document && (
                     <Button size="sm" variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
                 )}
                 <Separator orientation="vertical" className="h-6 mx-2" />
                 <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'comments' ? null : 'comments')}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Comments
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'ai' ? null : 'ai')}>
                    <Bot className="mr-2 h-4 w-4" /> AI Assistant
                </Button>
            </div>
            
            <div className="flex-1 bg-muted/30 p-4 rounded-lg">
                <div className="bg-background p-8 rounded-md border shadow-sm h-full">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Start writing your document here. Use Markdown for formatting..."
                        className="flex-1 w-full h-full text-base resize-none border-none focus-visible:ring-0 p-0"
                    />
                </div>
            </div>
        </div>

       {sidebarView && (
            <div className="w-full md:w-80 lg:w-96 border-l bg-card flex-shrink-0 flex flex-col h-full">
                {sidebarView === 'ai' && (
                    <AssistantPanel 
                        fullDocument={content} 
                        onClose={() => setSidebarView(null)}
                        onInsert={(text) => setContent(prev => `${prev}\n\n${text}`)}
                    />
                )}
                {sidebarView === 'comments' && document && (
                    <CommentsPanel
                        document={document}
                        onClose={() => setSidebarView(null)}
                        appUser={appUser}
                        allUsers={allUsers}
                        onPostComment={handlePostComment}
                    />
                )}
            </div>
       )}
    </div>
  );
}


function AssistantPanel({ fullDocument, onClose, onInsert }: { fullDocument: string, onClose: () => void, onInsert: (text: string) => void }) {
    const [request, setRequest] = useState('');
    const [suggestion, setSuggestion] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!request.trim()) return;

        startTransition(async () => {
            setSuggestion('');
            try {
                const result = await assistInDocument({
                    documentContent: fullDocument,
                    request: request
                });
                setSuggestion(result.suggestion);
            } catch(error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'AI Assistant Error' });
            }
        });
    }

    const handleInsert = () => {
        if (!suggestion) return;
        onInsert(suggestion);
        setSuggestion('');
        setRequest('');
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2"><Bot className="h-5 w-5" /> AI Assistant</h3>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                 <p className="text-sm text-muted-foreground">What can I help you with? Try asking to "summarize this" or "create an outline for a proposal".</p>
                {isPending && (
                    <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Thinking...</span>
                    </div>
                )}
                {suggestion && (
                    <div className="p-3 rounded-md border bg-background space-y-3">
                        <p className="text-sm whitespace-pre-wrap">{suggestion}</p>
                        <Button className="w-full" size="sm" onClick={handleInsert}>Insert into Document</Button>
                    </div>
                )}
            </div>
            <div className="p-4 border-t">
                 <form onSubmit={handleSubmit}>
                    <Textarea 
                        placeholder="Your request..." 
                        value={request} 
                        onChange={e => setRequest(e.target.value)}
                        className="mb-2"
                        rows={3}
                    />
                    <Button type="submit" className="w-full" disabled={isPending}>Send</Button>
                </form>
            </div>
        </div>
    )
}

function CommentsPanel({ document, onClose, allUsers, appUser, onPostComment }: { document: Document, onClose: () => void, allUsers: User[], appUser: User, onPostComment: (content: string) => void }) {
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
                        <Textarea 
                            placeholder="Write a comment... use @ to mention users" 
                            value={newComment}
                            onChange={handleInputChange}
                            className="mb-2"
                            rows={3}
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
