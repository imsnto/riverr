'use client';
import React, { useState, useEffect } from 'react';
import HelpCenterSidebar from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import HelpCenterFormDialog from './help-center-form-dialog';
import { addHelpCenter, updateHelpCenter } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterSettings from './help-center-settings';

interface HelpCenterLayoutProps {
    helpCenters: HelpCenter[];
    collections: HelpCenterCollection[];
    articles: HelpCenterArticle[];
    allUsers: User[];
    onSaveArticle: (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>) => Promise<HelpCenterArticle | void>;
    onDataRefresh: () => void;
}

export default function HelpCenterLayout({ 
    helpCenters, 
    collections, 
    articles, 
    allUsers, 
    onSaveArticle, 
    onDataRefresh 
}: HelpCenterLayoutProps) {
    const [view, setView] = useState('all_articles');
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const { appUser, activeHub } = useAuth();
    const [activeHelpCenter, setActiveHelpCenter] = useState<HelpCenter | null>(helpCenters.length > 0 ? helpCenters[0] : null);

    const [isHcDialogOpen, setIsHcDialogOpen] = useState(false);
    const [editingHelpCenter, setEditingHelpCenter] = useState<HelpCenter | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (helpCenters.length > 0 && !activeHelpCenter) {
            setActiveHelpCenter(helpCenters[0]);
        }
        if (helpCenters.length === 0) {
            setActiveHelpCenter(null);
        }
    }, [helpCenters, activeHelpCenter]);

    useEffect(() => {
        if (articles.length > 0 && !selectedArticleId) {
            setSelectedArticleId(articles[0].id);
        }
        if(articles.length === 0) {
            setSelectedArticleId(null);
        }
    }, [articles, selectedArticleId]);

    const handleCreateHelpCenter = () => {
        setEditingHelpCenter(null);
        setIsHcDialogOpen(true);
    };

    const handleEditHelpCenter = (hc: HelpCenter) => {
        setEditingHelpCenter(hc);
        setIsHcDialogOpen(true);
    }

    const handleSaveHelpCenter = async (name: string) => {
        if (!activeHub) {
            toast({ variant: 'destructive', title: "No active hub."});
            return;
        }

        if (editingHelpCenter) {
            // Update
            await updateHelpCenter(editingHelpCenter.id, { name });
            toast({ title: "Help Center updated."});
        } else {
            // Create
            await addHelpCenter({ name, hubId: activeHub.id });
            toast({ title: "Help Center created."});
        }
        onDataRefresh(); // This is passed from `dashboard.tsx`
        setIsHcDialogOpen(false);
        setEditingHelpCenter(null);
    };

    const filteredArticles = articles.filter(article => {
        // filter by help center first if one is active
        const inActiveHc = activeHelpCenter ? article.helpCenterId === activeHelpCenter.id : true;
        if (!inActiveHc) return false;

        if (view === 'published') return article.status === 'published';
        if (view === 'draft') return article.status === 'draft';
        if (view.startsWith('collection_')) {
            const collectionId = view.split('_')[1];
            return article.collectionIds.includes(collectionId);
        }
        return true; // all_articles
    });
    
    // If no article is selected, show the first one or a placeholder.
    let articleToEdit = selectedArticleId 
        ? articles.find(a => a.id === selectedArticleId) 
        : filteredArticles[0];

    // Make sure the article to edit is in the filtered list
    if (articleToEdit && !filteredArticles.some(a => a.id === articleToEdit!.id)) {
        articleToEdit = filteredArticles[0];
    }
    
    const handleCreateArticle = async () => {
      if (!appUser || !activeHub) return;
      const newArticleData: Omit<HelpCenterArticle, 'id'> = {
        title: 'New Untitled Article',
        content: '<h1>Start writing...</h1>',
        status: 'draft',
        collectionIds: [],
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        helpCenterId: activeHelpCenter ? activeHelpCenter.id : null,
        hubId: activeHub.id,
      };
      
      const newArticle = await onSaveArticle(newArticleData);
      if (newArticle) {
        setSelectedArticleId(newArticle.id);
      }
    };
    
    const renderContent = () => {
        if (view.startsWith('settings_')) {
            return <HelpCenterSettings helpCenter={activeHelpCenter} />;
        }
        
        if (articleToEdit) {
            return (
                <HelpCenterArticleEditor 
                   key={articleToEdit.id}
                   article={articleToEdit} 
                   onSave={(article) => onSaveArticle(article)}
                   allUsers={allUsers}
                   appUser={appUser!}
                />
            );
        }

        return (
            <div className="flex h-full items-center justify-center text-center">
                <div>
                    <h2 className="text-2xl font-semibold">No Articles Yet</h2>
                    <p className="text-muted-foreground">Create your first article to get started.</p>
                    <Button onClick={handleCreateArticle} className="mt-4">New Article</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid h-full grid-cols-[320px_1fr]">
            <HelpCenterSidebar
                helpCenters={helpCenters}
                activeHelpCenter={activeHelpCenter}
                onSelectHelpCenter={setActiveHelpCenter}
                collections={collections}
                activeView={view}
                onViewChange={setView}
                onCreateHelpCenter={handleCreateHelpCenter}
                onEditHelpCenter={handleEditHelpCenter}
            />
            <main className="overflow-y-auto p-8">
                {renderContent()}
            </main>
            <HelpCenterFormDialog
                isOpen={isHcDialogOpen}
                onOpenChange={setIsHcDialogOpen}
                onSave={handleSaveHelpCenter}
                helpCenter={editingHelpCenter}
            />
        </div>
    );
}
