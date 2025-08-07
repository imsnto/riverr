
'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assistInDocument, AssistInDocumentOutput } from '@/ai/flows/assist-in-document';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuth } from '@/hooks/use-auth';

interface Message {
  role: 'user' | 'model';
  content: string;
  modification?: string;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function AssistantPanel({ fullDocument, onClose, onInsert }: { fullDocument: string, onClose: () => void, onInsert: (text: string) => void }) {
    const [history, setHistory] = useState<Message[]>([]);
    const [request, setRequest] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { appUser } = useAuth();
    const scrollAreaRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
    }, [history]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!request.trim()) return;

        const newUserMessage: Message = { role: 'user', content: request };
        const currentHistory = [...history, newUserMessage];
        setHistory(currentHistory);
        setRequest('');

        startTransition(async () => {
            try {
                const result = await assistInDocument({
                    documentContent: fullDocument,
                    history: history.map(({role, content}) => ({role, content})), // Don't send modification to AI
                    request: request
                });
                
                const newModelMessage: Message = { 
                    role: 'model', 
                    content: result.response, 
                    modification: result.modification 
                };

                setHistory(prev => [...prev, newModelMessage]);

            } catch(error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'AI Assistant Error' });
                // Remove the user's message if AI fails
                setHistory(prev => prev.slice(0, -1));
            }
        });
    }

    const handleInsert = (modification: string) => {
        onInsert(modification);
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                <h3 className="font-semibold flex items-center gap-2"><Bot className="h-5 w-5" /> AI Assistant</h3>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                    {history.map((msg, index) => (
                        <div key={index} className="flex items-start gap-3">
                            {msg.role === 'user' ? (
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={appUser?.avatarUrl} />
                                    <AvatarFallback>{appUser ? getInitials(appUser.name) : 'U'}</AvatarFallback>
                                </Avatar>
                            ) : (
                                 <Avatar className="h-8 w-8 bg-primary/20">
                                    <AvatarFallback><Bot className="h-5 w-5 text-primary"/></AvatarFallback>
                                </Avatar>
                            )}
                            <div className="flex-1 rounded-md border bg-background p-3 space-y-3">
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                {msg.role === 'model' && msg.modification && (
                                     <Button className="w-full" size="sm" onClick={() => handleInsert(msg.modification!)}>Insert into Document</Button>
                                )}
                            </div>
                        </div>
                    ))}
                     {isPending && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Thinking...</span>
                        </div>
                    )}
                     {history.length === 0 && !isPending && (
                         <div className="text-center text-sm text-muted-foreground pt-8">
                            <p>Ask me anything about this document! Try things like "Summarize this" or "Give me some ideas for a title".</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
            <div className="p-4 border-t flex-shrink-0">
                 <form onSubmit={handleSubmit} className="space-y-2">
                    <Textarea
                        placeholder="Your request..."
                        value={request}
                        onChange={e => setRequest(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        minRows={3}
                    />
                    <Button type="submit" className="w-full" disabled={isPending || !request.trim()}>Send</Button>
                </form>
            </div>
        </div>
    )
}
