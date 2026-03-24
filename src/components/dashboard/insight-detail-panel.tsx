// src/components/dashboard/insight-detail-panel.tsx
'use client';

import React from 'react';
import { Insight, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
    X, 
    ArrowLeft, 
    Share2, 
    ExternalLink, 
    MessageSquare, 
    ShieldCheck,
    History,
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { getInitials } from '@/lib/utils';

interface InsightDetailPanelProps {
    insight: Insight;
    onClose: () => void;
    allUsers: User[];
}

export default function InsightDetailPanel({ insight, onClose, allUsers }: InsightDetailPanelProps) {
    const creator = allUsers.find(u => u.id === insight.createdByUserId);

    return (
        <div className="flex flex-col h-full bg-[#0d1117] border-l border-white/10">
            <header className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Intelligence Detail</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Share2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-8 space-y-10 pb-32 max-w-2xl mx-auto">
                    {/* Header Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] uppercase font-black tracking-tight px-1.5 h-5">
                                Support Resolution
                            </Badge>
                            {(insight.signalScore || 0) > 0.8 && (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-black px-1.5 h-5">
                                    🔥 High Signal
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold leading-tight text-white">{insight.title}</h2>
                        
                        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                                <ShieldCheck className="h-3.5 w-3.5" /> AI Usage Policy
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Used internally to improve automated AI responses. This data is never exposed directly to customers.
                            </p>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Content Section */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                                <Info className="h-3.5 w-3.5" /> Extracted Memory
                            </h4>
                            <div className="space-y-6 bg-black/40 rounded-3xl border border-white/5 p-6">
                                <div className="prose prose-sm prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
                                        {insight.content}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-wider">Source Channel</p>
                                <p className="text-xs font-bold uppercase text-white">{insight.source.channel}</p>
                            </div>
                            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-wider">Ingestion</p>
                                <p className="text-xs font-bold capitalize text-white">{insight.origin}</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Source Attribution */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                            <History className="h-3.5 w-3.5" /> Context & Attribution
                        </h4>
                        <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                <AvatarImage src={creator?.avatarUrl} />
                                <AvatarFallback className="bg-zinc-800 text-[10px] font-bold">{getInitials(insight.createdByName || 'U')}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{insight.createdByName || 'System Agent'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">Extracted {format(new Date(insight.createdAt), "MMM d, yyyy · HH:mm")}</p>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 px-3">
                                View Chat <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Footer Meta */}
                    <div className="pt-8 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-20">
                            <span>ID: {insight.id.substring(0, 12)}</span>
                            <span>Confidence: {Math.round((insight.signalScore || 0) * 100)}%</span>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
