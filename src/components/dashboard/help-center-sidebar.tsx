'use client';
import React, { useState } from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { Book, ChevronRight, Folder, Layers, Search, File, CircleDot, MoreHorizontal, Edit, Plus, GripVertical, FileText, Settings, ExternalLink, Library, Inbox, BookOpen, Users, DollarSign, Briefcase, HelpCircle, MessageSquare, Code, Database, GitBranch, Archive, Shield, Globe, Home, Rocket, Lightbulb, Server, Cloud, Component, Package, Puzzle, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import Link from 'next/link';
import { Badge } from '../ui/badge';

export type HelpCenterSidebarView = 'knowledge-bases' | 'library' | 'all-articles';

const iconMap: Record<string, React.ReactNode> = {
    Book: <Book className="mr-2 h-4 w-4 shrink-0" />,
    BookOpen: <BookOpen className="mr-2 h-4 w-4 shrink-0" />,
    Folder: <Folder className="mr-2 h-4 w-4 shrink-0" />,
    Users: <Users className="mr-2 h-4 w-4 shrink-0" />,
    Settings: <Settings className="mr-2 h-4 w-4 shrink-0" />,
    DollarSign: <DollarSign className="mr-2 h-4 w-4 shrink-0" />,
    Briefcase: <Briefcase className="mr-2 h-4 w-4 shrink-0" />,
    HelpCircle: <HelpCircle className="mr-2 h-4 w-4 shrink-0" />,
    MessageSquare: <MessageSquare className="mr-2 h-4 w-4 shrink-0" />,
    Code: <Code className="mr-2 h-4 w-4 shrink-0" />,
    Database: <Database className="mr-2 h-4 w-4 shrink-0" />,
    GitBranch: <GitBranch className="mr-2 h-4 w-4 shrink-0" />,
    FileText: <FileText className="mr-2 h-4 w-4 shrink-0" />,
    Archive: <Archive className="mr-2 h-4 w-4 shrink-0" />,
    Inbox: <Inbox className="mr-2 h-4 w-4 shrink-0" />,
    Shield: <Shield className="mr-2 h-4 w-4 shrink-0" />,
    Globe: <Globe className="mr-2 h-4 w-4 shrink-0" />,
    Home: <Home className="mr-2 h-4 w-4 shrink-0" />,
    Rocket: <Rocket className="mr-2 h-4 w-4 shrink-0" />,
    Lightbulb: <Lightbulb className="mr-2 h-4 w-4 shrink-0" />,
    Server: <Server className="mr-2 h-4 w-4 shrink-0" />,
    Cloud: <Cloud className="mr-2 h-4 w-4 shrink-0" />,
    Component: <Component className="mr-2 h-4 w-4 shrink-0" />,
    Package: <Package className="mr-2 h-4 w-4 shrink-0" />,
    Puzzle: <Puzzle className="mr-2 h-4 w-4 shrink-0" />,
    Heart: <Heart className="mr-2 h-4 w-4 shrink-0" />,
    default: <Book className="mr-2 h-4 w-4 shrink-0" />
};

const LibraryIcon = ({ name }: { name?: string | null }) => {
    if (name && iconMap[name]) {
        return iconMap[name];
    }
    return iconMap.default;
};

interface HelpCenterSidebarProps {
  collections: HelpCenterCollection[];
  activeCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onNewCollection: (parentId?: string) => void;
  onEditCollection: (collection: HelpCenterCollection) => void;
  
  helpCenters: HelpCenter[];
  activeHelpCenterId: string | null;
  onSelectHelpCenter: (id: string | null) => void;
  onNewHelpCenter: () => void;
  onEditHelpCenter: (hc: HelpCenter) => void;
  
  unassignedContentCount: number;

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
            <div className={cn("group flex items-center justify-between rounded-md px-2", activeCollectionId === collection.id && "bg-accent")}>
              
              <div className="flex items-center flex-1 min-w-0">
                  <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 shrink-0", !hasChildren && "invisible")}>
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-90" />
                      </Button>
                  </CollapsibleTrigger>
                  <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9 px-2 min-w-0 overflow-hidden"
                      onClick={() => onSelectCollection(collection.id)}
                  >
                      <Folder className="mr-2 h-4 w-4 shrink-0" />
                      <span className="block flex-1 min-w-0 truncate">{collection.name}</span>
                  </Button>
              </div>

              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 md:opacity-0 md:group-hover:opacity-100">
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


const HelpCenterList: React.FC<{ helpCenters: HelpCenter[], activeHelpCenterId: string | null, onSelect: (id: string | null) => void, onEdit: (hc: HelpCenter) => void }> = ({ helpCenters, activeHelpCenterId, onSelect, onEdit }) => (
    <div className="space-y-1">
        {helpCenters.map(hc => (
            <div
                key={hc.id}
                className={cn("group flex items-center justify-between rounded-md pr-1", activeHelpCenterId === hc.id && "bg-accent")}
            >
                <Button
                    variant='ghost'
                    className="flex-1 justify-start text-sm h-9 px-2 min-w-0 overflow-hidden"
                    onClick={() => onSelect(hc.id)}
                >
                    <LibraryIcon name={hc.icon} />
                    <span className="block flex-1 min-w-0 truncate">{hc.name}</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 md:opacity-0 md:group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => onEdit(hc)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                         <DropdownMenuItem asChild>
                            <Link href={`/hc/${hc.id}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                <span>View Live</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
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
    onNewHelpCenter,
    onEditHelpCenter,
    sidebarView,
    onViewChange,
    unassignedContentCount,
}: HelpCenterSidebarProps) {

    return (
        <aside className="w-full md:w-72 min-w-0 border-r bg-card p-2 flex flex-col">
            <div className="p-2 shrink-0">
                <h2 className="text-xl font-bold px-2 mb-2">Knowledge</h2>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search all content..." className="pl-9 h-9" />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    <div>
                        <div className="px-2 mt-4 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                            Libraries
                        </div>
                        <HelpCenterList 
                            helpCenters={helpCenters} 
                            activeHelpCenterId={sidebarView === 'knowledge-bases' ? activeHelpCenterId : null}
                            onSelect={onSelectHelpCenter}
                            onEdit={onEditHelpCenter}
                        />
                         <Button variant="ghost" className="w-full justify-start text-sm h-9 mt-1" onClick={onNewHelpCenter}>
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">New Library</span>
                        </Button>
                    </div>
                
                    {sidebarView === 'knowledge-bases' && activeHelpCenterId && (
                        <>
                            <Separator />
                            <FolderTree
                                collections={collections.filter(c => c.helpCenterId === activeHelpCenterId)}
                                parentId={null}
                                level={0}
                                activeCollectionId={activeCollectionId}
                                onSelectCollection={(id) => {
                                    onSelectCollection(id);
                                    onViewChange('knowledge-bases');
                                }}
                                onNewCollection={onNewCollection}
                                onEditCollection={onEditCollection}
                            />
                        </>
                    )}

                    <Separator />
                    
                     <div>
                        <div className="px-2 mt-4 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                            INBOX
                        </div>
                        <Button variant={sidebarView === 'library' ? 'secondary' : 'ghost'} className="w-full justify-between text-sm h-9" onClick={() => onViewChange('library')}>
                            <div className="flex items-center gap-2">
                                <Inbox className="h-4 w-4"/> Unassigned Content
                            </div>
                            <Badge variant={sidebarView === 'library' ? "default" : "secondary"}>{unassignedContentCount}</Badge>
                        </Button>
                    </div>
                    {sidebarView === 'library' && (
                        <>
                            <Separator />
                            <FolderTree
                                collections={collections.filter(c => !c.helpCenterId)}
                                parentId={null}
                                level={0}
                                activeCollectionId={activeCollectionId}
                                onSelectCollection={onSelectCollection}
                                onNewCollection={onNewCollection}
                                onEditCollection={onEditCollection}
                            />
                        </>
                    )}

                    <Separator />

                    <div>
                        <div className="px-2 mt-4 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                            Views
                        </div>
                        <Button variant={sidebarView === 'all-articles' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange('all-articles')}>
                            <FileText className="mr-2 h-4 w-4"/> All Content
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
