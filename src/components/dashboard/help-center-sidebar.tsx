
// src/components/dashboard/help-center-sidebar.tsx
'use client';
import React, { useState } from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { Book, ChevronRight, Folder, Search, MoreHorizontal, Edit, Plus, Library, Inbox, BookOpen, Lock, Upload, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import Link from 'next/link';
import { Badge } from '../ui/badge';

export type HelpCenterSidebarView = 'knowledge-bases' | 'inbox' | 'all-articles' | 'support-intelligence';

const iconMap: Record<string, React.ElementType> = {
  Library: Library,
  Book: Book,
  BookOpen: BookOpen,
  default: Book
};

const LibraryIcon = ({ name }: { name?: string | null }) => {
  const Icon = (iconMap as any)[name || ''] || iconMap.default;
  return <Icon className="mr-2 h-4 w-4 shrink-0" />;
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
  onImport: () => void;
}

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
    onImport,
}: HelpCenterSidebarProps) {

    const publicLibraries = helpCenters.filter(hc => hc.visibility !== 'internal' && hc.name !== 'Support Intelligence');
    const privateLibraries = helpCenters.filter(hc => hc.visibility === 'internal' && hc.name !== 'Support Intelligence');
    const supportIntel = helpCenters.find(hc => hc.name === 'Support Intelligence');

    const NavButton = ({ id, activeId, icon: Icon, label, onClick, children }: any) => (
        <div className={cn("group flex items-center justify-between rounded-md pr-1 transition-colors", activeId === id && "bg-accent/50")}>
            <Button
                variant='ghost'
                className={cn("w-full justify-start text-left text-sm h-9 px-2 min-w-0", activeId === id ? "text-foreground font-semibold" : "text-muted-foreground")}
                onClick={() => onClick(id)}
            >
                <Icon className="mr-2 h-4 w-4 shrink-0" />
                <span className="block flex-1 min-w-0 truncate text-left">{label}</span>
            </Button>
            {children}
        </div>
    );

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
                <div className="p-2 space-y-6">
                    <div className="space-y-1">
                        <NavButton 
                            id="all-articles" 
                            activeId={sidebarView} 
                            icon={BookOpen} 
                            label="All Content" 
                            onClick={() => onViewChange('all-articles')} 
                        />
                        <NavButton 
                            id="support-intelligence" 
                            activeId={sidebarView} 
                            icon={Zap} 
                            label="Patterns" 
                            onClick={() => onViewChange('support-intelligence')}
                        >
                            <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary/10 text-primary border-primary/20">3</Badge>
                        </NavButton>
                    </div>

                    <Separator />

                    {publicLibraries.length > 0 && (
                        <div>
                            <div className="px-2 mb-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Public</div>
                            <div className="space-y-1">
                                {publicLibraries.map(hc => (
                                    <NavButton 
                                        key={hc.id} 
                                        id={hc.id} 
                                        activeId={activeHelpCenterId} 
                                        icon={Library} 
                                        label={hc.name} 
                                        onClick={onSelectHelpCenter}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="px-2 mb-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Private</div>
                        <div className="space-y-1">
                            {supportIntel && (
                                <NavButton 
                                    id={supportIntel.id} 
                                    activeId={activeHelpCenterId} 
                                    icon={Bot} 
                                    label="Support Intel" 
                                    onClick={onSelectHelpCenter}
                                />
                            )}
                            {privateLibraries.map(hc => (
                                <NavButton 
                                    key={hc.id} 
                                    id={hc.id} 
                                    activeId={activeHelpCenterId} 
                                    icon={Lock} 
                                    label={hc.name} 
                                    onClick={onSelectHelpCenter}
                                />
                            ))}
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={onNewHelpCenter}>
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">New Library</span>
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={onImport}>
                            <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Import Library</span>
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
