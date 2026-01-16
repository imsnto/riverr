'use client';
import React from 'react';
import { HelpCenterCollection, HelpCenterArticle } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Book, Edit, Folder, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50%]">Collection name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead># of articles</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collections.map(collection => (
                            <TableRow key={collection.id} onClick={() => onSelectCollection(collection)} className="cursor-pointer hover:bg-muted/50">
                                <TableCell>
                                    <div className="flex items-center gap-4">
                                        <Folder className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{collection.name}</div>
                                            <div className="text-sm text-muted-foreground">{collection.description}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="h-2 w-2 rounded-full bg-green-500"/>
                                        Published
                                    </div>
                                </TableCell>
                                <TableCell>{getArticleCount(collection.id)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
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
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {collections.length === 0 && (
                    <div className="text-center p-8">
                        <p className="text-muted-foreground">No collections yet. Create one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
