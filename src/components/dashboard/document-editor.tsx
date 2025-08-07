
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Save, Trash2, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import TiptapEditor, { useEditor } from '@/components/document/TiptapEditor';
import { useAuth } from '@/hooks/use-auth';
import CommentsPanel from './CommentsPanel';
import AssistantPanel from './AssistantPanel';
import { useRouter } from 'next/navigation';
import { Editor } from '@tiptap/react';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}


interface DocumentEditorProps {
  initialDocument: Document;
  allUsers: User[];
  onSave: (doc: Document) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

export default function DocumentEditor({
  initialDocument,
  allUsers,
  onSave,
  onDelete,
}: DocumentEditorProps) {
  const [document, setDocument] = useState(initialDocument);
  const [sidebarView, setSidebarView] = useState<'ai' | 'comments' | null>(null);
  const { appUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date(initialDocument.updatedAt));

  const debouncedDocument = useDebounce(document, 2000); // 2-second delay

  const onEditorInstance = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

  const handleSave = useCallback(async () => {
    if (!document.name.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsSaving(true);
    const docToSave = { ...document, updatedAt: new Date().toISOString() };
    await onSave(docToSave);
    setIsSaving(false);
    setLastSaved(new Date(docToSave.updatedAt));
  }, [document, onSave, toast]);
  
  // Effect for autosaving
  useEffect(() => {
    // Only save if the debounced value is different from the last known saved state
    if (debouncedDocument && (debouncedDocument.content !== initialDocument.content || debouncedDocument.name !== initialDocument.name)) {
      handleSave();
    }
  }, [debouncedDocument, handleSave, initialDocument]);


  const handleContentChange = (newContent: string) => {
    setDocument(prev => ({ ...prev, content: newContent }));
  }
  
  const handleTitleChange = (newTitle: string) => {
    setDocument(prev => ({ ...prev, name: newTitle }));
  }

  const handleDelete = async () => {
    await onDelete(document.id);
    toast({ title: 'Document Deleted' });
    router.push('/documents');
  };

  const handlePostComment = async (commentContent: string) => {
    if (!appUser) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      userId: appUser.id,
      content: commentContent,
      createdAt: new Date().toISOString()
    };

    const updatedDoc = {
        ...document,
        comments: [...(document.comments || []), newComment]
    };
    
    setDocument(updatedDoc);
    await onSave(updatedDoc);
  };
  
  if (!appUser) return null;

  return (
    <div className="flex flex-row gap-0 h-screen">
      <div className="flex-1 flex flex-col p-4 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={document.name}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled Document"
            className="text-2xl font-bold border-none focus-visible:ring-0 p-0 h-auto"
          />
        </div>

        <div className="flex items-center gap-4 mb-4 border-b pb-2">
           <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isSaving ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Saved at {lastSaved.toLocaleTimeString()}</span>
                    </>
                )}
            </div>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'comments' ? null : 'comments')}>
            <MessageSquare className="mr-2 h-4 w-4" /> Comments ({document.comments?.length || 0})
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'ai' ? null : 'ai')}>
            <Bot className="mr-2 h-4 w-4" /> AI Assistant
          </Button>
        </div>

        <div className="flex-1 py-4 flex flex-col">
          <TiptapEditor 
            content={document.content} 
            onChange={handleContentChange} 
            onEditorInstance={onEditorInstance}
          />
        </div>
      </div>

      {sidebarView && (
        <div className="w-full md:w-80 lg:w-96 border-l bg-card flex-shrink-0 flex flex-col h-full sticky top-0">
          {sidebarView === 'ai' && (
            <AssistantPanel
              fullDocument={document.content}
              onClose={() => setSidebarView(null)}
              editor={editor}
            />
          )}
          {sidebarView === 'comments' && (
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
