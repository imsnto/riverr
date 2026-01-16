
'use client';
import React, { useState } from 'react';
import HelpCenterSidebar from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';

interface HelpCenterLayoutProps {
    helpCenters: HelpCenter[];
    collections: HelpCenterCollection[];
    articles: HelpCenterArticle[];
    allUsers: User[];
    onSaveArticle: (article: HelpCenterArticle) => void;
}

export default function HelpCenterLayout({ helpCenters, collections, articles, allUsers, onSaveArticle }: HelpCenterLayoutProps) {
    const [view, setView] = useState('all_articles');
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const { appUser } = useAuth();
    
    // For now, let's assume one help center.
    const activeHelpCenter = helpCenters.length > 0 ? helpCenters[0] : null;

    const filteredArticles = articles.filter(article => {
        if (view === 'published') return article.status === 'published';
        if (view === 'draft') return article.status === 'draft';
        if (view.startsWith('collection_')) {
            const collectionId = view.split('_')[1];
            return article.collectionIds.includes(collectionId);
        }
        return true; // all_articles
    });
    
    // If no article is selected, show the first one or a placeholder.
    const articleToEdit = selectedArticleId 
        ? articles.find(a => a.id === selectedArticleId) 
        : filteredArticles[0];

    const handleCreateArticle = async () => {
      if (!appUser || !activeHelpCenter) return;
      const newArticle: Omit<HelpCenterArticle, 'id'> = {
        title: 'New Article',
        content: '<h1>Start writing...</h1>',
        status: 'draft',
        collectionIds: [],
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        helpCenterId: activeHelpCenter.id,
      };
      // In a real app, you'd save this and get an ID, then set it.
      // For now, we'll just log it.
      console.log("Creating new article", newArticle);
    };

    return (
        <div className="grid h-full grid-cols-[320px_1fr]">
            <HelpCenterSidebar
                activeHelpCenter={activeHelpCenter}
                collections={collections}
                activeView={view}
                onViewChange={setView}
            />
            <main className="overflow-y-auto p-8">
                {articleToEdit ? (
                     <HelpCenterArticleEditor 
                        key={articleToEdit.id}
                        article={articleToEdit} 
                        onSave={onSaveArticle}
                        allUsers={allUsers}
                        appUser={appUser!}
                     />
                ) : (
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold">No Articles Yet</h2>
                        <p className="text-muted-foreground">Create your first article to get started.</p>
                        <Button onClick={handleCreateArticle} className="mt-4">New Article</Button>
                    </div>
                )}
            </main>
        </div>
    );
}
