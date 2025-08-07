
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
                {sidebarView === 'comments' && (
                    <CommentsPanel
                        document={document}
                        onClose={() => setSidebarView(null)}
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

function CommentsPanel({ document, onClose }: { document: Document | null, onClose: () => void }) {
    // Placeholder for comments functionality
    // In a real app, you would fetch comments for the document.
    const comments: DocumentComment[] = [];

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Comments</h3>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {comments.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground pt-8">
                        No comments yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Map over comments here */}
                    </div>
                )}
            </div>
            <div className="p-4 border-t">
                 <Textarea 
                    placeholder="Write a comment..." 
                    className="mb-2"
                    rows={3}
                />
                <Button className="w-full">Post Comment</Button>
            </div>
        </div>
    );
}
