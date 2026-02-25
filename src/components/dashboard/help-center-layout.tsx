// src/components/dashboard/help-center-layout.tsx
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
import { FolderPlus, Plus, Search, ChevronRight, Move, ArrowLeft, Trash2, Bot as BotIcon, Lock, Globe, Wand2, Upload, Loader2, Image as ImageIcon, Download, ExternalLink, HelpCircle, CheckCircle2, AlertCircle, MoreVertical, Star, Edit } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import HelpCenterFormDialog, { HelpCenterFormValues } from './help-center-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import MoveToFolderDialog from './move-to-folder-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn, getInitials } from '@/lib/utils';
import { reindexArticleAction, exportLibraryAction, importLibraryAction } from '@/app/actions/chat';
import { verifyCustomDomainDns } from '@/app/actions/dns';
import { suggestLibraryIcon } from '@/ai/flows/suggest-library-icon';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import AddArticlesToLibraryDialog from './add-articles-to-collection-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import Image from 'next/image';
import { generateCoverImage } from '@/ai/flows/generate-cover-image';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';

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
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const [isAddArticlesOpen, setIsAddArticlesOpen] = useState(false);

    const [deletingHelpCenter, setDeletingHelpCenter] = useState<HelpCenter | null>(null);
    const [isLibraryDeleteDialogOpen, setIsLibraryDeleteDialogOpen] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
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
            collectionsToShow = []; 
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
        const helpCenterId = sidebarView === 'knowledge-bases' ? activeHelpCenterId || '' : '';

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
        title: '',
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
        visibility: 'public',
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
    
        if (selectedCollectionId && collectionsToDelete.includes(selectedCollectionId)) {
            const currentCollection = collections.find(c => c.id === selectedCollectionId);
            setSelectedCollectionId(currentCollection?.parentId || null);
        }

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
        setIsBulkDeleteDialogOpen(false);
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

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/json') {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select a valid JSON export file.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (!data.helpCenter || !data.collections || !data.articles) {
                    throw new Error("Invalid export file format.");
                }
                if (!activeHub || !activeSpace || !appUser) {
                    toast({ variant: 'destructive', title: 'Cannot import', description: 'No active workspace context.' });
                    return;
                }
                toast({ title: "Importing library...", description: "This may take a moment." });
                await importLibraryAction(activeHub.id, activeSpace.id, appUser.id, data);
                toast({ title: "Import Successful!", description: `"${data.helpCenter.name}" has been imported.` });
                refreshData();
            } catch (error) {
                console.error("Import failed:", error);
                toast({ variant: 'destructive', title: 'Import Failed', description: 'The file could not be read or is corrupted.' });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
    
    const handleExport = async (helpCenterId: string) => {
        try {
            const data = await exportLibraryAction(helpCenterId);
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(data, null, 2)
            )}`;
            const link = document.createElement("a");
            link.href = jsonString;
            const fileName = `manowar-library-export-${data.helpCenter.name.toLowerCase().replace(/\s/g, '-')}.json`;
            link.download = fileName;
            link.click();
            toast({ title: "Export Started", description: "Your download will begin shortly." });
        } catch (error) {
            console.error("Export failed:", error);
            toast({ variant: 'destructive', title: 'Export Failed' });
        }
    };
    
    const handleDeleteLibraryClick = (hc: HelpCenter) => {
        setDeletingHelpCenter(hc);
        setIsLibraryDeleteDialogOpen(true);
    };

    const handleDeleteLibrary = async () => {
        if (!deletingHelpCenter) return;
        try {
            await db.deleteHelpCenter(deletingHelpCenter.id);
            toast({ title: "Library deleted" });
            if (activeHelpCenterId === deletingHelpCenter.id) {
                const remainingLibraries = helpCenters.filter(hc => hc.id !== deletingHelpCenter.id);
                setActiveHelpCenterId(remainingLibraries.length > 0 ? remainingLibraries[0].id : null);
            }
            setDeletingHelpCenter(null);
            setIsLibraryDeleteDialogOpen(false);
            setEditingHelpCenter(null);
            refreshData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to delete library' });
            console.error(error);
        }
    };

    const articleToEdit = articles.find(a => a.id === selectedArticleId);
    if (articleToEdit && appUser) {
         return (
            <div className="overflow-y-auto h-full">
                <HelpCenterArticleEditor 
                   key={articleToEdit.id}
                   article={articleToEdit} 
                   allArticles={articles}
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
                onBack={() => setEditingHelpCenter(null)}
                onSave={handleSaveHelpCenter}
                onExport={handleExport}
                onDelete={handleDeleteLibraryClick}
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
            onImport={handleImportClick}
        />
    );

    const mainContentComponent = (
        <main className="p-4 md:p-6 flex flex-col h-full overflow-hidden">
            <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleFileSelected} />
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
            <div className="flex flex-col md:flex-row justify-between md:items-start mb-4 gap-4 shrink-0">
                <div className='flex-1 min-w-0'>
                    <h1 className="text-3xl font-bold leading-tight truncate">
                        {title}
                    </h1>

                    {sidebarView === 'knowledge-bases' && activeHelpCenter && (
                        <div className="flex items-center gap-3 mt-3 flex-nowrap">
                            <div className="flex items-center gap-1.5 shrink-0 bg-muted/50 px-2.5 py-1 rounded-md border text-xs text-muted-foreground">
                                {activeHelpCenter.visibility === 'internal' ? (
                                    <><Lock className="h-3.5 w-3.5" /> <span className="font-medium">Internal</span></>
                                ) : (
                                    <><Globe className="h-3.5 w-3.5" /> <span className="font-medium">Public</span></>
                                )}
                            </div>

                            <Separator orientation="vertical" className="h-4 bg-border/50" />

                            <div className="flex items-center gap-2 overflow-hidden bg-muted/50 px-2.5 py-1 rounded-md border text-xs text-muted-foreground shrink-0">
                                <div className="flex items-center gap-1.5 shrink-0 pr-2">
                                    <BotIcon className="h-3.5 w-3.5" />
                                    <span className="font-medium">Agents</span>
                                </div>
                                {connectedAgents.length > 0 ? (
                                    <div className="flex items-center -space-x-1.5 shrink-0">
                                        <TooltipProvider>
                                            {connectedAgents.slice(0, 3).map(agent => (
                                                <Tooltip key={agent.id}>
                                                    <TooltipTrigger asChild>
                                                        <Avatar className="h-5 w-5 border-2 border-background ring-1 ring-border/50">
                                                            <AvatarImage src={agent.styleSettings?.logoUrl} />
                                                            <AvatarFallback className="bg-muted">
                                                                <BotIcon className="h-3 w-3"/>
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{agent.name}</p></TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </TooltipProvider>
                                        {connectedAgents.length > 3 && (
                                            <Avatar className="h-5 w-5 border-2 border-background ring-1 ring-border/50 bg-muted">
                                                <AvatarFallback className="text-[8px]">+{connectedAgents.length - 3}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ) : (
                                    <span className="italic opacity-60">None</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                 <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {sidebarView === 'knowledge-bases' && activeHelpCenterId && !selectedCollectionId && (
                        <Button variant="outline" size="sm" onClick={() => setIsAddArticlesOpen(true)}>Add Articles</Button>
                    )}
                    {sidebarView === 'knowledge-bases' && (
                        <Button variant="outline" size="sm" onClick={() => handleNewCollection(selectedCollectionId || undefined)}>
                            <FolderPlus className="mr-2 h-4 w-4" /> New Collection
                        </Button>
                    )}
                    <Button onClick={handleCreateArticle} className="hidden md:flex">
                        <Plus className="mr-2 h-4 w-4" /> New Article
                    </Button>
                </div>
            </div>
             <div className="flex justify-between items-center mb-4 gap-2 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-9 h-9" />
                </div>
             </div>
             {selectedItems.length > 0 && (
                 <div className="flex items-center gap-2 mb-4 p-2 border rounded-md bg-muted/50 shrink-0">
                    <span className="text-sm font-medium">{selectedItems.length} item(s) selected</span>
                    <Button variant="secondary" size="sm" onClick={() => setIsMoveToFolderOpen(true)}>
                        <Move className="mr-2 h-4 w-4" /> Move...
                    </Button>
                     <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteDialogOpen(true)}>
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
             {isMobile && (
                <Button className="absolute bottom-24 right-4 h-14 w-14 rounded-full shadow-lg" onClick={handleCreateArticle}>
                   <Plus className="h-6 w-6" />
                </Button>
            )}
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
        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete {selectedItems.length} item(s) and any nested content.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelectedItems} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isLibraryDeleteDialogOpen} onOpenChange={(open) => {
                setIsLibraryDeleteDialogOpen(open)
                if (!open) { setDeletingHelpCenter(null); }
            }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the library "{deletingHelpCenter?.name}" and all of its collections and articles. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteLibrary} className={cn(buttonVariants({ variant: "destructive" }))}>Delete Library</AlertDialogAction>
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
        <div className="grid grid-cols-1 md:grid-cols-[288px_1fr] md:h-full overflow-hidden">
            {sidebarComponent}
            {mainContentComponent}
            {dialogs}
        </div>
    );
}

const LibrarySettingsPage = ({ helpCenter, onBack, onSave, onExport, onDelete }: { helpCenter: HelpCenter, onBack: () => void, onSave: (data: Partial<HelpCenter>) => void, onExport: (helpCenterId: string) => void, onDelete: (hc: HelpCenter) => void }) => {
    const [name, setName] = useState(helpCenter.name);
    const [visibility, setVisibility] = useState(helpCenter.visibility || 'public');
    const [coverImageUrl, setCoverImageUrl] = useState(helpCenter.coverImageUrl || '');
    const [customDomain, setCustomDomain] = useState(helpCenter.customDomain || '');
    const [primaryDomainType, setPrimaryDomainType] = useState<'default' | 'custom'>(helpCenter.primaryDomainType || 'default');
    const [isAddingDomain, setIsAddingDomain] = useState(false);
    
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startTransition] = useTransition();
    const [isUploading, setIsUploading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [dnsStatus, setDnsStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    
    const hasChanges = name !== helpCenter.name 
        || visibility !== helpCenter.visibility 
        || coverImageUrl !== (helpCenter.coverImageUrl || '')
        || customDomain !== (helpCenter.customDomain || '')
        || primaryDomainType !== (helpCenter.primaryDomainType || 'default');

    const handleSave = () => {
        onSave({ name, visibility, coverImageUrl, customDomain, primaryDomainType });
        toast({ title: "Library settings saved." });
    }

    const handleVerifyDns = async () => {
        if (!customDomain) return;
        setIsVerifying(true);
        try {
            const result = await verifyCustomDomainDns(customDomain);
            setDnsStatus(result.success ? 'valid' : 'invalid');
            if (result.success) {
                toast({ title: "DNS Verified!", description: "Your custom domain is correctly configured." });
            } else {
                toast({ variant: 'destructive', title: "Verification Failed", description: result.error || "We couldn't verify your DNS records." });
            }
        } catch (error) {
            setDnsStatus('invalid');
            toast({ variant: 'destructive', title: "Verification Error", description: "An error occurred while checking DNS." });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !helpCenter) return;
        setIsUploading(true);
        try {
            const imageUrl = await db.uploadHelpCenterCoverImage(file, helpCenter.id);
            setCoverImageUrl(imageUrl);
        } catch (error) {
            console.error("Cover image upload failed:", error);
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload the cover image.' });
        } finally {
            setIsUploading(false);
        }
    };

     const handleGenerateImage = () => {
        if (!prompt.trim() || !helpCenter) return;
        startTransition(async () => {
            try {
                const result = await generateCoverImage(prompt);
                const res = await fetch(result.imageUrl);
                const blob = await res.blob();
                const file = new File([blob], `generated-cover-${Date.now()}.png`, { type: blob.type });
                const imageUrl = await db.uploadHelpCenterCoverImage(file, helpCenter.id);
                setCoverImageUrl(imageUrl);
                toast({ title: 'New cover image generated!' });
            } catch (e) {
                console.error('Image generation failed', e);
                toast({ variant: 'destructive', title: 'Image generation failed.' });
            }
        });
    };

    const defaultUrl = `manowar.cloud/hc/${helpCenter.id}`;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Library</Button>
                <Button onClick={handleSave} disabled={!hasChanges}>Save Changes</Button>
            </div>
            <ScrollArea className="-mx-6 flex-1">
                <div className="px-6 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Library Details</CardTitle></CardHeader>
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

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Domains</CardTitle>
                                    <CardDescription>Manage the URLs for your public Help Center.</CardDescription>
                                </div>
                                {!customDomain && !isAddingDomain && (
                                    <Button size="sm" variant="outline" onClick={() => setIsAddingDomain(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Custom Domain
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="divide-y border rounded-lg overflow-hidden">
                                {/* Default Domain Row */}
                                <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Globe className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{defaultUrl}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Default Manowar Domain</p>
                                        </div>
                                        {primaryDomainType === 'default' && (
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/20">Primary</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link href={`/hc/${helpCenter.id}`} target="_blank" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "h-8 w-8")}>
                                            <ExternalLink className="h-4 w-4" />
                                        </Link>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setPrimaryDomainType('default')} disabled={primaryDomainType === 'default'}>
                                                    <Star className="h-4 w-4 mr-2" /> Set as Primary
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                {/* Custom Domain Row */}
                                {customDomain && (
                                    <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                                <ShieldAlert className="h-4 w-4 text-indigo-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{customDomain}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custom Domain</p>
                                                    {dnsStatus === 'valid' ? (
                                                        <span className="flex items-center text-[9px] text-emerald-500 font-bold uppercase"><CheckCircle2 className="h-2.5 w-2.5 mr-1"/> Verified</span>
                                                    ) : (
                                                        <span className="flex items-center text-[9px] text-amber-500 font-bold uppercase"><AlertCircle className="h-2.5 w-2.5 mr-1"/> Setup Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                            {primaryDomainType === 'custom' && (
                                                <Badge variant="secondary" className="h-5 px-1.5 text-[9px] bg-primary/10 text-primary border-primary/20">Primary</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" className="h-8" onClick={handleVerifyDns} disabled={isVerifying}>
                                                {isVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify'}
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setPrimaryDomainType('custom')} disabled={primaryDomainType === 'custom'}>
                                                        <Star className="h-4 w-4 mr-2" /> Set as Primary
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setIsAddingDomain(true)}>
                                                        <Edit className="h-4 w-4 mr-2" /> Edit Domain
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => {
                                                        setCustomDomain('');
                                                        setPrimaryDomainType('default');
                                                        setDnsStatus('unchecked');
                                                    }} className="text-destructive">
                                                        <Trash2 className="h-4 w-4 mr-2" /> Remove Domain
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isAddingDomain && (
                                <div className="mt-4 p-4 border rounded-lg bg-muted/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="hc-domain">Custom Subdomain</Label>
                                        <Link href="/docs/custom-domains" className="text-xs text-primary hover:underline flex items-center gap-1">
                                            <HelpCircle className="h-3 w-3" /> Setup Instructions
                                        </Link>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input 
                                            id="hc-domain" 
                                            value={customDomain} 
                                            onChange={(e) => {
                                                setCustomDomain(e.target.value);
                                                setDnsStatus('unchecked');
                                            }} 
                                            placeholder="e.g., help.yourcompany.com"
                                            className="flex-1"
                                        />
                                        <Button size="sm" onClick={() => setIsAddingDomain(false)}>Done</Button>
                                    </div>
                                </div>
                            )}
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
                                    <Image src={coverImageUrl || '/defaultimage.png'} alt="Cover image preview" fill className="object-cover" />
                                </div>
                                <div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        Upload Image
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ai-prompt">Or generate with AI</Label>
                                    <div className="flex gap-2">
                                        <Input id="ai-prompt" placeholder="e.g., abstract blue waves, minimalist landscape" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                                        <Button onClick={handleGenerateImage} disabled={isGenerating || !prompt.trim()}>
                                            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                            <span className="sr-only">Generate</span>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     <Card>
                        <CardHeader>
                            <CardTitle>Export Library</CardTitle>
                            <CardDescription>Download a JSON file containing all collections and articles from this library.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" onClick={() => onExport(helpCenter.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                Export as JSON
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="border-destructive">
                        <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">Delete this library</p>
                                    <p className="text-sm text-muted-foreground">Once you delete a library, there is no going back. Please be certain.</p>
                                </div>
                                <Button variant="destructive" onClick={() => onDelete(helpCenter)}>Delete Library</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
        </div>
    );
};

function ShieldAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}
