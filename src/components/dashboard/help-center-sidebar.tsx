
// src/components/dashboard/help-center-sidebar.tsx
'use client';
import React from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '../ui/button';
import { 
    Search, 
    Inbox, 
    Zap, 
    Library, 
    BookOpen, 
    Lock, 
    Plus, 
    Upload,
    Globe,
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

export type HelpCenterSidebarView = 'all-articles' | 'inbox' | 'patterns' | 'knowledge-bases' | 'support-intelligence';

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
    helpCenters,
    activeHelpCenterId,
    onSelectHelpCenter,
    onNewHelpCenter,
    sidebarView,
    onViewChange,
    unassignedContentCount,
    onImport,
}: HelpCenterSidebarProps) {

    const publicLibraries = helpCenters.filter(hc => hc.visibility !== 'internal' && hc.name !== 'Support Intelligence');
    const privateLibraries = helpCenters.filter(hc => hc.visibility === 'internal' || hc.name === 'Support Intelligence');

    const NavButton = ({ id, activeId, icon: Icon, label, onClick, badge, badgeColor = "bg-primary/10 text-primary border-primary/20" }: any) => (
        <div className={cn("group flex items-center justify-between rounded-md pr-1 transition-colors", activeId === id && "bg-accent/50")}>
            <Button
                variant='ghost'
                className={cn("w-full justify-start text-left text-sm h-9 px-2 min-w-0", activeId === id ? "text-foreground font-semibold" : "text-muted-foreground")}
                onClick={() => onClick(id)}
            >
                <Icon className="mr-2 h-4 w-4 shrink-0" />
                <span className="block flex-1 min-w-0 truncate text-left">{label}</span>
                {badge !== undefined && (
                    <Badge variant="secondary" className={cn("h-4 px-1 text-[8px] ml-2", badgeColor)}>{badge}</Badge>
                )}
            </Button>
        </div>
    );

    return (
        <aside className="w-full md:w-72 min-w-0 border-r bg-card p-2 flex flex-col">
            <div className="p-2 shrink-0 space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <span className="text-sm font-bold">Knowledge</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-9 h-9 bg-muted/20 border-white/5" />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-6">
                    <div className="space-y-1">
                        <NavButton 
                            id="inbox" 
                            activeId={sidebarView} 
                            icon={Inbox} 
                            label="Inbox" 
                            onClick={() => onViewChange('inbox')}
                            badge={unassignedContentCount}
                            badgeColor="bg-red-500/10 text-red-500 border-red-500/20"
                        />
                        <NavButton 
                            id="unassigned" 
                            activeId={sidebarView === 'inbox' ? 'inbox' : ''} 
                            icon={Globe} 
                            label="Unassigned" 
                            onClick={() => onViewChange('inbox')}
                            badge="5"
                            badgeColor="bg-rose-500/10 text-rose-500 border-rose-500/20"
                        />
                        <NavButton 
                            id="patterns" 
                            activeId={sidebarView} 
                            icon={Zap} 
                            label="Patterns" 
                            onClick={() => onViewChange('patterns')}
                            badge="3"
                            badgeColor="bg-amber-500/10 text-amber-500 border-amber-500/20"
                        />
                    </div>

                    <div>
                        <div className="px-2 mb-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest opacity-50">Public</div>
                        <div className="space-y-1">
                            {publicLibraries.map(hc => (
                                <NavButton 
                                    key={hc.id} 
                                    id={hc.id} 
                                    activeId={activeHelpCenterId} 
                                    icon={Globe} 
                                    label={hc.name} 
                                    onClick={onSelectHelpCenter}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="px-2 mb-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest opacity-50">Private</div>
                        <div className="space-y-1">
                            {privateLibraries.map(hc => (
                                <div key={hc.id} className="relative group">
                                    <NavButton 
                                        id={hc.id} 
                                        activeId={activeHelpCenterId} 
                                        icon={hc.name === 'Support Intelligence' ? Zap : Lock} 
                                        label={hc.name === 'Support Intelligence' ? 'Support Intel' : hc.name} 
                                        onClick={onSelectHelpCenter}
                                    />
                                    <div className={cn(
                                        "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full transition-opacity",
                                        activeHelpCenterId === hc.id ? "opacity-100" : "opacity-0"
                                    )} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start text-sm h-9 text-muted-foreground hover:text-foreground" onClick={onNewHelpCenter}>
                            <Plus className="mr-2 h-4 w-4" />
                            <span>New library</span>
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-sm h-9 text-muted-foreground hover:text-foreground" onClick={onImport}>
                            <Upload className="mr-2 h-4 w-4" />
                            <span>Import Library</span>
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
