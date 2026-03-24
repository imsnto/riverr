
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
    ChevronRight,
    ShieldAlert,
    BrainCircuit,
    Target,
    MessageSquare,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

export type HelpCenterSidebarView = 'topics' | 'insights' | 'all-articles' | 'inbox' | 'knowledge-bases' | 'support-intelligence';

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
  sidebarView: HelpCenterSidebarView | null;
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
    const privateLibraries = helpCenters.filter(hc => hc.visibility === 'internal' && hc.name !== 'Support Intelligence');

    const NavButton = ({ id, activeId, icon: Icon, label, onClick, badge, badgeColor = "bg-primary/10 text-primary border-primary/20" }: any) => (
        <div className={cn("group flex items-center justify-between rounded-lg pr-1 transition-all duration-200", activeId === id && "bg-white/5 border border-white/5 shadow-inner")}>
            <Button
                variant='ghost'
                className={cn("w-full justify-start text-left text-xs h-10 px-3 min-w-0 font-bold tracking-tight", activeId === id ? "text-white" : "text-muted-foreground hover:text-white")}
                onClick={() => onClick(id)}
            >
                <Icon className="mr-3 h-4 w-4 shrink-0" />
                <span className="block flex-1 min-w-0 truncate text-left">{label}</span>
                {badge !== undefined && (
                    <Badge variant="secondary" className={cn("h-4 px-1.5 text-[9px] ml-2 rounded-full", badgeColor)}>{badge}</Badge>
                )}
            </Button>
        </div>
    );

    return (
        <aside className="w-full md:w-72 min-w-0 border-r border-white/10 bg-[#0d1117] p-2 flex flex-col">
            <div className="p-3 shrink-0 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Library className="h-4 w-4 text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest text-white">Knowledge</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Global search..." className="pl-9 h-10 bg-white/[0.03] border-white/5 text-xs rounded-xl" />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-8">
                    {/* INTELLIGENCE SECTION */}
                    <div className="space-y-2">
                        <div className="px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Intelligence</div>
                        <div className="space-y-1">
                            <NavButton 
                                id="topics" 
                                activeId={sidebarView} 
                                icon={Sparkles} 
                                label="Topics" 
                                onClick={() => onViewChange('topics')}
                                badgeColor="bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            />
                            <NavButton 
                                id="insights" 
                                activeId={sidebarView} 
                                icon={Target} 
                                label="Insights" 
                                onClick={() => onViewChange('insights')}
                                badge={unassignedContentCount > 0 ? unassignedContentCount : undefined}
                                badgeColor="bg-rose-500/10 text-rose-500 border-rose-500/20"
                            />
                        </div>
                    </div>

                    {/* PRIVATE LIBS */}
                    <div className="space-y-2">
                        <div className="px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Private Libraries</div>
                        <div className="space-y-1">
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

                    {/* PUBLIC LIBS */}
                    <div className="space-y-2">
                        <div className="px-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Public Libraries</div>
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

                    <Separator className="bg-white/5 mx-2" />

                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start text-[11px] font-bold h-10 px-3 text-muted-foreground hover:text-white hover:bg-white/5 transition-all" onClick={onNewHelpCenter}>
                            <Plus className="mr-3 h-4 w-4" />
                            <span>Create Library</span>
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-[11px] font-bold h-10 px-3 text-muted-foreground hover:text-white hover:bg-white/5 transition-all" onClick={onImport}>
                            <Upload className="mr-3 h-4 w-4" />
                            <span>Import Data</span>
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </aside>
    );
}
