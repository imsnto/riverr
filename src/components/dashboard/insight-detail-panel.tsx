
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
    Clock, 
    Zap, 
    User as UserIcon,
    ShieldCheck,
    History,
    AtSign,
    Info,
    CheckCircle2
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
        <div className="flex flex-col h-full bg-card">
            <header className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Insight Detail</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Share2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-6 space-y-8 pb-20">
                    {/* Header Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] uppercase font-black tracking-tight px-1.5 h-5">
                                Support Resolution
                            </Badge>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-black px-1.5 h-5">
                                High Signal
                            </Badge>
                        </div>
                        <h2 className="text-2xl font-bold leading-tight">{insight.title}</h2>
                        
                        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                <ShieldCheck className="h-3.5 w-3.5" /> AI Usage Policy
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Used internally to answer support questions. Never shown to customers in this raw format.
                            </p>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Content Section */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                                <Info className="h-3 w-3" /> Extracted Intelligence
                            </h4>
                            <div className="p-4 rounded-xl bg-background border border-white/5">
                                <div className="prose prose-sm prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                                        {insight.content}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-white/[0.02] space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Ingestion Method</p>
                                <p className="text-xs font-bold capitalize">{insight.origin}</p>
                            </div>
                            <div className="p-3 rounded-lg border bg-white/[0.02] space-y-1">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Channel</p>
                                <p className="text-xs font-bold uppercase">{insight.source.channel}</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Source Attribution */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                            <History className="h-3 w-3" /> Originating Agent
                        </h4>
                        <div className="flex items-center gap-3 p-3 rounded-xl border bg-white/[0.02]">
                            <Avatar className="h-10 w-10 ring-2 ring-indigo-500/20">
                                <AvatarImage src={creator?.avatarUrl} />
                                <AvatarFallback>{getInitials(insight.createdByName || 'Unknown')}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate">{insight.createdByName || 'Unknown Agent'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Extracted {format(new Date(insight.createdAt), "MMM d, yyyy · HH:mm")}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Meta/Score */}
                    <div className="pt-4">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30">
                            <span>Processing ID: {insight.id.substring(0, 8)}</span>
                            <span>Signal: {Math.round((insight.signalScore || 0) * 100)}%</span>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
