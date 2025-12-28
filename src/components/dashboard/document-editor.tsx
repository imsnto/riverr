
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Trash2, MessageSquare, CheckCircle2, Loader2, Share2, Globe, Lock } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import TiptapEditor, { useEditor } from '@/components/document/TiptapEditor';
import { useAuth } from '@/hooks/use-auth';
import CommentsPanel from './CommentsPanel';
import AssistantPanel from './AssistantPanel';
import { useRouter } from 'next/navigation';
import { Editor } from '@tiptap/react';
import NewDocumentDialog from './new-document-dialog';
import { updateDocument } from '@/lib/db';

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
  const [lastSavedDocument, setLastSavedDocument] = useState(initialDocument);
  const [sidebarView, setSidebarView] = useState<'ai' | 'comments' | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
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

  const handleSave = useCallback(async (docToSave: Document) => {
    if (!docToSave.name.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsSaving(true);
    const updatedDoc = { ...docToSave, updatedAt: new Date().toISOString() };
    await onSave(updatedDoc);
    setDocument(updatedDoc);
    setLastSavedDocument(updatedDoc); // Update the last saved state
    setIsSaving(false);
    setLastSaved(new Date(updatedDoc.updatedAt));
  }, [onSave, toast]);
  
  // Effect for autosaving content and title changes
  useEffect(() => {
    if (debouncedDocument && (debouncedDocument.content !== lastSavedDocument.content || debouncedDocument.name !== lastSavedDocument.name)) {
      handleSave(debouncedDocument);
    }
  }, [debouncedDocument, handleSave, lastSavedDocument]);


  const handleContentChange = (newContent: string) => {
    setDocument(prev => ({ ...prev, content: newContent }));
  }
  
  const handleTitleChange = (newTitle: string) => {
    setDocument(prev => ({ ...prev, name: newTitle }));
  }

  const handleDelete = async () => {
    await onDelete(document.id);
    toast({ title: 'Document Deleted' });
    router.back();
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
    
    await handleSave(updatedDoc);
  };

  const handleSharingSave = async (sharingData: Partial<Document>) => {
      const updatedDoc = { ...document, ...sharingData };
      await handleSave(updatedDoc);
      setIsShareOpen(false);
      toast({ title: 'Sharing settings updated' });
  };
  
  if (!appUser) return null;

  return (
    <>
    <div className="flex flex-row gap-0 h-screen">
      <div className="flex-1 flex flex-col p-4 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
            <Button size="sm" variant="outline" onClick={() => setIsShareOpen(true)}>
                {document.isPublic ? <Globe className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                Share
            </Button>
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
    <NewDocumentDialog
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        spaceId={document.spaceId}
        spaceMembers={allUsers.filter(u => u.role !== 'Admin')} // Simplified logic for space members
        onCreate={() => {}} // Not used for editing
        isEditing={true}
        initialData={{
            name: document.name,
            access: document.isPublic ? 'public' : 'private',
            allowedUserIds: document.allowedUserIds || []
        }}
        onEditSave={handleSharingSave}
    />
    </>
  );
}
