
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Trash2, MessageSquare, Loader2, Share2, Globe, Lock, MoreHorizontal } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

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
  const [lastSaved, setLastSaved] = useState<Date | null>(initialDocument.updatedAt ? new Date(initialDocument.updatedAt) : null);
  const isMobile = useIsMobile();
  
  const hasUnsavedChanges = JSON.stringify(document) !== JSON.stringify(lastSavedDocument);

  const onEditorInstance = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

  const handleSave = useCallback(async (docToSave: Document) => {
    if (!docToSave.name.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return null;
    }
    if (isSaving) return null;

    setIsSaving(true);
    const updatedDoc = { ...docToSave, updatedAt: new Date().toISOString() };
    await onSave(updatedDoc);
    setDocument(updatedDoc);
    setLastSavedDocument(updatedDoc);
    setLastSaved(new Date(updatedDoc.updatedAt));
    setIsSaving(false);
    return updatedDoc;
  }, [onSave, toast, isSaving]);
  
  const handleManualSave = useCallback(async () => {
    const savedDoc = await handleSave(document);
    if(savedDoc) {
      toast({ title: 'Document Saved' });
    }
  }, [document, handleSave, toast]);
  
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

    const updatedDocWithComment = {
        ...document,
        comments: [...(document.comments || []), newComment]
    };
    
    // Optimistically update UI
    setDocument(updatedDocWithComment);
    
    const savedDoc = await handleSave(updatedDocWithComment);
    if (savedDoc) {
        toast({ title: 'Comment posted and document saved' });
    }
  };

  const handleSharingSave = async (sharingData: Partial<Document>) => {
      const updatedDoc = { ...document, ...sharingData };
      const savedDoc = await handleSave(updatedDoc);
      if (savedDoc) {
        setIsShareOpen(false);
        toast({ title: 'Sharing settings updated' });
      }
  };
  
  if (!appUser || isMobile === undefined) return null;

  // Mobile View
  if (isMobile) {
    return (
        <>
            <div className="flex flex-col h-screen">
                <header className="flex justify-between items-center p-2 border-b">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => setIsShareOpen(true)}>
                            <Share2 className="h-5 w-5" />
                        </Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleManualSave} disabled={!hasUnsavedChanges || isSaving}>
                                    {isSaving ? 'Saving...' : 'Save'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSidebarView(p => p === 'comments' ? null : 'comments')}>Comments</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSidebarView(p => p === 'ai' ? null : 'ai')}>AI Assistant</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto px-4 pt-4">
                    <Input
                        value={document.name}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Untitled Document"
                        className="text-3xl font-bold border-none focus-visible:ring-0 p-0 h-auto mb-4"
                    />
                    <TiptapEditor 
                        content={document.content} 
                        onChange={handleContentChange} 
                        onEditorInstance={onEditorInstance}
                    />
                </div>
            </div>
             {sidebarView && (
                 <div className="absolute inset-0 bg-background z-10">
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
            <NewDocumentDialog
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                spaceId={document.spaceId}
                spaceMembers={allUsers.filter(u => u.role !== 'Admin')}
                onCreate={() => {}}
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

  // Desktop View
  return (
    <>
    <div className="flex flex-col md:flex-row gap-0 h-screen">
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
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

        <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-2">
            <Button size="sm" onClick={handleManualSave} disabled={!hasUnsavedChanges || isSaving}>
                 {isSaving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                 ) : hasUnsavedChanges ? (
                    'Save Changes'
                 ) : (
                    'Saved'
                 )}
            </Button>
            {!hasUnsavedChanges && lastSaved && (
                <span className="text-xs text-muted-foreground">
                    Last saved at {lastSaved.toLocaleTimeString()}
                </span>
            )}
            
            <Separator orientation="vertical" className="h-6 mx-2" />
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

        <div className="flex-1 py-4 flex flex-col min-h-[400px]">
          <TiptapEditor 
            content={document.content} 
            onChange={handleContentChange} 
            onEditorInstance={onEditorInstance}
          />
        </div>
      </div>

      {sidebarView && (
        <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l bg-card flex-shrink-0 flex flex-col h-auto md:h-full md:sticky top-0">
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
