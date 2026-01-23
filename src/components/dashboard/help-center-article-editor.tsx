
'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { HelpCenterArticle, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Trash2, MessageSquare, Loader2, Share2, Globe, Lock, ArrowLeft, MoreHorizontal, Star } from 'lucide-react';
import TiptapEditor, { useEditor } from '@/components/document/TiptapEditor';
import { Editor } from '@tiptap/react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import HelpCenterArticleShareDialog from './help-center-article-share-dialog';

interface HelpCenterArticleEditorProps {
    article: HelpCenterArticle;
    onSave: (article: HelpCenterArticle) => void;
    allUsers: User[];
    appUser: User;
    onBack: () => void;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

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


export default function HelpCenterArticleEditor({ article: initialArticle, onSave, allUsers, appUser, onBack }: HelpCenterArticleEditorProps) {
    const [article, setArticle] = useState(initialArticle);
    const [lastSavedArticle, setLastSavedArticle] = useState(initialArticle);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(initialArticle.updatedAt ? new Date(initialArticle.updatedAt) : null);
    const { toast } = useToast();
    const [isTitleDerived, setIsTitleDerived] = useState(initialArticle.title === '');
    const [isShareOpen, setIsShareOpen] = useState(false);
    const author = allUsers.find(u => u.id === article.authorId);

    const hasUnsavedChanges = JSON.stringify(article) !== JSON.stringify(lastSavedArticle);

    const onEditorInstance = useCallback((editor: Editor) => {
        setEditor(editor);
        editor.chain().focus('end').run();
    }, []);

    const handleSave = useCallback(async (articleToSave: HelpCenterArticle) => {
        if (isSaving) return;
    
        setIsSaving(true);
        const updatedArticle = { ...articleToSave, updatedAt: new Date().toISOString() };
        
        setTimeout(() => {
            onSave(updatedArticle);
            setArticle(updatedArticle);
            setLastSavedArticle(updatedArticle);
            setLastSaved(new Date(updatedArticle.updatedAt));
            setIsSaving(false);
        }, 500);
        
    }, [onSave, isSaving]);
    
    // Auto-save logic
    useEffect(() => {
        if (hasUnsavedChanges) {
        const timer = setTimeout(() => {
            handleSave(article);
        }, 1500); // Save 1.5 seconds after last change

        return () => clearTimeout(timer);
        }
    }, [article, hasUnsavedChanges, handleSave]);


    const handleContentChange = (newContent: string) => {
        setArticle(prevArticle => {
            let newTitle = prevArticle.title;
            if (editor && isTitleDerived) {
                const firstNode = editor.state.doc.content.firstChild;
                if (firstNode && firstNode.type.name === 'heading' && firstNode.textContent) {
                    newTitle = firstNode.textContent;
                } else if (firstNode && firstNode.textContent === '' && prevArticle.title !== '') {
                    newTitle = 'Untitled Article';
                }
            }
            return { ...prevArticle, title: newTitle, content: newContent };
        });
    };

    const handlePublish = async () => {
        const newStatus = article.status === 'published' ? 'draft' : 'published';
        const updatedArticle = { ...article, status: newStatus, updatedAt: new Date().toISOString() };
        onSave(updatedArticle);
        setArticle(updatedArticle);
        setLastSavedArticle(updatedArticle);
        setLastSaved(new Date(updatedArticle.updatedAt));
        toast({ title: newStatus === 'published' ? 'Article Published' : 'Article reverted to draft' });
    };

    const handleSharingSave = (sharingData: { isPublic: boolean, allowedUserIds: string[] }) => {
        const updatedArticle = { ...article, ...sharingData };
        onSave(updatedArticle);
        setIsShareOpen(false);
        toast({ title: 'Sharing settings updated' });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="w-full shrink-0 px-4 md:px-8 pt-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                            </Button>
                            /
                             <div className="flex items-center gap-2">
                                {article.isPublic === false ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                                <Input
                                    value={article.title}
                                    onChange={(e) => {
                                        setIsTitleDerived(false);
                                        setArticle(prev => ({...prev, title: e.target.value}))
                                    }}
                                    className="border-none focus-visible:ring-0 p-0 h-auto text-sm font-semibold text-foreground"
                                    placeholder="Article Title"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
                            <Badge variant={article.status === 'draft' ? 'secondary' : 'default'} className={article.status === 'published' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                                {article.status === 'draft' ? 'Draft' : 'Published'}
                            </Badge>
                             <Button variant="outline" size="sm" onClick={() => setIsShareOpen(true)}>
                                <Share2 className="h-4 w-4 mr-2" /> Share
                            </Button>
                            <Button variant="outline" size="sm" onClick={handlePublish}>
                                {article.status === 'published' ? 'Unpublish' : 'Publish'}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete Article</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    
                    {author && (
                        <div className="flex items-center gap-2 mb-4">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={author.avatarUrl} />
                                <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">Written by {author.name}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 flex justify-center pt-12 md:pt-4 overflow-y-auto px-4 md:px-8">
                <div className="w-full max-w-4xl">
                    <TiptapEditor 
                        content={article.content}
                        onChange={handleContentChange}
                        onEditorInstance={onEditorInstance}
                    />
                </div>
            </div>

            <HelpCenterArticleShareDialog
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                article={article}
                onSave={handleSharingSave}
                allUsers={allUsers}
            />
        </div>
    );
}
