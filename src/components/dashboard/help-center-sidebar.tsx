'use client';
import React from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { Book, Cog, Folder, Layers, Search, File, CircleDot, MoreHorizontal, Edit, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '../ui/separator';

interface HelpCenterSidebarProps {
    helpCenters: HelpCenter[];
    activeHelpCenter: HelpCenter | null;
    onSelectHelpCenter: (hc: HelpCenter | null) => void;
    collections: HelpCenterCollection[];
    activeView: string;
    onViewChange: (view: string) => void;
    onCreateHelpCenter: () => void;
    onEditHelpCenter: (hc: HelpCenter) => void;
}

export default function HelpCenterSidebar({ 
    helpCenters,
    activeHelpCenter,
    onSelectHelpCenter,
    collections, 
    activeView, 
    onViewChange, 
    onCreateHelpCenter,
    onEditHelpCenter
}: HelpCenterSidebarProps) {

    return (
        <aside className="w-full md:w-80 border-r bg-card p-4 flex flex-col">
            <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9 h-9" />
            </div>

            <div className="mb-4">
                <nav className="space-y-1">
                    <Button variant={activeView === 'all_articles' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange('all_articles')}>
                        <File className="mr-2 h-4 w-4"/> All articles
                    </Button>
                    <Button variant={activeView === 'published' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange('published')}>
                        <Layers className="mr-2 h-4 w-4"/> Published
                    </Button>
                     <Button variant={activeView === 'draft' ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange('draft')}>
                        <CircleDot className="mr-2 h-4 w-4"/> Draft
                    </Button>
                </nav>
            </div>
            
            <Separator />

            <div className="py-4 flex-1 overflow-y-auto">
                 <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Help Centers</h3>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateHelpCenter}>
                        <Plus className="h-4 w-4"/>
                    </Button>
                 </div>
                 {helpCenters.length > 0 ? (
                    <nav className="space-y-1">
                        {helpCenters.map(hc => (
                            <div key={hc.id}>
                                <div className={cn("group flex items-center justify-between rounded-md", activeHelpCenter?.id === hc.id && 'bg-accent')}>
                                    <Button 
                                        variant="ghost" 
                                        className="w-full justify-start text-sm h-9 flex-1" 
                                        onClick={() => onSelectHelpCenter(hc)}
                                    >
                                        <Book className="mr-2 h-4 w-4"/>
                                        <span className="truncate">{hc.name}</span>
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => onEditHelpCenter(hc)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Rename
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {activeHelpCenter?.id === hc.id && (
                                    <div className="pl-4 mt-1 space-y-1">
                                        <Button 
                                            variant={activeView === `collections_${hc.id}` ? 'secondary' : 'ghost'} 
                                            className="w-full justify-start text-sm h-9" 
                                            onClick={() => onViewChange(`collections_${hc.id}`)}
                                        >
                                            <Folder className="mr-2 h-4 w-4"/> 
                                            <span className="truncate">Collections</span>
                                        </Button>

                                        <Separator className="my-2" />

                                        <Button variant={activeView === `settings_${hc.id}` ? 'secondary' : 'ghost'} className="w-full justify-start text-sm h-9" onClick={() => onViewChange(`settings_${hc.id}`)}>
                                            <Cog className="mr-2 h-4 w-4" />
                                            Settings
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                 ) : (
                    <div className="text-center text-xs text-muted-foreground px-2 py-4">
                        <p>No help centers created yet.</p>
                         <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={onCreateHelpCenter}>Create one</Button>
                    </div>
                 )}
            </div>

        </aside>
    );
}
