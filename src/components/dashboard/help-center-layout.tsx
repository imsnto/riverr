
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
import { FolderPlus, Plus, Search, ChevronRight, Move, Link as LinkIcon } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import MoveToFolderDialog from './move-to-folder-dialog';
import AddToHelpCenterDialog from './add-to-help-center-dialog';
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
    const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
    const [isAddToHCOpen, setIsAddToHCOpen] = useState(false);
    const [isManageArticlesOpen, setIsManageArticlesOpen] = useState(false);

    
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
        title: '',
        content: '<h1></h1>',
        status: 'draft',
        folderId: sidebarView === 'library' ? selectedCollectionId : null,
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hubId: activeHub.id,
        type: 'article',
        audience: 'Everyone'
      };
      
      const newArticle = await addHelpCenterArticle(newArticleData);
      if (newArticle) {
        setArticles(prev => [...prev, newArticle]);
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
        setSelectedArticleId(null);
    }
    
    const handleSelectCollection = (id: string | null) => {
        setSelectedCollectionId(id);
        setSelectedArticleId(null);
    }

    const handleSelectHelpCenter = (id: string | null) => {
        setActiveHelpCenterId(id);
        setSelectedCollectionId(null);
        setSelectedArticleId(null);
    }

    const handleToggleSelectItem = (id: string) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
    
    const { combinedItems, title, breadcrumbs } = React.useMemo(() => {
        let foldersToShow: HelpCenterCollection[] = [];
        let articlesToShow: HelpCenterArticle[] = [];
        let breadcrumbs: HelpCenterCollection[] = [];
        let viewTitle = 'Knowledge Base';

        if (sidebarView === 'all-articles') {
            viewTitle = 'All Articles';
            articlesToShow = articles;
        } else if (sidebarView === 'help-centers' && activeHelpCenterId) {
            const hc = helpCenters.find(h => h.id === activeHelpCenterId);
            viewTitle = hc?.name || 'Help Center';
            foldersToShow = collections.filter(c => c.helpCenterIds?.includes(activeHelpCenterId));
        } else if (sidebarView === 'library') {
            if (selectedCollectionId) {
                const collection = collections.find(c => c.id === selectedCollectionId);
                viewTitle = collection?.name || 'Folder';
                
                let currentCollection = collection;
                while (currentCollection) {
                    breadcrumbs.unshift(currentCollection);
                    currentCollection = collections.find(c => c.id === currentCollection!.parentId);
                }

                foldersToShow = collections.filter(c => c.parentId === selectedCollectionId);
                articlesToShow = articles.filter(a => a.folderId === selectedCollectionId);

            } else {
                viewTitle = 'Content Library';
                foldersToShow = collections.filter(c => !c.parentId);
            }
        }
        
        return { combinedItems: [...foldersToShow, ...articlesToShow], title: viewTitle, breadcrumbs };

    }, [sidebarView, selectedCollectionId, activeHelpCenterId, articles, collections, helpCenters]);

    const handleToggleAll = () => {
        if (selectedItems.length === combinedItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(combinedItems.map(i => i.id));
        }
    }

    const handleMoveSelected = async (folderId: string | null) => {
        const promises = selectedItems.map(itemId => {
            const article = articles.find(a => a.id === itemId);
            if (article) {
                return updateHelpCenterArticle(itemId, { folderId });
            }
            const collection = collections.find(c => c.id === itemId);
            if (collection) {
                return updateHelpCenterCollection(itemId, { parentId: folderId });
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        toast({ title: `${selectedItems.length} item(s) moved.` });
        refreshData();
        setSelectedItems([]);
    };

    const handleAddToHelpCenters = async (helpCenterIds: string[]) => {
        const promises = selectedItems.map(itemId => {
            const article = articles.find(a => a.id === itemId);
            if (article) {
                return updateHelpCenterArticle(itemId, { helpCenterIds });
            }
            const collection = collections.find(c => c.id === itemId);
            if (collection) {
                return updateHelpCenterCollection(itemId, { helpCenterIds });
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        toast({ title: `Updated Help Center associations.` });
        refreshData();
        setSelectedItems([]);
    };

    const handleSaveArticlesToCollection = async (articleIds: string[]) => {
        if (!selectedCollectionId) return;

        // Get the list of articles that were originally in the folder
        const originalArticleIds = articles
            .filter(a => a.folderId === selectedCollectionId)
            .map(a => a.id);

        // Find which articles were added and which were removed
        const articlesToAdd = articleIds.filter(id => !originalArticleIds.includes(id));
        const articlesToRemove = originalArticleIds.filter(id => !articleIds.includes(id));

        const promises: Promise<void>[] = [];

        // Update folderId for added articles
        articlesToAdd.forEach(id => {
            promises.push(updateHelpCenterArticle(id, { folderId: selectedCollectionId }));
        });

        // Clear folderId for removed articles
        articlesToRemove.forEach(id => {
            promises.push(updateHelpCenterArticle(id, { folderId: null }));
        });

        if (promises.length > 0) {
            await Promise.all(promises);
            toast({ title: "Folder updated", description: `${articlesToAdd.length} article(s) added, ${articlesToRemove.length} removed.` });
            refreshData();
        }
        
        setIsManageArticlesOpen(false);
    };
    
    if (selectedArticleId) {
        const articleToEdit = articles.find(a => a.id === selectedArticleId);
        if (articleToEdit && appUser) {
             return (
                <div className="overflow-y-auto h-full">
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
    
    const selectedCollection = collections.find(c => c.id === selectedCollectionId);

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
                {sidebarView === 'library' && breadcrumbs.length > 0 && (
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
                        {sidebarView === 'library' && selectedCollectionId && (
                             <Button variant="outline" onClick={() => setIsManageArticlesOpen(true)}>
                                Manage Articles
                            </Button>
                        )}
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
                        <Button variant="secondary" size="sm" onClick={() => setIsMoveToFolderOpen(true)}>
                            <Move className="mr-2 h-4 w-4" /> Move...
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setIsAddToHCOpen(true)}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Add to Help Center...
                        </Button>
                     </div>
                 )}
                <div className="flex-1 -mx-4 md:-mx-6 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="px-4 md:px-6">
                        <HelpCenterArticleList
                            items={combinedItems}
                            onSelectItem={(id, type) => type === 'article' ? handleSelectArticle(id) : handleSelectCollection(id)}
                            selectedItems={selectedItems}
                            onToggleSelectItem={handleToggleSelectItem}
                            onToggleAll={handleToggleAll}
                            isAllSelected={combinedItems.length > 0 && selectedItems.length === combinedItems.length}
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
            <MoveToFolderDialog
                isOpen={isMoveToFolderOpen}
                onOpenChange={setIsMoveToFolderOpen}
                collections={collections}
                onMove={handleMoveSelected}
            />
            <AddToHelpCenterDialog
                isOpen={isAddToHCOpen}
                onOpenChange={setIsAddToHCOpen}
                helpCenters={helpCenters}
                selectedItems={combinedItems.filter(i => selectedItems.includes(i.id))}
                onSave={handleAddToHelpCenters}
            />
             {selectedCollection && (
                <AddArticlesToCollectionDialog
                    isOpen={isManageArticlesOpen}
                    onOpenChange={setIsManageArticlesOpen}
                    collection={selectedCollection}
                    allArticles={articles}
                    onSave={handleSaveArticlesToCollection}
                />
            )}
        </div>
    );
}
