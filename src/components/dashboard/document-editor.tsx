
'use client';

import React, { useEffect, useState } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Save, Trash2, MessageSquare } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import TiptapEditor from '@/components/document/TiptapEditor';
import { useAuth } from '@/hooks/use-auth';
import CommentsPanel from './CommentsPanel';
import AssistantPanel from './AssistantPanel';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    setDocument(initialDocument);
  }, [initialDocument]);

  const handleContentChange = (newContent: string) => {
    setDocument(prev => ({ ...prev, content: newContent }));
  }
  
  const handleTitleChange = (newTitle: string) => {
    setDocument(prev => ({ ...prev, name: newTitle }));
  }

  const handleSave = async () => {
    if (!document.name.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    const docToSave = { ...document, updatedAt: new Date().toISOString() };
    await onSave(docToSave);
    toast({ title: 'Document Saved!' });
  };

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
            onBlur={handleSave}
            placeholder="Untitled Document"
            className="text-2xl font-bold border-none focus-visible:ring-0 p-0 h-auto"
          />
        </div>

        <div className="flex items-center gap-2 mb-4 border-b pb-2">
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Save
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
          <TiptapEditor content={document.content} onChange={handleContentChange} onBlur={handleSave}/>
        </div>
      </div>

      {sidebarView && (
        <div className="w-full md:w-80 lg:w-96 border-l bg-card flex-shrink-0 flex flex-col h-full sticky top-0">
          {sidebarView === 'ai' && (
            <AssistantPanel
              fullDocument={document.content}
              onClose={() => setSidebarView(null)}
              onInsert={(text) => handleContentChange(`${document.content}\n\n${text}`)}
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
