'use client';
import React, { useState, useEffect } from 'react';
import HelpCenterSidebar from './help-center-sidebar';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import HelpCenterArticleEditor from './help-center-article-editor';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { addHelpCenterCollection, updateHelpCenterCollection, deleteHelpCenterCollection, getHelpCenterCollections, getHelpCenterArticles, addHelpCenterArticle } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import HelpCenterArticleList from './help-center-article-list';
import { ArrowLeft, Book, FolderPlus, Plus, Search } from 'lucide-react';
import HelpCenterCollectionFormDialog from './help-center-collection-form-dialog';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';

interface HelpCenterLayoutProps {
    onSaveArticle: (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>) => Promise<HelpCenterArticle | void>;
}

export default function HelpCenterLayout({ 
    onSaveArticle, 
}: HelpCenterLayoutProps) {
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const { appUser, activeHub } = useAuth();
    
    const [collections, setCollections] = useState<HelpCenterCollection[]>([]);
    const [articles, setArticles] = useState<HelpCenterArticle[]>([]);
    
    const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<HelpCenterCollection | null>(null);
    const [newCollectionParentId, setNewCollectionParentId] = useState<string | undefined>(undefined);

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    
    const { toast } = useToast();

    useEffect(() => {
        if (activeHub) {
            getHelpCenterCollections(activeHub.id).then(setCollections);
            getHelpCenterArticles(activeHub.id).then(setArticles);
        }
    }, [activeHub]);
    
    const refreshData = () => {
        if (activeHub) {
            getHelpCenterCollections(activeHub.id).then(setCollections);
            getHelpCenterArticles(activeHub.id).then(setArticles);
        }
    }
    
    const handleNewCollection = (parentId?: string) => {
        setEditingCollection(null);
        setNewCollectionParentId(parentId);
        setIsCollectionDialogOpen(true);
    };

    const handleEditCollection = (collection: HelpCenterCollection) => {
        setEditingCollection(collection);
        setNewCollectionParentId(undefined);
        setIsCollectionDialogOpen(true);
    }

    const handleSaveCollection = async (values: { name: string; description?: string }, collectionId?: string) => {
        if (!activeHub) {
            toast({ variant: 'destructive', title: 'No active hub selected.' });
            return;
        }

        if (collectionId) {
            await updateHelpCenterCollection(collectionId, values);
            toast({ title: 'Folder updated.' });
        } else {
            await addHelpCenterCollection({ 
              ...values, 
              hubId: activeHub.id,
              helpCenterId: null, // No longer tied to a specific help center
              parentId: newCollectionParentId || null,
            });
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
        collectionId: selectedCollectionId,
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

    const handleSelectItem = (id: string, type: 'article' | 'collection') => {
        if (type === 'article') {
            setSelectedArticleId(id);
        } else {
            setSelectedCollectionId(id);
        }
    }
    
    const handleSelectArticle = (articleId: string) => {
        setSelectedArticleId(articleId);
    }

    const handleToggleSelectItem = (id: string) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
    
    const currentItems = articles.filter(a => a.collectionId === selectedCollectionId);
    const currentFolders = collections.filter(c => c.parentId === selectedCollectionId);
    const combinedItems = [...currentFolders, ...currentItems];

    const handleToggleAll = () => {
        if (selectedItems.length === combinedItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(combinedItems.map(i => i.id));
        }
    }
    
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
                onSelectCollection={setSelectedCollectionId}
                onNewCollection={handleNewCollection}
                onEditCollection={handleEditCollection}
            />
            <main className="overflow-y-auto p-4 md:p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">
                        {selectedCollectionId ? collections.find(c => c.id === selectedCollectionId)?.name : 'Content'}
                    </h1>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => handleNewCollection(selectedCollectionId || undefined)}>
                            <Plus className="mr-2 h-4 w-4" /> New subfolder
                        </Button>
                        <Button onClick={handleCreateArticle}>
                            <Plus className="mr-2 h-4 w-4" /> New content
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
                            items={combinedItems}
                            onSelectItem={handleSelectItem}
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
                parentId={newCollectionParentId}
            />
        </div>
    );
}
