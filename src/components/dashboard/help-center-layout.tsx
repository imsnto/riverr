'use client';
import React, { useState, useEffect } from 'react';
import HelpCenterSidebar from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import HelpCenterFormDialog from './help-center-form-dialog';
import { addHelpCenter, updateHelpCenter, getHelpCenterCollections, addHelpCenterCollection, updateHelpCenterCollection, deleteHelpCenterCollection, updateHelpCenterArticle } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterSettings from './help-center-settings';
import HelpCenterArticleList from './help-center-article-list';
import { ArrowLeft, FolderPlus, Plus } from 'lucide-react';
import HelpCenterCollectionsView from './help-center-collections-view';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import AddArticlesToCollectionDialog from './add-articles-to-collection-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface HelpCenterLayoutProps {
    helpCenters: HelpCenter[];
    articles: HelpCenterArticle[];
    allUsers: User[];
    onSaveArticle: (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>) => Promise<HelpCenterArticle | void>;
    onDataRefresh: () => void;
}

export default function HelpCenterLayout({ 
    helpCenters, 
    articles, 
    allUsers, 
    onSaveArticle, 
    onDataRefresh 
}: HelpCenterLayoutProps) {
    const [view, setView] = useState('all_articles');
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const { appUser, activeHub } = useAuth();
    const [activeHelpCenter, setActiveHelpCenter] = useState<HelpCenter | null>(helpCenters.length > 0 ? helpCenters[0] : null);
    const [collections, setCollections] = useState<HelpCenterCollection[]>([]);

    const [isHcDialogOpen, setIsHcDialogOpen] = useState(false);
    const [editingHelpCenter, setEditingHelpCenter] = useState<HelpCenter | null>(null);
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<HelpCenterCollection | null>(null);
    const [isAddArticlesDialogOpen, setIsAddArticlesDialogOpen] = useState(false);
    
    const isMobile = useIsMobile();
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
        if (activeHelpCenter) {
            getHelpCenterCollections(activeHelpCenter.id).then(setCollections);
        } else {
            setCollections([]);
        }
    }, [activeHelpCenter]);

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
            await updateHelpCenter(editingHelpCenter.id, { name });
            toast({ title: "Help Center updated."});
        } else {
            await addHelpCenter({ name, hubId: activeHub.id });
            toast({ title: "Help Center created."});
        }
        onDataRefresh();
        setIsHcDialogOpen(false);
        setEditingHelpCenter(null);
    };
    
    const handleCreateCollection = () => {
        setEditingCollection(null);
        setIsCollectionDialogOpen(true);
    };

    const handleEditCollection = (collection: HelpCenterCollection) => {
        setEditingCollection(collection);
        setIsCollectionDialogOpen(true);
    }

    const handleDeleteCollection = async (collectionId: string) => {
        await deleteHelpCenterCollection(collectionId);
        toast({ title: 'Collection deleted' });
        if (activeHelpCenter) {
            getHelpCenterCollections(activeHelpCenter.id).then(setCollections);
        }
    }

    const handleSaveCollection = async (values: { name: string; description?: string }, collectionId?: string) => {
        if (!activeHelpCenter) {
            toast({ variant: 'destructive', title: 'No active help center selected.' });
            return;
        }

        if (collectionId) {
            await updateHelpCenterCollection(collectionId, values);
            toast({ title: 'Collection updated.' });
        } else {
            await addHelpCenterCollection({ ...values, helpCenterId: activeHelpCenter.id });
            toast({ title: 'Collection created.' });
        }
        if (activeHelpCenter) {
            getHelpCenterCollections(activeHelpCenter.id).then(setCollections);
        }
        setIsCollectionDialogOpen(false);
    }

    const handleSelectCollection = (collection: HelpCenterCollection) => {
        setView(`collection_${collection.id}`);
        if(isMobile) setSelectedArticleId(null);
    };
    
    const handleSaveArticlesToCollection = async (finalArticleIdsInCollection: string[]) => {
        if (!activeHelpCenter || !view.startsWith('collection_') || !activeHub) return;
    
        const collectionId = view.split('_')[1];
        if (!collectionId) return;
    
        const hubArticles = articles.filter(a => a.hubId === activeHub.id);
        const updates: Promise<void>[] = [];
    
        hubArticles.forEach(article => {
            const isInCollection = article.collectionIds.includes(collectionId);
            const shouldBeInCollection = finalArticleIdsInCollection.includes(article.id);
    
            if (isInCollection && !shouldBeInCollection) {
                // Remove it
                const newCollectionIds = article.collectionIds.filter(id => id !== collectionId);
                updates.push(updateHelpCenterArticle(article.id, { collectionIds: newCollectionIds }));
            } else if (!isInCollection && shouldBeInCollection) {
                // Add it
                const newCollectionIds = [...article.collectionIds, collectionId];
                updates.push(updateHelpCenterArticle(article.id, { collectionIds: newCollectionIds }));
            }
        });
    
        await Promise.all(updates);
    
        toast({ title: 'Collection updated' });
        onDataRefresh();
        setIsAddArticlesDialogOpen(false);
    };


    const handleViewChange = (newView: string) => {
        setView(newView);
        setSelectedArticleId(null);
        if (isMobile) {
            setSelectedArticleId(null);
        }
    };
    
    const handleSelectArticle = (articleId: string) => {
        setSelectedArticleId(articleId);
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
        handleSelectArticle(newArticle.id);
      }
    };
    
    const renderContent = () => {
        if (view.startsWith('settings_')) {
            return <HelpCenterSettings helpCenter={activeHelpCenter} />;
        }
        
        if (view.startsWith('collections_')) {
            const hcId = view.split('_')[1];
            if (activeHelpCenter?.id === hcId) {
                return (
                    <HelpCenterCollectionsView 
                        collections={collections}
                        articles={articles}
                        onAdd={handleCreateCollection}
                        onEdit={handleEditCollection}
                        onDelete={handleDeleteCollection}
                        onSelectCollection={handleSelectCollection}
                    />
                );
            }
        }
        
        let listTitle = "All Articles";
        if (view === 'published') listTitle = "Published Articles";
        if (view === 'draft') listTitle = "Draft Articles";
        if (view.startsWith('collection_') && !view.startsWith('collections_')) {
            const collectionId = view.split('_')[1];
            const collection = collections.find(c => c.id === collectionId);
            listTitle = collection ? `Collection: ${collection.name}` : "Collection";
        }
        
        const filteredArticles = articles.filter(article => {
            const inActiveHc = activeHelpCenter ? article.helpCenterId === activeHelpCenter.id : true;
            if (!inActiveHc) return false;

            if (view === 'published') return article.status === 'published';
            if (view === 'draft') return article.status === 'draft';
            if (view.startsWith('collection_') && !view.startsWith('collections_')) {
                const collectionId = view.split('_')[1];
                return article.collectionIds.includes(collectionId);
            }
            return true; 
        });

        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">{listTitle}</h1>
                    <div className="flex items-center gap-2">
                         {view.startsWith('collection_') && !view.startsWith('collections_') && (
                            <Button variant="outline" onClick={() => setIsAddArticlesDialogOpen(true)}>
                                <FolderPlus className="mr-2 h-4 w-4" /> Add Articles
                            </Button>
                        )}
                        <Button onClick={handleCreateArticle}>
                            <Plus className="mr-2 h-4 w-4" /> New Article
                        </Button>
                    </div>
                </div>
                <HelpCenterArticleList
                    articles={filteredArticles}
                    onSelectArticle={handleSelectArticle}
                />
            </div>
        );
    }
    
    if (selectedArticleId) {
        const articleToEdit = articles.find(a => a.id === selectedArticleId);
        if (articleToEdit) {
             return (
                <div className="overflow-y-auto p-4 md:p-8 h-full">
                    <HelpCenterArticleEditor 
                       key={articleToEdit.id}
                       article={articleToEdit} 
                       onSave={(article) => onSaveArticle(article)}
                       allUsers={allUsers}
                       appUser={appUser!}
                       onBack={() => setSelectedArticleId(null)}
                    />
                </div>
            );
        }
        // If article not found (e.g., after deletion), reset the view
        setSelectedArticleId(null);
    }

    return (
        <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
            <HelpCenterSidebar
                helpCenters={helpCenters}
                activeHelpCenter={activeHelpCenter}
                onSelectHelpCenter={setActiveHelpCenter}
                collections={collections}
                activeView={view}
                onViewChange={handleViewChange}
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
             <HelpCenterCollectionFormDialog
                isOpen={isCollectionDialogOpen}
                onOpenChange={setIsCollectionDialogOpen}
                onSave={handleSaveCollection}
                collection={editingCollection}
            />
            {view.startsWith('collection_') && !view.startsWith('collections_') && collections.find(c => c.id === view.split('_')[1]) && activeHub && (
                <AddArticlesToCollectionDialog
                    isOpen={isAddArticlesDialogOpen}
                    onOpenChange={setIsAddArticlesDialogOpen}
                    collection={collections.find(c => c.id === view.split('_')[1])!}
                    allArticles={articles.filter(a => a.hubId === activeHub.id)}
                    onSave={handleSaveArticlesToCollection}
                />
            )}
        </div>
    );
}