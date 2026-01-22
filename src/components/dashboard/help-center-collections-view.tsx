'use client';
import React from 'react';
import { HelpCenterCollection, HelpCenterArticle } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Book, Edit, Folder, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface HelpCenterCollectionsViewProps {
  collections: HelpCenterCollection[];
  articles: HelpCenterArticle[];
  onAdd: () => void;
  onEdit: (collection: HelpCenterCollection) => void;
  onDelete: (collectionId: string) => void;
  onSelectCollection: (collection: HelpCenterCollection) => void;
}

export default function HelpCenterCollectionsView({ collections, articles, onAdd, onEdit, onDelete, onSelectCollection }: HelpCenterCollectionsViewProps) {
    
    const getArticleCount = (collectionId: string) => {
        return articles.filter(a => a.collectionIds.includes(collectionId)).length;
    }

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Collections</h1>
                <Button onClick={onAdd}>
                    <Plus className="mr-2 h-4 w-4" /> Add Collection
                </Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map(collection => (
                    <Card key={collection.id} onClick={() => onSelectCollection(collection)} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                             <div className="flex items-center gap-3">
                                <Folder className="h-6 w-6 text-muted-foreground" />
                                <CardTitle className="text-lg font-semibold">{collection.name}</CardTitle>
                            </div>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-8 w-8 -mt-2 -mr-2">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(collection); }}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(collection.id); }} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{collection.description || 'No description.'}</p>
                             <p className="text-xs text-muted-foreground mt-4">{getArticleCount(collection.id)} articles</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {collections.length === 0 && (
                <div className="text-center p-8 mt-4 border-2 border-dashed rounded-lg">
                    <Folder className="mx-auto h-12 w-12 text-muted-foreground"/>
                    <h3 className="mt-2 text-sm font-semibold text-foreground">No collections yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create one to get started.</p>
                     <Button variant="outline" size="sm" className="mt-4" onClick={onAdd}>
                        <Plus className="mr-2 h-4 w-4" /> Add Collection
                    </Button>
                </div>
            )}
        </div>
    );
}
