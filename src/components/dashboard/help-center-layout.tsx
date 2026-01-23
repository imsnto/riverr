'use client';
import React, { useState, useEffect } from 'react';
import HelpCenterSidebar, { HelpCenterSidebarView } from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { addHelpCenterCollection, updateHelpCenterCollection, getHelpCenterCollections, getHelpCenterArticles, addHelpCenterArticle, getHelpCenters, updateHelpCenterArticle } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterArticleList from './help-center-article-list';
import { FolderPlus, Plus, Search, ChevronRight } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import AddArticlesToCollectionDialog from './add-articles-to-collection-dialog';

interface HelpCenterLayoutProps {
    onSaveArticle: (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>) => Promise<HelpCenterArticle | void>;
}

const Breadcrumbs = ({ crumbs, onCrumbClick }: { crumbs: HelpCenterCollection[], onCrumbClick: (id: string | null) => void }) => {
    return (
        <nav className="flex items-center text-sm text-muted-foreground mb-4">
            <Button variant="link" className="p-0 h-auto text-muted-foreground" onClick={() => onCrumbClick(null)}>Content Library</Button>
            {crumbs.map(crumb => (
                <React.Fragment key={crumb.id}>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <Button variant="link" className="p-0 h-auto text-muted-foreground" onClick={() => onCrumbClick(crumb.id)}>{crumb.name}</Button>
                </React.Fragment>
            ))}
        </nav>
    );
}

