// src/components/dashboard/help-center-layout.tsx
'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import HelpCenterSidebar, { HelpCenterSidebarView } from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User, Bot, Topic, Insight } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '../ui/button';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterArticleList from './help-center-article-list';
import { FolderPlus, Plus, Search, ChevronRight, Move, ArrowLeft, Trash2, Bot as BotIcon, Lock, Globe, Zap, Upload, ExternalLink, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import HelpCenterFormDialog, { HelpCenterFormValues } from './help-center-form-dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import MoveToFolderDialog from './move-to-folder-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';
import { reindexArticleAction } from '@/app/actions/chat';
import SupportIntelligenceView from './support-intelligence-view';
import PatternsView from './patterns-view';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ImportDataDialog from './import-data-dialog';

interface HelpCenterLayoutProps {
    bots: Bot[];
    insights: Insight[];
    topics: Topic[];
}

export default function HelpCenterLayout({ bots, insights, topics }: HelpCenterLayoutProps) {
    const [sidebarView, setSidebarView] = useState<HelpCenterSidebarView | null>('topics');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [activeHelpCenterId, setActiveHelpCenterId] = useState<string | null>(null);
    const { appUser, activeHub, activeSpace } = useAuth();
    const allUsers: User[] = [];
    
    const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
    const [collections, setCollections] = useState<HelpCenterCollection[]>([]);
    const [articles, setArticles] = useState<HelpCenterArticle[]>([]);
    
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<HelpCenterCollection | null>(null);
    const [isHCDialogOpen, setIsHCDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isImportDataOpen, setIsImportDataOpen] = useState(false);

    const isMobile = useIsMobile();
    const [mobileContentVisible, setMobileContentVisible] = useState(false);
    const { toast } = useToast();
    
    const refreshData = () => {
        if (activeHub) {
            db.getHelpCenters(activeHub.id).then(hcs => {
                setHelpCenters(hcs);
            });
            db.getHelpCenterCollections(activeHub.id).then(setCollections);
            db.getHelpCenterArticles(activeHub.id).then(setArticles);
        }
    }

    useEffect(() => {
        refreshData();
    }, [activeHub, activeSpace]);

    const { combinedItems, title } = React.useMemo(() => {
        let collectionsToShow: HelpCenterCollection[] = [];
        let articlesToShow: HelpCenterArticle[] = [];
        let viewTitle = 'Knowledge';

        if (sidebarView === 'topics') {
            viewTitle = 'Topics';
        } else if (sidebarView === 'insights') {
            viewTitle = 'Insights';
        } else if (activeHelpCenterId) {
            const hc = helpCenters.find(h => h.id === activeHelpCenterId);
            viewTitle = hc?.name || 'Library';

            if (selectedCollectionId) {
                const collection = collections.find(c => c.id === selectedCollectionId);
                viewTitle = collection?.name || 'Collection';
                collectionsToShow = collections.filter(c => c.parentId === selectedCollectionId);
                articlesToShow = articles.filter(a => a.folderId === selectedCollectionId);
            } else {
                 collectionsToShow = collections.filter(c => c.helpCenterId === activeHelpCenterId && !c.parentId);
                 articlesToShow = articles.filter(a => a.helpCenterId === activeHelpCenterId && !a.folderId);
            }
        }
        
        return { 
            combinedItems: [...collectionsToShow, ...articlesToShow].sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)), 
            title: viewTitle 
        };

    }, [sidebarView, selectedCollectionId, activeHelpCenterId, articles, collections, helpCenters]);

    const unassignedCount = useMemo(() => insights.filter(i => !i.topicId).length, [insights]);

    const showContentOnMobile = () => {
        if (isMobile) setMobileContentVisible(true);
    };
    
    const handleSaveArticle = async (article: HelpCenterArticle) => {
        await db.updateHelpCenterArticle(article.id, article);
        refreshData();
        reindexArticleAction(article.id).catch(console.error);
    };

    const handleSaveHelpCenter = async (values: HelpCenterFormValues) => {
        if (!activeHub) return;
        try {
            await db.addHelpCenter({
                ...values,
                hubId: activeHub.id,
            });
            setIsHCDialogOpen(false);
            refreshData();
            toast({ title: 'Library Created' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to create library' });
        }
    };

    const handleSaveCollection = async (values: any, id?: string) => {
        if (!activeHub || !activeHelpCenterId) {
            toast({ variant: 'destructive', title: 'Please select a library first' });
            return;
        }
        try {
            await db.saveHelpCenterCollection(activeHub.id, {
                ...values,
                helpCenterId: activeHelpCenterId,
                parentId: editingCollection ? editingCollection.parentId : (selectedCollectionId || null),
            }, id);
            setIsCollectionDialogOpen(false);
            setEditingCollection(null);
            refreshData();
            toast({ title: id ? 'Collection Updated' : 'Collection Created' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to save collection' });
        }
    };

    const handleViewChange = (view: HelpCenterSidebarView) => {
        setSidebarView(view);
        setSelectedCollectionId(null);
        setActiveHelpCenterId(null);
        setSelectedArticleId(null);
        showContentOnMobile();
    }
    
    const handleSelectHelpCenter = (id: string | null) => {
        setActiveHelpCenterId(id);
        setSidebarView(null);
        setSelectedCollectionId(null);
        setSelectedArticleId(null);
        showContentOnMobile();
    }

    const handleCreateArticle = async () => {
      if (!appUser || !activeHub || !activeSpace) return;

      const newArticleData: Omit<HelpCenterArticle, 'id'> = {
        title: '', subtitle: '', content: '<p></p>', status: 'draft',
        folderId: selectedCollectionId,
        helpCenterId: activeHelpCenterId || '',
        authorId: appUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        hubId: activeHub.id, spaceId: activeSpace.id, type: 'article', visibility: 'public',
        allowedUserIds: [appUser.id], isAiIndexed: true, isSeoIndexed: false,
      };
      
      const newArticle = await db.addHelpCenterArticle(newArticleData);
      setSelectedArticleId(newArticle.id);
      refreshData();
      showContentOnMobile();
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
                   onDelete={(id) => { db.deleteHelpCenterArticle(id); setSelectedArticleId(null); refreshData(); }}
                />
            </div>
        );
    }
    
    const sidebarComponent = (
        <HelpCenterSidebar
            collections={collections}
            activeCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
            onNewCollection={() => setIsCollectionDialogOpen(true)}
            onEditCollection={setEditingCollection}
            helpCenters={helpCenters}
            activeHelpCenterId={activeHelpCenterId}
            onSelectHelpCenter={handleSelectHelpCenter}
            onNewHelpCenter={() => setIsHCDialogOpen(true)}
            onEditHelpCenter={() => {}}
            sidebarView={sidebarView}
            onViewChange={handleViewChange}
            unassignedContentCount={unassignedCount}
            onImport={() => setIsImportDataOpen(true)}
        />
    );

    const isIntelligenceView = sidebarView === 'topics' || sidebarView === 'insights';

    const mainContentComponent = (
        <main className="p-4 md:p-6 flex flex-col h-full overflow-hidden">
            {isIntelligenceView ? (
                <SupportIntelligenceView 
                    insights={insights} 
                    topics={topics} 
                    allUsers={allUsers} 
                    initialTab={sidebarView === 'topics' ? 'topics' : 'insights'} 
                />
            ) : (
                <>
                    <div className="flex flex-col md:flex-row justify-between md:items-start mb-4 gap-4 shrink-0">
                        <div className='flex-1 min-w-0 text-left'>
                            <h1 className="text-3xl font-bold truncate">{title}</h1>
                            {activeHelpCenterId && (
                                <div className="flex items-center gap-3 mt-3">
                                    <div className="bg-muted/50 px-2 py-1 rounded-md border text-xs text-muted-foreground flex items-center gap-1.5">
                                        {helpCenters.find(h => h.id === activeHelpCenterId)?.visibility === 'internal' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                                        <span className="capitalize">{helpCenters.find(h => h.id === activeHelpCenterId)?.visibility}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {activeHelpCenterId && (
                                <Button variant="outline" onClick={() => setIsCollectionDialogOpen(true)}>
                                    <FolderPlus className="mr-2 h-4 w-4" /> New Collection
                                </Button>
                            )}
                            <Button onClick={handleCreateArticle}><Plus className="mr-2 h-4 w-4" /> New Article</Button>
                        </div>
                    </div>
                    <div className="flex-1 -mx-4 md:-mx-6 overflow-hidden">
                        <ScrollArea className="h-full text-left">
                            <div className="px-4 md:px-6">
                                <HelpCenterArticleList
                                    items={combinedItems}
                                    helpCenters={helpCenters}
                                    onSelectItem={(id, type) => type === 'article' ? setSelectedArticleId(id) : setSelectedCollectionId(id)}
                                    selectedItems={selectedItems}
                                    onToggleSelectItem={(id) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                                    onToggleAll={() => setSelectedItems(selectedItems.length === combinedItems.length ? [] : combinedItems.map(i => i.id))}
                                    isAllSelected={combinedItems.length > 0 && selectedItems.length === combinedItems.length}
                                    isMobile={isMobile}
                                />
                            </div>
                        </ScrollArea>
                    </div>
                </>
            )}
        </main>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-[288px_1fr] md:h-full overflow-hidden">
            {isMobile ? (mobileContentVisible ? mainContentComponent : sidebarComponent) : (
                <React.Fragment>
                    {sidebarComponent}
                    {mainContentComponent}
                </React.Fragment>
            )}
            <HelpCenterFormDialog isOpen={isHCDialogOpen} onOpenChange={setIsHCDialogOpen} helpCenter={null} onSave={handleSaveHelpCenter} />
            <HelpCenterCollectionFormDialog isOpen={isCollectionDialogOpen} onOpenChange={setIsCollectionDialogOpen} onSave={handleSaveCollection} collection={editingCollection} />
            <ImportDataDialog isOpen={isImportDataOpen} onOpenChange={setIsImportDataOpen} onComplete={refreshData} />
        </div>
    );
}
