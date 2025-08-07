
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Bot, Loader2, Save, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assistInDocument } from '@/ai/flows/assist-in-document';

interface DocumentEditorProps {
  document: Document | null;
  onBack: () => void;
  onSave: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string) => Promise<Document | null>;
  onDelete: (docId: string) => void;
  onCreate: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  spaceId: string;
  appUser: User;
}

export default function DocumentEditor({ document, onBack, onSave, onDelete, onCreate, spaceId, appUser }: DocumentEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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

  return (
    <div className="h-full flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col">
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
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your document here. Use Markdown for formatting..."
                className="flex-1 w-full text-base resize-none border-none focus-visible:ring-0 p-0"
            />
            <div className="mt-4 flex justify-end gap-2">
                 {document && (
                     <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
                 )}
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/> Save Document</Button>
                <Button variant="outline" onClick={() => setIsAssistantOpen(true)}>
                    <Bot className="mr-2 h-4 w-4" /> AI Assistant
                </Button>
            </div>
        </div>

       {isAssistantOpen && (
           <AssistantPanel 
                fullDocument={content} 
                onClose={() => setIsAssistantOpen(false)}
                onInsert={(text) => setContent(prev => `${prev}\n\n${text}`)}
            />
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
        <div className="w-full md:w-80 lg:w-96 border-l bg-card flex-shrink-0 flex flex-col h-full">
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
