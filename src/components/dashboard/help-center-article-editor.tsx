

'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HelpCenterArticle, User } from '@/lib/data';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Trash2, MessageSquare, Loader2, Share2, Star, MoreHorizontal, ArrowLeft, ExternalLink, CheckCircle2 } from 'lucide-react';
import TiptapEditor from '@/components/document/TiptapEditor';
import { Editor } from '@tiptap/react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import HelpCenterArticleShareDialog from './help-center-article-share-dialog';
import Link from 'next/link';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { uploadImageToFirebase } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';


interface HelpCenterArticleEditorProps {
    article: HelpCenterArticle;
    onSave: (article: HelpCenterArticle) => Promise<void>;
    allUsers: User[];
    appUser: User;
    onBack: () => void;
    onDelete: (articleId: string) => void;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

const SaveStatusIndicator = ({ isSaving, lastSaved, isMobile }: { isSaving: boolean, lastSaved: Date | null, isMobile?: boolean }) => {
    if (isSaving) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {!isMobile && <span>Saving...</span>}
            </div>
        );
    }
    if (lastSaved) {
        if (isMobile) {
             return (
                 <div className="flex items-center gap-1.5 px-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                </div>
             )
        }
        return <span className="text-xs text-muted-foreground px-2">Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span>;
    }
    return isMobile ? <div className="w-8" /> : <div className="w-24"/>;
}


export default function HelpCenterArticleEditor({ article: initialArticle, onSave, allUsers, appUser, onBack, onDelete }: HelpCenterArticleEditorProps) {
    const [article, setArticle] = useState(initialArticle);
    const [lastSavedArticle, setLastSavedArticle] = useState(initialArticle);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(initialArticle.updatedAt ? new Date(initialArticle.updatedAt) : null);
    const { toast } = useToast();
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const author = allUsers.find(u => u.id === article.authorId);
    const router = useRouter();
    const isMobile = useIsMobile();

    const hasUnsavedChanges = JSON.stringify(article) !== JSON.stringify(lastSavedArticle);
    
    const uploadImage = useCallback(
      (file: File) => {
        return uploadImageToFirebase(file, article.hubId, article.id);
      },
      [article.hubId, article.id]
    );

    const onEditorInstance = useCallback((editor: Editor) => {
        setEditor(editor);
    }, []);

    const handleSave = useCallback(async (articleToSave: HelpCenterArticle) => {
        if (isSaving) return;
    
        setIsSaving(true);
        const updatedArticle = { ...articleToSave, updatedAt: new Date().toISOString() };
        
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            await onSave(updatedArticle);
            setArticle(updatedArticle);
            setLastSavedArticle(updatedArticle);
            setLastSaved(new Date(updatedArticle.updatedAt));
        } catch (error) {
            console.error("Failed to save article:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Could not save your changes.',
            });
        } finally {
            setIsSaving(false);
        }
        
    }, [onSave, isSaving, toast]);
    
    useEffect(() => {
        if (hasUnsavedChanges) {
            const timer = setTimeout(() => {
                handleSave(article);
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [article, hasUnsavedChanges, handleSave]);


    const handleContentChange = (newContent: string) => {
        setArticle(prevArticle => ({ ...prevArticle, content: newContent }));
    };
    
    const handleTitleChange = (newTitle: string) => {
        setArticle(prev => ({ ...prev, title: newTitle }));
    }

    const handlePublish = async () => {
        const newStatus = article.status === 'published' ? 'draft' : 'published';
        const updatedArticle = { ...article, status: newStatus, updatedAt: new Date().toISOString() };
        await onSave(updatedArticle);
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

    if (isMobile) {
    return (
        <>
            <div className="flex flex-col h-screen">
                <header className="flex justify-between items-center p-2 border-b">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                        <Button variant="ghost" size="sm" onClick={() => onBack()} className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        /
                        <Input 
                            value={article.title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Untitled"
                            className="border-none focus-visible:ring-0 p-0 h-auto text-sm font-semibold text-foreground truncate"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} isMobile={true} />
                        <Badge variant={article.status === 'draft' ? 'secondary' : 'default'} className={cn('hidden sm:flex', article.status === 'published' ? 'bg-green-100 text-green-800 border-green-200' : '')}>
                            {article.status === 'draft' ? 'Draft' : 'Published'}
                        </Badge>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handlePublish}>
                                    {article.status === 'published' ? 'Unpublish' : 'Publish'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsShareOpen(true)}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share
                                </DropdownMenuItem>
                                {article.helpCenterId && (
                                    <DropdownMenuItem asChild>
                                        <Link href={`/hc/${article.helpCenterId}/articles/${article.id}`} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            <span>Preview Live Page</span>
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                     <Input 
                        value={article.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Article Title"
                        className="border-none focus-visible:ring-0 p-0 h-auto text-2xl font-bold tracking-tight mb-2"
                    />
                    <TiptapEditor 
                        content={article.content} 
                        onChange={handleContentChange} 
                        onEditorInstance={onEditorInstance}
                        uploadImage={uploadImage}
                    />
                </div>
            </div>
        </>
    );
  }

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="w-full shrink-0 px-4 md:px-8 pt-4 md:pt-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                                <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
                                <Badge variant={article.status === 'draft' ? 'secondary' : 'default'} className={article.status === 'published' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                                    {article.status === 'draft' ? 'Draft' : 'Published'}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsShareOpen(true)}>
                                    <Share2 className="h-4 w-4" />
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
                                        {article.helpCenterId && (
                                            <DropdownMenuItem asChild>
                                                <Link href={`/hc/${article.helpCenterId}/articles/${article.id}`} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    <span>Preview Live Page</span>
                                                </Link>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
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
                
                <div className="flex-1 flex justify-center overflow-y-auto px-4 md:px-8">
                    <div className="w-full max-w-4xl relative">
                        <Input
                            value={article.title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="border-none focus-visible:ring-0 p-0 h-auto text-4xl font-bold tracking-tight mb-2"
                            placeholder="Article Title"
                        />
                        <Textarea
                            value={article.subtitle || ''}
                            onChange={(e) => setArticle(prev => ({ ...prev, subtitle: e.target.value }))}
                            placeholder="Add a subtitle..."
                            className="border-none focus-visible:ring-0 p-0 h-auto text-lg text-muted-foreground resize-none overflow-hidden mb-6"
                            minRows={1}
                        />
                        <TiptapEditor 
                            content={article.content} 
                            onChange={handleContentChange} 
                            onEditorInstance={onEditorInstance}
                            uploadImage={uploadImage}
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
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the article "{article.title}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onDelete(article.id)}
                            className={cn(buttonVariants({ variant: "destructive" }))}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

    