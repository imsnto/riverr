
'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assistInDocument } from '@/ai/flows/assist-in-document';
import { Textarea } from '@/components/ui/textarea';

export default function AssistantPanel({ fullDocument, onClose, onInsert }: { fullDocument: string, onClose: () => void, onInsert: (text: string) => void }) {
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
                 <form onSubmit={handleSubmit} className="space-y-2">
                    <Textarea
                        placeholder="Your request..."
                        value={request}
                        onChange={e => setRequest(e.target.value)}
                        minRows={3}
                    />
                    <Button type="submit" className="w-full" disabled={isPending || !request.trim()}>Send</Button>
                </form>
            </div>
        </div>
    )
}
