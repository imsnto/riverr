
'use client';
import React, { useState, useCallback } from 'react';
import { HelpCenterArticle, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Trash2, MessageSquare, Loader2, Share2, Globe, Lock } from 'lucide-react';
import TiptapEditor, { useEditor } from '@/components/document/TiptapEditor';
import { Editor } from '@tiptap/react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HelpCenterArticleEditorProps {
    article: HelpCenterArticle;
    onSave: (article: HelpCenterArticle) => void;
    allUsers: User[];
    appUser: User;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function HelpCenterArticleEditor({ article: initialArticle, onSave, allUsers, appUser }: HelpCenterArticleEditorProps) {
    const [article, setArticle] = useState(initialArticle);
    const [lastSavedArticle, setLastSavedArticle] = useState(initialArticle);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const author = allUsers.find(u => u.id === article.authorId);

    const hasUnsavedChanges = JSON.stringify(article) !== JSON.stringify(lastSavedArticle);

    const onEditorInstance = useCallback((editor: Editor) => {
        setEditor(editor);
    }, []);

    const handleSave = useCallback(async (docToSave: HelpCenterArticle) => {
        if (!docToSave.title.trim()) {
          toast({ variant: 'destructive', title: 'Title is required' });
          return;
        }
        if (isSaving) return;
    
        setIsSaving(true);
        const updatedArticle = { ...docToSave, updatedAt: new Date().toISOString() };
        onSave(updatedArticle);
        setArticle(updatedArticle);
        setLastSavedArticle(updatedArticle);
        setIsSaving(false);
        toast({ title: 'Article Saved' });
    }, [onSave, toast, isSaving]);
    
    const handleContentChange = (newContent: string) => {
        setArticle(prev => ({ ...prev, content: newContent }));
    }

    const handlePublish = () => {
        const newStatus = article.status === 'published' ? 'draft' : 'published';
        const updatedArticle = { ...article, status: newStatus };
        handleSave(updatedArticle);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold">Article</h1>
                    <p className="text-sm text-muted-foreground">Article belongs to 1 Help Center and 1 collection</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">More</Button>
                    <Button variant="outline">Settings</Button>
                    <Button variant="secondary" onClick={() => handleSave(article)} disabled={isSaving || !hasUnsavedChanges}>
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white">
                        {article.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-8 text-sm text-muted-foreground">
                <a href="#" className="text-primary font-semibold border-b-2 border-primary pb-2">Article Overview</a>
                <a href="#">0 Views</a>
                <a href="#">0 Conversations</a>
                <span>0% 🙂 0% 😐 0% 😞 Reacted</span>
            </div>

            <div className="flex items-center gap-4 mb-8">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <span className="mr-2 h-2 w-2 rounded-full bg-yellow-500"/>
                            English (EN)
                        </Button>
                    </DropdownMenuTrigger>
                </DropdownMenu>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">{article.status === 'draft' ? 'Draft' : 'Published'}</Button>
                    </DropdownMenuTrigger>
                </DropdownMenu>
            </div>
            
            <Input 
                value={article.title}
                onChange={(e) => setArticle(prev => ({...prev, title: e.target.value}))}
                className="text-4xl font-bold border-none focus-visible:ring-0 p-0 h-auto mb-2"
                placeholder="Article Title"
            />
            
            <p className="text-muted-foreground mb-4">Some resources to help you understand how Articles can be used</p>
            
            {author && (
                <div className="flex items-center gap-2 mb-8">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={author.avatarUrl} />
                        <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Written by {author.name}</span>
                </div>
            )}
            
            <TiptapEditor 
                content={article.content}
                onChange={handleContentChange}
                onEditorInstance={onEditorInstance}
            />
        </div>
    );
}