export default function HelpCenterLayout({ 
    onSaveArticle, 
}: HelpCenterLayoutProps) {
    const [sidebarView, setSidebarView] = useState<HelpCenterSidebarView>('library');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [activeHelpCenterId, setActiveHelpCenterId] = useState<string | null>(null);
    const { appUser, activeHub } = useAuth();
    
    const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
    const [collections, setCollections] = useState<HelpCenterCollection[]>([]);
    const [articles, setArticles] = useState<HelpCenterArticle[]>([]);
    
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<HelpCenterCollection | null>(null);
    
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [addArticlesToCollection, setAddArticlesToCollection] = useState<HelpCenterCollection | null>(null);
    
    const { toast } = useToast();

    useEffect(() => {
        if (activeHub) {
            refreshData();
        }
    }, [activeHub]);
    
    const refreshData = () => {
        if (activeHub) {
            getHelpCenters(activeHub.id).then(setHelpCenters);
            getHelpCenterCollections(activeHub.id).then(setCollections);
            getHelpCenterArticles(activeHub.id).then(setArticles);
        }
    }
    
    const handleNewCollection = (parentId?: string) => {
        setEditingCollection(null);
        setIsCollectionDialogOpen(true);
    };

    const handleEditCollection = (collection: HelpCenterCollection) => {
        setEditingCollection(collection);
        setIsCollectionDialogOpen(true);
    }

    const handleSaveCollection = async (values: { name: string; description?: string }, collectionId?: string) => {
        if (!activeHub) {
            toast({ variant: 'destructive', title: 'No active hub selected.' });
            return;
        }

        const data = {
            ...values,
            hubId: activeHub.id,
            parentId: editingCollection ? editingCollection.parentId : (sidebarView === 'library' ? selectedCollectionId : null),
            helpCenterId: editingCollection ? editingCollection.helpCenterId : (sidebarView === 'help-centers' ? activeHelpCenterId : null),
        };

        if (collectionId) {
            await updateHelpCenterCollection(collectionId, data);
            toast({ title: 'Folder updated.' });
        } else {
            await addHelpCenterCollection(data);
            toast({ title: 'Folder created.' });
        }
        refreshData();
        setIsCollectionDialogOpen(false);
    }
    
    const handleCreateArticle = async () => {
      if (!appUser || !activeHub) return;
      const newArticleData: Omit<HelpCenterArticle, 'id'> = {
        title: 'New Untitled Article',
        content: '<h1>Start writing...</h1>',
        status: 'draft',
        collectionIds: sidebarView === 'library' && selectedCollectionId ? [selectedCollectionId] : [],
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hubId: activeHub.id,
        type: 'article',
        audience: 'Everyone'
      };
      
      const newArticle = await addHelpCenterArticle(newArticleData);
      if (newArticle) {
        refreshData();
        handleSelectArticle(newArticle.id);
      }
    };
    
    const handleSelectArticle = (articleId: string) => {
        setSelectedArticleId(articleId);
    }

    const handleViewChange = (view: HelpCenterSidebarView) => {
        setSidebarView(view);
        setSelectedCollectionId(null);
        setActiveHelpCenterId(null);
    }
    
    const handleSelectCollection = (id: string | null) => {
        setSelectedCollectionId(id);
    }

    const handleSelectHelpCenter = (id: string | null) => {
        setActiveHelpCenterId(id);
    }

    const handleToggleSelectItem = (id: string) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
    
    const { currentItems, title, breadcrumbs } = React.useMemo(() => {
        let items: (HelpCenterCollection | HelpCenterArticle)[] = [];
        let breadcrumbs: HelpCenterCollection[] = [];
        let viewTitle = 'Knowledge Base';

        if (sidebarView === 'all-articles') {
            viewTitle = 'All Articles';
            items = articles;
        } else if (sidebarView === 'help-centers' && activeHelpCenterId) {
            const hc = helpCenters.find(h => h.id === activeHelpCenterId);
            viewTitle = hc?.name || 'Help Center';
            items = collections.filter(c => c.helpCenterId === activeHelpCenterId && !c.parentId);
        } else if (sidebarView === 'library') {
            if (selectedCollectionId) {
                const folder = collections.find(c => c.id === selectedCollectionId);
                viewTitle = folder?.name || 'Folder';
                
                let currentFolder = folder;
                while (currentFolder) {
                    breadcrumbs.unshift(currentFolder);
                    currentFolder = collections.find(c => c.id === currentFolder!.parentId);
                }

                const subFolders = collections.filter(c => c.parentId === selectedCollectionId);
                const folderArticles = articles.filter(a => a.collectionIds && a.collectionIds.includes(selectedCollectionId));
                items = [...subFolders, ...folderArticles];
            } else {
                viewTitle = 'Content Library';
                items = collections.filter(c => c.helpCenterId === null && c.parentId === null);
            }
        }
        
        return { currentItems: items, title: viewTitle, breadcrumbs };

    }, [sidebarView, selectedCollectionId, activeHelpCenterId, articles, collections, helpCenters]);

    const handleToggleAll = () => {
        if (selectedItems.length === currentItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(currentItems.map(i => i.id));
        }
    }

    const handleAddArticlesToCollection = async (articleIds: string[]) => {
      if (!addArticlesToCollection) return;
      
      const collectionId = addArticlesToCollection.id;
      
      const articlesToAdd = articleIds.filter(id => !articles.find(a => a.id === id)?.collectionIds?.includes(collectionId));
      const articlesToRemove = articles
        .filter(a => a.collectionIds?.includes(collectionId) && !articleIds.includes(a.id))
        .map(a => a.id);

      const promises: Promise<void>[] = [];

      articlesToAdd.forEach(articleId => {
        const article = articles.find(a => a.id === articleId);
        if (article) {
            const newCollectionIds = [...(article.collectionIds || []), collectionId];
            promises.push(updateHelpCenterArticle(articleId, { collectionIds: newCollectionIds }));
        }
      });
      
      articlesToRemove.forEach(articleId => {
        const article = articles.find(a => a.id === articleId);
        if (article) {
          const newCollectionIds = article.collectionIds.filter(id => id !== collectionId);
          promises.push(updateHelpCenterArticle(articleId, { collectionIds: newCollectionIds }));
        }
      });
      
      await Promise.all(promises);
      toast({ title: `Updated articles in "${addArticlesToCollection.name}"` });
      refreshData();
    };
    
    if (selectedArticleId) {
        const articleToEdit = articles.find(a => a.id === selectedArticleId);
        if (articleToEdit && appUser) {
             return (
                <div className="overflow-y-auto p-4 md:p-8 h-full">
                    <HelpCenterArticleEditor 
                       key={articleToEdit.id}
                       article={articleToEdit} 
                       onSave={async (article) => { 
                           await onSaveArticle(article);
                           refreshData();
                       }}
                       allUsers={[]}
                       appUser={appUser}
                       onBack={() => setSelectedArticleId(null)}
                    />
                </div>
            );
        }
        setSelectedArticleId(null);
    }

    return (
        <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
            <HelpCenterSidebar
                collections={collections}
                activeCollectionId={selectedCollectionId}
                onSelectCollection={handleSelectCollection}
                onNewCollection={handleNewCollection}
                onEditCollection={handleEditCollection}
                helpCenters={helpCenters}
                activeHelpCenterId={activeHelpCenterId}
                onSelectHelpCenter={handleSelectHelpCenter}
                sidebarView={sidebarView}
                onViewChange={handleViewChange}
            />
            <main className="overflow-y-auto p-4 md:p-6 flex flex-col">
                {breadcrumbs.length > 0 && (
                    <Breadcrumbs crumbs={breadcrumbs} onCrumbClick={(id) => {
                        handleSelectCollection(id);
                        setSidebarView('library');
                    }} />
                )}
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">
                        {title}
                    </h1>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => handleNewCollection(selectedCollectionId || undefined)}>
                            <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                        </Button>
                        <Button onClick={handleCreateArticle}>
                            <Plus className="mr-2 h-4 w-4" /> New Article
                        </Button>
                    </div>
                </div>
                 <div className="flex justify-between items-center mb-4 gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." className="pl-9 h-9" />
                    </div>
                    <Button variant="outline">All types</Button>
                    <Button variant="outline">Filter</Button>
                 </div>
                 {selectedItems.length > 0 && (
                     <div className="flex items-center gap-2 mb-4 p-2 border rounded-md bg-muted/50">
                        <span className="text-sm font-medium">{selectedItems.length} item(s) selected</span>
                        <Button variant="secondary" size="sm">Change AI Agent state</Button>
                        <Button variant="secondary" size="sm">Change AI Copilot state</Button>
                     </div>
                 )}
                <div className="flex-1 -mx-4 md:-mx-6 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="px-4 md:px-6">
                        <HelpCenterArticleList
                            items={currentItems}
                            onSelectItem={(id, type) => type === 'article' ? handleSelectArticle(id) : handleSelectCollection(id)}
                            selectedItems={selectedItems}
                            onToggleSelectItem={handleToggleSelectItem}
                            onToggleAll={handleToggleAll}
                            isAllSelected={currentItems.length > 0 && selectedItems.length === currentItems.length}
                        />
                      </div>
                    </ScrollArea>
                </div>
            </main>
            <HelpCenterCollectionFormDialog
                isOpen={isCollectionDialogOpen}
                onOpenChange={setIsCollectionDialogOpen}
                onSave={handleSaveCollection}
                collection={editingCollection}
                parentId={selectedCollectionId || undefined}
            />
            {addArticlesToCollection && (
                <AddArticlesToCollectionDialog
                    isOpen={!!addArticlesToCollection}
                    onOpenChange={() => setAddArticlesToCollection(null)}
                    collection={addArticlesToCollection}
                    allArticles={articles}
                    onSave={handleAddArticlesToCollection}
                />
            )}
        </div>
    );
}
