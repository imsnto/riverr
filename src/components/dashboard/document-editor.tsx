
'use client';

import React, { useEffect, useState } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bot, Save, Trash2, MessageSquare } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import CommentsPanel from './CommentsPanel';
import AssistantPanel from './AssistantPanel';
// The user will provide this component next. For now, we create a placeholder.
import { TiptapEditor } from './TiptapEditor';


interface DocumentEditorProps {
  document: Document | null;
  onBack: () => void;
  onSave: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string) => Promise<Document | null>;
  onDelete: (docId: string) => void;
  onCreate: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Document | null>;
  spaceId: string;
  appUser: User;
  allUsers: User[];
  onDocumentUpdate: (doc: Document) => void;
}

export default function DocumentEditor({
  document,
  onBack,
  onSave,
  onDelete,
  onCreate,
  spaceId,
  appUser,
  allUsers,
  onDocumentUpdate
}: DocumentEditorProps) {
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
      content,
      spaceId,
      createdBy: document?.createdBy || appUser.id,
      type: document?.type || 'notes',
      isLocked: document?.isLocked || false,
      tags: document?.tags || [],
      comments: document?.comments || []
    };

    const savedDoc = document
      ? await onSave(docData, document.id)
      : await onCreate(docData);

    if (savedDoc) {
      onDocumentUpdate(savedDoc);
      toast({ title: 'Document Saved!' });
    }
  };

  const handleDelete = () => {
    if (document) {
      onDelete(document.id);
      onBack();
    }
  };

  const handlePostComment = async (commentContent: string) => {
    if (!document) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      userId: appUser.id,
      content: commentContent,
      createdAt: new Date().toISOString()
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

    const updatedDoc = await onSave(docData, document.id);

    if (updatedDoc) {
      onDocumentUpdate(updatedDoc);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row gap-0 flex-1">
        <div className="flex-1 flex flex-col p-4 md:p-8">
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
            <Button size="sm" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            {document && (
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'comments' ? null : 'comments')}>
              <MessageSquare className="mr-2 h-4 w-4" /> Comments
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSidebarView(sidebarView === 'ai' ? null : 'ai')}>
              <Bot className="mr-2 h-4 w-4" /> AI Assistant
            </Button>
          </div>

          <div className="flex-1 py-4 flex flex-col">
             <TiptapEditor content={content} onChange={setContent} />
          </div>
        </div>

        {sidebarView && (
          <div className="w-full md:w-80 lg:w-96 border-l bg-card flex-shrink-0 flex flex-col h-screen sticky top-0">
            {sidebarView === 'ai' && (
              <AssistantPanel
                fullDocument={content}
                onClose={() => setSidebarView(null)}
                onInsert={(text) => setContent((prev) => `${prev}\n\n${text}`)}
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
    </div>
  );
}
