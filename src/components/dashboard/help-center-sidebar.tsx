
'use client';
import React, { useState } from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { Book, ChevronRight, Folder, Layers, Search, File, CircleDot, MoreHorizontal, Edit, Plus, GripVertical, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

export type HelpCenterSidebarView = 'help-centers' | 'library' | 'all-articles';

interface HelpCenterSidebarProps {
  // Collections (Folders)
  collections: HelpCenterCollection[];
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onNewCollection: (parentId?: string) => void;
  onEditCollection: (collection: HelpCenterCollection) => void;
  
  // Help Centers
  helpCenters: HelpCenter[];
  activeHelpCenterId: string | null;
  onSelectHelpCenter: (id: string | null) => void;
  
  // View Control
  sidebarView: HelpCenterSidebarView;
  onViewChange: (view: HelpCenterSidebarView) => void;
}

interface FolderTreeProps {
  collections: HelpCenterCollection[];
  parentId: string | null;
  level: number;
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onNewCollection: (parentId?: string) => void;
  onEditCollection: (collection: HelpCenterCollection) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ collections, parentId, level, activeCollectionId, onSelectCollection, onNewCollection, onEditCollection }) => {
  const children = collections.filter(c => c.parentId === parentId);
  if (children.length === 0) return null;

  return (
    <div className={cn(level > 0 && 'pl-4')}>
      {children.map(collection => {
        const hasChildren = collections.some(c => c.parentId === collection.id);
        return (
          <Collapsible key={collection.id} defaultOpen={true}>
            <div className={cn("group flex items-center justify-between rounded-md pr-1", activeCollectionId === collection.id && "bg-accent")}>
              
              <div className="flex items-center flex-1 min-w-0">
                  <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 shrink-0", !hasChildren && "invisible")}>
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </Button>
                  </CollapsibleTrigger>
                  <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9 px-1 truncate"
                      onClick={() => onSelectCollection(collection.id)}
                  >
                      <Folder className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{collection.name}</span>
                  </Button>
              </div>

              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onNewCollection(collection.id)}>
                          <Plus className="mr-2 h-4 w-4" /> Add subfolder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditCollection(collection)}>
                          <Edit className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CollapsibleContent>
              {hasChildren && (
                <FolderTree
                  collections={collections}
                  parentId={collection.id}
                  level={level + 1}
                  activeCollectionId={activeCollectionId}
                  onSelectCollection={onSelectCollection}
                  onNewCollection={onNewCollection}
                  onEditCollection={onEditCollection}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};


const HelpCenterList: React.FC<{ helpCenters: HelpCenter[], activeHelpCenterId: string | null, onSelect: (id: string | null) => void }> = ({ helpCenters, activeHelpCenterId, onSelect }) => (
    <div className="space-y-1">
        {helpCenters.map(hc => (
            <Button
                key={hc.id}
                variant={activeHelpCenterId === hc.id ? 'secondary' : 'ghost'}
                className="w-full justify-start text-sm h-9"
                onClick={() => onSelect(hc.id)}
            >
                <Book className="mr-2 h-4 w-4" />
                <span className="truncate">{hc.name}</span>
            </Button>
        ))}
    </div>
);


export default function HelpCenterSidebar({ 
    collections,
    activeCollectionId,
    onSelectCollection,
    onNewCollection,
    onEditCollection,
    helpCenters,
    activeHelpCenterId,
    onSelectHelpCenter,
    sidebarView,
    onViewChange,
}: HelpCenterSidebarProps) {

    return (
        <aside className="w-full md:w-72 border-r bg-card p-4 flex flex-col">
            <h2 className="text-xl font-bold px-2 mb-2">Knowledge</h2>
            <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9 h-9" />
            </div>

            <ScrollArea className="flex-1 -mx-4">
              <div className="px-4">
                <Button variant={sidebarView === 'all-articles' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange('all-articles')}>
                  <FileText className="mr-2 h-4 w-4"/> All Articles
                </Button>
                
                <Separator className="my-2" />

                <Collapsible defaultOpen>
                    <CollapsibleTrigger className="w-full">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider p-2 text-left w-full flex justify-between items-center">
                            Content Library
                            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </h3>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 py-1">
                       <FolderTree 
                            collections={collections}
                            parentId={null}
                            level={0}
                            activeCollectionId={sidebarView === 'library' ? activeCollectionId : null}
                            onSelectCollection={(id) => {
                                onSelectCollection(id);
                                onViewChange('library');
                            }}
                            onNewCollection={onNewCollection}
                            onEditCollection={onEditCollection}
                        />
                        <Button variant="ghost" className="w-full justify-start text-sm h-9 mt-1" onClick={() => onNewCollection()}>
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">New folder</span>
                        </Button>
                    </CollapsibleContent>
                </Collapsible>
                
                 <Collapsible defaultOpen>
                    <CollapsibleTrigger className="w-full">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider p-2 text-left w-full flex justify-between items-center">
                            Help Centers
                            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </h3>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 py-1">
                        <HelpCenterList 
                            helpCenters={helpCenters} 
                            activeHelpCenterId={sidebarView === 'help-centers' ? activeHelpCenterId : null}
                            onSelect={(id) => {
                                onSelectHelpCenter(id);
                                onViewChange('help-centers');
                            }}
                        />
                    </CollapsibleContent>
                 </Collapsible>
              </div>
            </ScrollArea>
        </aside>
    );
}
