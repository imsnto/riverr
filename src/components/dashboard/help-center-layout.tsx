'use client';
import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import HelpCenterSidebar, { HelpCenterSidebarView } from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User, Bot } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '../ui/button';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterArticleList from './help-center-article-list';
import { FolderPlus, Plus, Search, ChevronRight, Move, ArrowLeft, Trash2, Bot as BotIcon, Lock, Globe, Wand2, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import HelpCenterFormDialog, { HelpCenterFormValues } from './help-center-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import MoveToFolderDialog from './move-to-folder-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';
import { reindexArticleAction } from '@/app/actions/chat';
import { suggestLibraryIcon } from '@/ai/flows/suggest-library-icon';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import AddArticlesToLibraryDialog from './add-articles-to-collection-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import Image from 'next/image';
import { generateCoverImage } from '@/ai/flows/generate-cover-image';

interface HelpCenterLayoutProps {
    bots: Bot[];
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

export default function HelpCenterLayout({ bots }: HelpCenterLayoutProps) {
    const [sidebarView, setSidebarView] = useState<HelpCenterSidebarView>('knowledge-bases');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [activeHelpCenterId, setActiveHelpCenterId] = useState<string | null>(null);
    const [editingHelpCenter, setEditingHelpCenter] = useState<HelpCenter | null>(null);
    const { appUser, activeHub, activeSpace } = useAuth();
    
    const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
    const [collections, setCollections] = useState<HelpCenterCollection[]>([]);
    const [articles, setArticles] = useState<HelpCenterArticle[]>([]);
    
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<HelpCenterCollection | null>(null);
    
    const [isHCDialogOpen, setIsHCDialogOpen] = useState(false);
    
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAddArticlesOpen, setIsAddArticlesOpen] = useState(false);


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

    useEffect(() => {
        if (sidebarView === 'knowledge-bases' && !activeHelpCenterId && helpCenters.length > 0) {
            setActiveHelpCenterId(helpCenters[0].id);
        }
    }, [helpCenters, activeHelpCenterId, sidebarView]);
    
    const { combinedItems, title, breadcrumbs } = React.useMemo(() => {
        let collectionsToShow: HelpCenterCollection[] = [];
        let articlesToShow: HelpCenterArticle[] = [];
        let breadcrumbs: HelpCenterCollection[] = [];
        let viewTitle = 'Knowledge';

        if (sidebarView === 'all-articles') {
            viewTitle = 'All Content';
            articlesToShow = articles;
            collectionsToShow = collections;
        } else if (sidebarView === 'knowledge-bases' && activeHelpCenterId) {
            const hc = helpCenters.find(h => h.id === activeHelpCenterId);
            viewTitle = hc?.name || 'Library';

            if (selectedCollectionId) {
                const collection = collections.find(c => c.id === selectedCollectionId);
                viewTitle = collection?.name || 'Collection';
                
                let currentCollection = collection;
                while (currentCollection) {
                    breadcrumbs.unshift(currentCollection);
                    currentCollection = collections.find(c => c.id === currentCollection!.parentId);
                }

                collectionsToShow = collections.filter(c => c.parentId === selectedCollectionId);
                articlesToShow = articles.filter(a => a.folderId === selectedCollectionId);
            } else {
                 collectionsToShow = collections.filter(c => c.helpCenterId === activeHelpCenterId && !c.parentId);
                 articlesToShow = articles.filter(a => a.helpCenterId === activeHelpCenterId && !a.folderId);
            }
        } else if (sidebarView === 'inbox') {
            viewTitle = "Unassigned";
            articlesToShow = articles.filter(a => !a.helpCenterId);
            collectionsToShow = []; // No collections in this view
            breadcrumbs = [];
        }
        
        return { combinedItems: [...collectionsToShow, ...articlesToShow].sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)), title: viewTitle, breadcrumbs };

    }, [sidebarView, selectedCollectionId, activeHelpCenterId, articles, collections, helpCenters]);

    const unassignedCount = useMemo(() => articles.filter(a => !a.helpCenterId).length, [articles]);
    const unassignedArticles = useMemo(() => articles.filter(a => !a.helpCenterId), [articles]);
    
    const activeHelpCenter = helpCenters.find(hc => hc.id === activeHelpCenterId);
    
    const connectedAgents = useMemo(() => {
        if (!activeHelpCenterId) return [];
        return bots.filter(bot => bot.allowedHelpCenterIds?.includes(activeHelpCenterId));
    }, [bots, activeHelpCenterId]);

    const showContentOnMobile = () => {
        if (isMobile) {
            setMobileContentVisible(true);
        }
    };
    
    const handleSaveArticle = async (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>) => {
        if ('id' in article) {
          await db.updateHelpCenterArticle(article.id, article);
        }
        refreshData();
        reindexArticleAction(article.id).catch(console.error);
    };

    const handleNewCollection = (parentId?: string) => {
        setEditingCollection(null);
        setIsCollectionDialogOpen(true);
    };

    const handleEditCollection = (collection: HelpCenterCollection) => {
        setEditingCollection(collection);
        setIsCollectionDialogOpen(true);
    }
    
    const handleNewHelpCenter = () => {
        setIsHCDialogOpen(true);
    };

    const handleEditHelpCenter = (hc: HelpCenter) => {
        setEditingHelpCenter(hc);
    };

    const handleSaveHelpCenter = async (values: Partial<HelpCenter>) => {
        if (!editingHelpCenter) return;
        try {
            await db.updateHelpCenter(editingHelpCenter.id, values);
            toast({ title: "Library updated" });
            refreshData();
            // Optimistically update the editing state
            setEditingHelpCenter(prev => prev ? { ...prev, ...values } : null);
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to save Library" });
            console.error(e);
        }
    };
    
    const handleCreateHelpCenter = async (values: HelpCenterFormValues) => {
        if (!activeHub) {
            toast({ variant: "destructive", title: "Something went wrong." });
            return;
        }

        try {
            const { iconName } = await suggestLibraryIcon(values.name);
            const dataWithIcon = { ...values, hubId: activeHub.id, icon: iconName };
            await db.addHelpCenter(dataWithIcon);
            toast({ title: "Library created" });
            refreshData();
        } catch (e) {
            toast({ variant: "destructive", title: "Failed to create Library" });
            console.error(e);
        } finally {
            setIsHCDialogOpen(false);
        }
    };

    const handleSaveCollection = async (values: { name: string; description?: string }, collectionId?: string) => {
        if (!activeHub) {
            toast({ variant: 'destructive', title: 'Please select a knowledge base first.' });
            return;
        }
    
        const parentId = editingCollection ? editingCollection.parentId : selectedCollectionId;
    
        const helpCenterId = sidebarView === 'knowledge-bases' && activeHelpCenterId ? activeHelpCenterId : '';

        const data = {
            ...values,
            hubId: activeHub.id,
            parentId: parentId,
            helpCenterId: helpCenterId,
            updatedAt: new Date().toISOString(),
        };

        if (collectionId) {
            await db.updateHelpCenterCollection(collectionId, data);
            toast({ title: 'Collection updated.' });
        } else {
            await db.addHelpCenterCollection(data);
            toast({ title: 'Collection created.' });
        }
        refreshData();
        setIsCollectionDialogOpen(false);
    }
    
    const handleCreateArticle = async () => {
      if (!appUser || !activeHub || !activeSpace) {
          toast({ variant: 'destructive', title: 'Cannot create article without an active hub.'});
          return;
      };

      const newArticleData: Omit<HelpCenterArticle, 'id'> = {
        title: 'Untitled Article',
        subtitle: '',
        content: '<p></p>',
        status: 'draft',
        folderId: selectedCollectionId,
        helpCenterId: sidebarView === 'knowledge-bases' ? activeHelpCenterId || '' : '',
        authorId: appUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hubId: activeHub.id,
        spaceId: activeSpace.id,
        type: 'article',
        isPublic: false,
        allowedUserIds: [appUser.id],
        isAiIndexed: true,
        isSeoIndexed: false,
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
        setSelectedCollectionId(null);
        if (view !== 'knowledge-bases') {
            setActiveHelpCenterId(null);
        }
        setSelectedArticleId(null);
        setEditingHelpCenter(null);
        showContentOnMobile();
    }
    
    const handleSelectHelpCenter = (id: string | null) => {
        setActiveHelpCenterId(id);
        setSelectedCollectionId(null);
        setSelectedArticleId(null);
        setEditingHelpCenter(null);
        if (id) {
            handleViewChange('knowledge-bases');
        }
        showContentOnMobile();
    }

    const handleToggleSelectItem = (id: string) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    const handleToggleAll = () => {
        if (selectedItems.length === combinedItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(combinedItems.map(i => i.id));
        }
    }

    const handleMoveSelected = async (destination: { libraryId: string | null; folderId: string | null }) => {
        const { libraryId, folderId } = destination;
    
        const articlesToMove = selectedItems.filter(id => articles.some(a => a.id === id));
        const collectionsToMove = selectedItems.filter(id => collections.some(c => c.id === id));
    
        if (collectionsToMove.length > 0 && libraryId) {
            toast({ variant: "destructive", title: "Cannot move collections between libraries yet." });
            return;
        }
    
        const promises: Promise<any>[] = [];
    
        articlesToMove.forEach(articleId => {
            const updateData: Partial<HelpCenterArticle> = {
                helpCenterId: libraryId || '',
                folderId: folderId
            };
            promises.push(db.updateHelpCenterArticle(articleId, updateData));
        });
    
        collectionsToMove.forEach(collectionId => {
            promises.push(db.updateHelpCenterCollection(collectionId, { parentId: folderId }));
        });
    
        await Promise.all(promises);
        toast({ title: `${selectedItems.length} item(s) moved.` });
        refreshData();
        setSelectedItems([]);
        setIsMoveToFolderOpen(false);
    };
    
    const handleDeleteSelectedItems = async () => {
        const articlesToDelete = selectedItems.filter(id => articles.some(a => a.id === id));
        const collectionsToDelete = selectedItems.filter(id => collections.some(c => c.id === id));
    
        const promises: Promise<void>[] = [];
        articlesToDelete.forEach(id => {
            promises.push(db.deleteHelpCenterArticle(id));
            promises.push(reindexArticleAction(id).catch(console.error));
        });
        collectionsToDelete.forEach(id => promises.push(db.deleteHelpCenterCollection(id)));
    
        await Promise.all(promises);
        toast({ title: `${selectedItems.length} item(s) deleted.` });
        refreshData();
        setSelectedItems([]);
        setIsDeleteDialogOpen(false);
    };

    const handleDeleteArticle = async (articleId: string) => {
        await db.deleteHelpCenterArticle(articleId);
        await reindexArticleAction(articleId).catch(console.error);
        toast({ title: "Article deleted" });
        refreshData();
        setSelectedArticleId(null);
    };
    
    const handleAddArticlesToLibrary = async (articleIds: string[]) => {
        if (!activeHelpCenterId) return;

        const promises = articleIds.map(id => 
            db.updateHelpCenterArticle(id, { helpCenterId: activeHelpCenterId })
        );

        await Promise.all(promises);
        toast({ title: `${articleIds.length} article(s) added to the library.` });
        refreshData();
    };
    
    const articleToEdit = articles.find(a => a.id === selectedArticleId);
    if (articleToEdit && appUser) {
         return (
            <div className="overflow-y-auto h-full">
                <HelpCenterArticleEditor 
                   key={articleToEdit.id}
                   article={articleToEdit} 
                   onSave={handleSaveArticle}
                   allUsers={[]}
                   appUser={appUser}
                   onBack={() => setSelectedArticleId(null)}
                   onDelete={handleDeleteArticle}
                />
            </div>
        );
    }
    
    if (editingHelpCenter) {
      return <LibrarySettingsPage
                helpCenter={editingHelpCenter}
                onSave={handleSaveHelpCenter}
                onBack={() => setEditingHelpCenter(null)}
             />
    }
    
    const sidebarComponent = (
        <HelpCenterSidebar
            collections={collections}
            activeCollectionId={selectedCollectionId}
            onSelectCollection={(id) => {
                setSelectedCollectionId(id);
                setSelectedArticleId(null);
                setEditingHelpCenter(null);
                showContentOnMobile();
            }}
            onNewCollection={handleNewCollection}
            onEditCollection={handleEditCollection}
            helpCenters={helpCenters}
            activeHelpCenterId={activeHelpCenterId}
            onSelectHelpCenter={handleSelectHelpCenter}
            onNewHelpCenter={handleNewHelpCenter}
            onEditHelpCenter={handleEditHelpCenter}
            sidebarView={sidebarView}
            onViewChange={handleViewChange}
            unassignedContentCount={unassignedCount}
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
            {sidebarView === 'knowledge-bases' && breadcrumbs.length > 0 && !isMobile && (
                <Breadcrumbs crumbs={breadcrumbs} onCrumbClick={(id) => {
                    setSelectedCollectionId(id);
                }} />
            )}
            <div className="flex flex-wrap justify-between items-start mb-4 gap-x-4 gap-y-2">
                <div>
                    <h1 className="text-3xl font-bold leading-tight">
                        {title}
                    </h1>

                    {sidebarView === 'knowledge-bases' && activeHelpCenter && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {activeHelpCenter.visibility === 'internal' ? (
                                <div className="flex items-center gap-1.5">
                                    <Lock className="h-4 w-4" />
                                    <span>Internal</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Globe className="h-4 w-4" />
                                    <span>Public</span>
                                </div>
                            )}

                            <Separator orientation="vertical" className="h-4" />

                            <div className="flex items-center gap-2">
                                <BotIcon className="h-4 w-4" />
                                <span>Connected Agents:</span>
                                {connectedAgents.length > 0 ? (
                                    <div className="flex items-center -space-x-2">
                                        <TooltipProvider>
                                            {connectedAgents.slice(0, 3).map(agent => (
                                                <Tooltip key={agent.id}>
                                                    <TooltipTrigger asChild>
                                                        <Avatar className="h-6 w-6 border-2 border-background">
                                                            <AvatarImage src={agent.styleSettings?.logoUrl} />
                                                            <AvatarFallback>
                                                                <BotIcon className="h-3 w-3"/>
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{agent.name}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </TooltipProvider>
                                        {connectedAgents.length > 3 && (
                                            <Avatar className="h-6 w-6 border-2 border-background">
                                                <AvatarFallback>+{connectedAgents.length - 3}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ) : (
                                    <span>None</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                 <div className="flex items-center gap-2 flex-shrink-0">
                    {sidebarView === 'knowledge-bases' && activeHelpCenterId && !selectedCollectionId && (
                        <Button variant="outline" onClick={() => setIsAddArticlesOpen(true)}>
                            Add Articles
                        </Button>
                    )}
                    {sidebarView === 'knowledge-bases' && (
                        <Button variant="outline" onClick={() => handleNewCollection(selectedCollectionId || undefined)}>
                            <FolderPlus className="mr-2 h-4 w-4" /> New Collection
                        </Button>
                    )}
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
             </div>
             {selectedItems.length > 0 && (
                 <div className="flex items-center gap-2 mb-4 p-2 border rounded-md bg-muted/50">
                    <span className="text-sm font-medium">{selectedItems.length} item(s) selected</span>
                    <Button variant="secondary" size="sm" onClick={() => setIsMoveToFolderOpen(true)}>
                        <Move className="mr-2 h-4 w-4" /> Move...
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
                        onSelectItem={(id, type) => type === 'article' ? handleSelectArticle(id) : setSelectedCollectionId(id)}
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
            helpCenter={null}
            onSave={handleCreateHelpCenter}
        />
        <MoveToFolderDialog
            isOpen={isMoveToFolderOpen}
            onOpenChange={setIsMoveToFolderOpen}
            collections={collections}
            helpCenters={helpCenters}
            onMove={handleMoveSelected}
        />
        
        {activeHelpCenter && (
            <AddArticlesToLibraryDialog
                isOpen={isAddArticlesOpen}
                onOpenChange={setIsAddArticlesOpen}
                library={activeHelpCenter}
                unassignedArticles={unassignedArticles}
                onSave={handleAddArticlesToLibrary}
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

const LibrarySettingsPage = ({ helpCenter, onBack, onSave }: { helpCenter: HelpCenter, onBack: () => void, onSave: (data: Partial<HelpCenter>) => void}) => {
    const [name, setName] = useState(helpCenter.name);
    const [visibility, setVisibility] = useState(helpCenter.visibility || 'public');
    const [coverImageUrl, setCoverImageUrl] = useState(helpCenter.coverImageUrl || '');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const hasChanges = name !== helpCenter.name || visibility !== helpCenter.visibility || coverImageUrl !== helpCenter.coverImageUrl;

    const handleSave = () => {
        onSave({ name, visibility, coverImageUrl });
        toast({ title: "Library settings saved." });
    }

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setCoverImageUrl(dataUrl);
        };
        reader.readAsDataURL(file);
    };

     const handleGenerateImage = () => {
        if (!prompt.trim()) return;
        startTransition(async () => {
            try {
                const result = await generateCoverImage(prompt);
                setCoverImageUrl(result.imageUrl);
                toast({ title: 'New cover image generated!' });
            } catch (e) {
                toast({ variant: 'destructive', title: 'Image generation failed.' });
            }
        });
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Library</Button>
                <Button onClick={handleSave} disabled={!hasChanges}>Save Changes</Button>
            </div>
            
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Library Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="hc-name">Library Name</Label>
                            <Input id="hc-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Visibility</Label>
                            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as 'public' | 'internal')}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="public" id="r1" />
                                    <Label htmlFor="r1">Public</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="internal" id="r2" />
                                    <Label htmlFor="r2">Internal</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>
                
                {visibility === 'public' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Cover Image</CardTitle>
                            <CardDescription>Set the background image for the header of your public help center.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative aspect-video w-full rounded-lg border overflow-hidden bg-muted">
                                {coverImageUrl && <Image src={coverImageUrl} alt="Cover image preview" fill className="object-cover" />}
                            </div>
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ai-prompt">Or generate with AI</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="ai-prompt"
                                        placeholder="e.g., abstract blue waves, minimalist landscape"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                    <Button onClick={handleGenerateImage} disabled={isGenerating || !prompt.trim()}>
                                        {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                        <span className="sr-only">Generate</span>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
