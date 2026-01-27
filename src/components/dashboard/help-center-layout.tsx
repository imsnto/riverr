
'use client';
import React, { useState, useEffect } from 'react';
import HelpCenterSidebar, { HelpCenterSidebarView } from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '../ui/button';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterArticleList from './help-center-article-list';
import { FolderPlus, Plus, Search, ChevronRight, Move, Link as LinkIcon, Library, ArrowLeft, DownloadCloud, Trash2 } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import HelpCenterFormDialog from './help-center-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import MoveToFolderDialog from './move-to-folder-dialog';
import AddToHelpCenterDialog from './add-to-help-center-dialog';
import AddArticlesToCollectionDialog from './add-articles-to-collection-dialog';
import ManageHelpCenterContentDialog from './manage-help-center-content-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';

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
    onSaveArticle: onSaveArticleProp, 
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
    
    const [isHCDialogOpen, setIsHCDialogOpen] = useState(false);
    const [editingHelpCenter, setEditingHelpCenter] = useState<HelpCenter | null>(null);

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
    const [isAddToHCOpen, setIsAddToHCOpen] = useState(false);
    const [isManageArticlesOpen, setIsManageArticlesOpen] = useState(false);
    const [isManageContentOpen, setIsManageContentOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


    const isMobile = useIsMobile();
    const [mobileContentVisible, setMobileContentVisible] = useState(false);
    
    const { toast } = useToast();
    
    const refreshData = () => {
        if (activeHub) {
            db.getHelpCenters(activeHub.id).then(setHelpCenters);
            db.getHelpCenterCollections(activeHub.id).then(setCollections);
            db.getHelpCenterArticles(activeHub.id).then(setArticles);
        }
    }

    useEffect(() => {
        if (activeHub) {
            refreshData();
        }
    }, [activeHub]);
    

    const showContentOnMobile = () => {
        if (isMobile) {
            setMobileContentVisible(true);
        }
    };

    const onSaveArticle = async (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>): Promise<void> => {
        let savedArticle: HelpCenterArticle;

        if ('id' in article && article.id) {
            await db.updateHelpCenterArticle(article.id, article);
            savedArticle = article as HelpCenterArticle;
        } else {
            savedArticle = await db.addHelpCenterArticle(article as Omit<HelpCenterArticle, 'id'>);
        }

        if (savedArticle.folderId) {
            try {
                await db.updateHelpCenterCollection(savedArticle.folderId, {
                    updatedAt: new Date().toISOString()
                });
            } catch (e) {
                console.error("Could not update parent folder timestamp", e);
            }
        }
        
        refreshData();
    };
    
    const handleNewCollection = (parentId?: string) => {
        setEditingCollection(null);
        setIsCollectionDialogOpen(true);
    };

    const handleEditCollection = (collection: HelpCenterCollection) => {
        setEditingCollection(collection);
        setIsCollectionDialogOpen(true);
    }
    
    const handleEditHelpCenter = (hc: HelpCenter) => {
        setEditingHelpCenter(hc);
        setIsHCDialogOpen(true);
    };

    const handleSaveHelpCenter = async (name: string) => {
        if (!editingHelpCenter || !activeHub) {
            toast({ variant: "destructive", title: "Something went wrong." });
            return;
        }

        try {
            await db.updateHelpCenter(editingHelpCenter.id, { name });
            toast({ title: "Knowledge Base updated" });
            refreshData();
            if (activeHelpCenterId === editingHelpCenter.id) {
                setActiveHelpCenterId(editingHelpCenter.id);
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to update Knowledge Base" });
        } finally {
            setIsHCDialogOpen(false);
            setEditingHelpCenter(null);
        }
    };

    const handleSaveCollection = async (values: { name: string; description?: string }, collectionId?: string) => {
        if (!activeHub) {
            toast({ variant: 'destructive', title: 'No active hub selected.' });
            return;
        }

        const data = {
            ...values,
            hubId: activeHub.id,
            parentId: editingCollection ? editingCollection.parentId : (sidebarView === 'library' ? selectedCollectionId : null),
            updatedAt: new Date().toISOString(),
        };

        if (collectionId) {
            await db.updateHelpCenterCollection(collectionId, data);
            toast({ title: 'Folder updated.' });
        } else {
            await db.addHelpCenterCollection(data);
            toast({ title: 'Folder created.' });
        }
        refreshData();
        setIsCollectionDialogOpen(false);
    }
    
    const handleCreateArticle = async () => {
      if (!appUser || !activeHub) return;
      const newArticleData: Omit<HelpCenterArticle, 'id'> = {
        title: '',
        subtitle: '',
        content: '<h1></h1>',
        status: 'draft',
        folderId: sidebarView === 'library' ? selectedCollectionId : null,
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hubId: activeHub.id,
        type: 'article',
        isPublic: true,
        allowedUserIds: [],
      };
      
      const newArticle = await db.addHelpCenterArticle(newArticleData);
      if (newArticle) {
        if (newArticle.folderId) {
            await db.updateHelpCenterCollection(newArticle.folderId, { updatedAt: new Date().toISOString() });
        }
        setArticles(prev => [...prev, newArticle]);
        setSelectedArticleId(newArticle.id);
        refreshData();
        showContentOnMobile();
      }
    };
    
    const handleSelectArticle = (articleId: string) => {
        const article = articles.find(a => a.id === articleId);
        if (article) {
             setSelectedArticleId(article.id);
             refreshData();
             showContentOnMobile();
        }
    }

    const handleViewChange = (view: HelpCenterSidebarView) => {
        setSidebarView(view);
        // Only reset selections if the view type is changing
        if (view !== 'library') {
            setSelectedCollectionId(null);
        }
        if (view !== 'knowledge-bases') {
            setActiveHelpCenterId(null);
        }
        setSelectedArticleId(null);
        showContentOnMobile();
    }
    
    const handleSelectCollection = (id: string | null) => {
        setSelectedCollectionId(id);
        setSelectedArticleId(null);
        showContentOnMobile();
    }

    const handleSelectHelpCenter = (id: string | null) => {
        setActiveHelpCenterId(id);
        setSelectedCollectionId(null);
        setSelectedArticleId(null);
        showContentOnMobile();
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
        } else if (sidebarView === 'knowledge-bases' && activeHelpCenterId) {
            const hc = helpCenters.find(h => h.id === activeHelpCenterId);
            viewTitle = hc?.name || 'Knowledge Base';
            foldersToShow = collections.filter(c => c.helpCenterIds?.includes(activeHelpCenterId));
            articlesToShow = articles.filter(a => a.helpCenterIds?.includes(activeHelpCenterId));
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
                articlesToShow = articles.filter(a => !a.folderId);
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
                return db.updateHelpCenterArticle(itemId, { folderId });
            }
            const collection = collections.find(c => c.id === itemId);
            if (collection) {
                return db.updateHelpCenterCollection(itemId, { parentId: folderId });
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        toast({ title: `${selectedItems.length} item(s) moved.` });
        refreshData();
        setSelectedItems([]);
    };
    
    const handleDeleteSelectedItems = async () => {
        const articlesToDelete = selectedItems.filter(id => articles.some(a => a.id === id));
        const collectionsToDelete = selectedItems.filter(id => collections.some(c => c.id === id));
    
        const promises: Promise<void>[] = [];
        articlesToDelete.forEach(id => promises.push(db.deleteHelpCenterArticle(id)));
        collectionsToDelete.forEach(id => promises.push(db.deleteHelpCenterCollection(id)));
    
        await Promise.all(promises);
        toast({ title: `${selectedItems.length} item(s) deleted.` });
        refreshData();
        setSelectedItems([]);
        setIsDeleteDialogOpen(false);
    };

    const handleDeleteArticle = async (articleId: string) => {
        await db.deleteHelpCenterArticle(articleId);
        toast({ title: "Article deleted" });
        refreshData();
        setSelectedArticleId(null);
    };

    const handleAddToHelpCenters = async (helpCenterIds: string[]) => {
        const promises = selectedItems.map(itemId => {
            const article = articles.find(a => a.id === itemId);
            if (article) {
                return db.updateHelpCenterArticle(itemId, { helpCenterIds });
            }
            const collection = collections.find(c => c.id === itemId);
            if (collection) {
                return db.updateHelpCenterCollection(itemId, { helpCenterIds });
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        toast({ title: `Updated Knowledge Base associations.` });
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
            promises.push(db.updateHelpCenterArticle(id, { folderId: selectedCollectionId }));
        });

        // Clear folderId for removed articles
        articlesToRemove.forEach(id => {
            promises.push(db.updateHelpCenterArticle(id, { folderId: null }));
        });

        if (promises.length > 0) {
            await Promise.all(promises);
            toast({ title: "Folder updated", description: `${articlesToAdd.length} article(s) added, ${articlesToRemove.length} removed.` });
            refreshData();
        }
        
        setIsManageArticlesOpen(false);
    };

    const handleManageContentSave = async (selectedIds: { articles: string[], collections: string[] }) => {
        if (!activeHelpCenterId) return;

        try {
            await db.updateHelpCenterContent(activeHelpCenterId, selectedIds, articles, collections);
            toast({ title: "Knowledge Base content updated" });
            refreshData();
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Failed to update content" });
        }
    };
    
    const articleToEdit = articles.find(a => a.id === selectedArticleId);
    if (articleToEdit && appUser) {
         return (
            <div className="overflow-y-auto h-full">
                <HelpCenterArticleEditor 
                   key={articleToEdit.id}
                   article={articleToEdit} 
                   onSave={async (article) => { 
                       await onSaveArticle(article as HelpCenterArticle);
                       refreshData();
                   }}
                   allUsers={[]}
                   appUser={appUser}
                   onBack={() => setSelectedArticleId(null)}
                   onDelete={handleDeleteArticle}
                />
            </div>
        );
    }
    
    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    const activeHelpCenter = helpCenters.find(hc => hc.id === activeHelpCenterId);

    const sidebarComponent = (
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
            onEditHelpCenter={handleEditHelpCenter}
        />
    );

    const mainContentComponent = (
        <main className="p-4 md:p-6 flex flex-col h-full overflow-hidden">
            {isMobile && (
                 <div className="flex-shrink-0">
                     <Button variant="ghost" onClick={() => setMobileContentVisible(false)} className="-ml-2 mb-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Menu
                    </Button>
                </div>
            )}
            {sidebarView === 'library' && breadcrumbs.length > 0 && !isMobile && (
                <Breadcrumbs crumbs={breadcrumbs} onCrumbClick={(id) => {
                    handleSelectCollection(id);
                    setSidebarView('library');
                }} />
            )}
            <div className="flex flex-wrap justify-between items-start mb-4 gap-x-4 gap-y-2">
                <h1 className="text-3xl font-bold leading-tight">
                    {title}
                </h1>
                 <div className="flex items-center gap-2 flex-shrink-0">
                    {sidebarView === 'knowledge-bases' && activeHelpCenterId ? (
                         <Button variant="outline" onClick={() => setIsManageContentOpen(true)}>
                            <Library className="mr-2 h-4 w-4" /> Manage Content
                        </Button>
                    ) : (
                        <>
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
                        </>
                    )}
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
                        <LinkIcon className="mr-2 h-4 w-4" /> Add to Knowledge Base...
                    </Button>
                     <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                 </div>
             )}
            <div className="flex-1 -mx-4 md:-mx-6 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="px-4 md:px-6">
                    <HelpCenterArticleList
                        items={combinedItems}
                        helpCenters={helpCenters}
                        onSelectItem={(id, type) => type === 'article' ? handleSelectArticle(id) : handleSelectCollection(id)}
                        selectedItems={selectedItems}
                        onToggleSelectItem={handleToggleSelectItem}
                        onToggleAll={handleToggleAll}
                        isAllSelected={combinedItems.length > 0 && selectedItems.length === combinedItems.length}
                        isMobile={isMobile}
                    />
                  </div>
                </ScrollArea>
            </div>
        </main>
    );

    const dialogs = (
      <>
        <HelpCenterCollectionFormDialog
            isOpen={isCollectionDialogOpen}
            onOpenChange={setIsCollectionDialogOpen}
            onSave={handleSaveCollection}
            collection={editingCollection}
            parentId={selectedCollectionId || undefined}
        />
         <HelpCenterFormDialog
            isOpen={isHCDialogOpen}
            onOpenChange={setIsHCDialogOpen}
            helpCenter={editingHelpCenter}
            onSave={handleSaveHelpCenter}
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
        {activeHelpCenter && (
            <ManageHelpCenterContentDialog
                isOpen={isManageContentOpen}
                onOpenChange={setIsManageContentOpen}
                helpCenter={activeHelpCenter}
                allArticles={articles}
                allCollections={collections}
                onSave={handleManageContentSave}
            />
        )}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete {selectedItems.length} item(s) and any nested content.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteSelectedItems}
                        className={cn(buttonVariants({ variant: "destructive" }))}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );

    if (isMobile) {
        return (
            <div className="h-full overflow-hidden">
                {mobileContentVisible ? mainContentComponent : sidebarComponent}
                {dialogs}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-[288px_1fr] md:h-full">
            {sidebarComponent}
            {mainContentComponent}
            {dialogs}
        </div>
    );
}
