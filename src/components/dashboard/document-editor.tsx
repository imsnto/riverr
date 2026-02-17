
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Trash2, MessageSquare, Loader2, Share2, Star, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TiptapEditor from '@/components/document/TiptapEditor';
import { useAuth } from '@/hooks/use-auth';
import CommentsPanel from './CommentsPanel';
import AssistantPanel from './AssistantPanel';
import { useRouter } from 'next/navigation';
import { Editor } from '@tiptap/react';
import NewDocumentDialog from './new-document-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { uploadImageToFirebase } from '@/lib/db';

interface DocumentEditorProps {
  initialDocument: Document;
  docId: string;
  allUsers: User[];
  allDocuments: Document[];
  onSave: (doc: Document) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

const SaveStatusIndicator = ({ isSaving, lastSaved }: { isSaving: boolean, lastSaved: Date | null }) => {
    if (isSaving) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
            </div>
        );
    }
    if (lastSaved) {
        return <span className="text-xs text-muted-foreground">Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span>;
    }
    return null;
}


export default function DocumentEditor({
  initialDocument,
  docId,
  allUsers,
  allDocuments,
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

  const uploadImage = useCallback(
    (file: File) => {
      return uploadImageToFirebase(file, document.hubId, document.id);
    },
    [document.hubId, document.id]
  );

  const onEditorInstance = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

  const handleSave = useCallback(async (docToSave: Document) => {
    if (isSaving) return;

    setIsSaving(true);
    const updatedDoc = { ...docToSave, updatedAt: new Date().toISOString() };
    
    setTimeout(async () => {
        await onSave(updatedDoc);
        setDocument(updatedDoc);
        setLastSavedDocument(updatedDoc);
        setLastSaved(new Date(updatedDoc.updatedAt));
        setIsSaving(false);
    }, 500);

  }, [onSave, isSaving, toast]);
  
  // Auto-save logic
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timer = setTimeout(() => {
        handleSave(document);
      }, 1500); // Save 1.5 seconds after last change

      return () => clearTimeout(timer);
    }
  }, [document, hasUnsavedChanges, handleSave]);
  
  const handleContentChange = (newContent: string) => {
    setDocument(prevDoc => ({ ...prevDoc, content: newContent }));
  };
  
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
    
    setDocument(updatedDocWithComment);
  };

  const handleSharingSave = async (sharingData: Partial<Document>) => {
      const updatedDoc = { ...document, ...sharingData };
      await handleSave(updatedDoc);
      setIsShareOpen(false);
      toast({ title: 'Sharing settings updated' });
  };
  
  if (!appUser || isMobile === undefined) return null;

  // Mobile View
  if (isMobile) {
    return (
        <>
            <div className="flex flex-col h-screen">
                <header className="flex justify-between items-center p-2 border-b">
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        /
                        <Input 
                            value={document.name}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Untitled"
                            className="border-none focus-visible:ring-0 p-0 h-auto text-sm font-semibold text-foreground"
                        />
                    </div>
                    <div className="flex items-center">
                        <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
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
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                    <TiptapEditor 
                        content={document.content} 
                        onChange={handleContentChange} 
                        onEditorInstance={onEditorInstance}
                        uploadImage={uploadImage}
                        docId={docId}
                        allDocuments={allDocuments}
                        linkPrefix="/documents/"
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
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        <div className="px-4 md:px-8 pt-4 shrink-0">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
                        
                        <Button variant="ghost" size="sm" onClick={() => setIsShareOpen(true)}>
                            Share
                        </Button>

                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Star className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSidebarView(sidebarView === 'comments' ? null : 'comments')}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    <span>Comments ({document.comments?.length || 0})</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSidebarView(sidebarView === 'ai' ? null : 'ai')}>
                                    <Bot className="mr-2 h-4 w-4" />
                                    <span>AI Assistant</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete Document</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex justify-center pt-8 px-4 md:px-24">
            <div className="w-full max-w-4xl">
                 <Input 
                    value={document.name}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled Document"
                    className="border-none focus-visible:ring-0 p-0 h-auto text-4xl font-bold tracking-tight mb-4"
                />
                <TiptapEditor 
                    content={document.content} 
                    onChange={handleContentChange} 
                    onEditorInstance={onEditorInstance}
                    uploadImage={uploadImage}
                    docId={docId}
                    allDocuments={allDocuments}
                    linkPrefix="/documents/"
                />
            </div>
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
