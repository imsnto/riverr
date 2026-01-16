
'use client';
import React from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { Book, Cog, Folder, Layers, Search, File, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HelpCenterSidebarProps {
    activeHelpCenter: HelpCenter | null;
    collections: HelpCenterCollection[];
    activeView: string;
    onViewChange: (view: string) => void;
    onCreateHelpCenter: () => void;
}

export default function HelpCenterSidebar({ activeHelpCenter, collections, activeView, onViewChange, onCreateHelpCenter }: HelpCenterSidebarProps) {

    return (
        <aside className="w-80 border-r bg-card p-4 flex flex-col">
            <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9" />
            </div>

            <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Articles</h3>
                <nav className="space-y-1">
                    <Button variant={activeView === 'all_articles' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => onViewChange('all_articles')}>
                        <File className="mr-2 h-4 w-4"/> All articles
                    </Button>
                    <Button variant={activeView === 'published' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => onViewChange('published')}>
                        <Layers className="mr-2 h-4 w-4"/> Published
                    </Button>
                     <Button variant={activeView === 'draft' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => onViewChange('draft')}>
                        <CircleDot className="mr-2 h-4 w-4"/> Draft
                    </Button>
                </nav>
            </div>
            
            {activeHelpCenter ? (
                 <div className="mb-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start font-semibold text-base px-2 mb-2">
                                {activeHelpCenter.name}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Switch Help Center</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <nav className="space-y-1">
                        <Button variant={activeView === 'collections' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => onViewChange('collections')}>
                            <Folder className="mr-2 h-4 w-4"/> Collections
                        </Button>
                        <Button variant={activeView === 'settings' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => onViewChange('settings')}>
                            <Cog className="mr-2 h-4 w-4"/> Settings
                        </Button>
                    </nav>
                </div>
            ) : (
                <div className="flex-1" />
            )}

            <Button variant="outline" onClick={onCreateHelpCenter}>New Help Center</Button>
        </aside>
    );
}
