
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Insight, Cluster, User, Hub } from '@/lib/data';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { 
    BrainCircuit, 
    Sparkles, 
    ChevronRight, 
    MessageSquare, 
    Clock, 
    Zap, 
    ShieldCheck, 
    User as UserIcon,
    Search,
    Filter,
    ArrowLeft,
    Share2,
    Lock,
    ExternalLink
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import InsightDetailPanel from './insight-detail-panel';

export default function SupportIntelligenceView() {
    const { activeSpace, allUsers } = useAuth();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'unclustered' | 'completed'>('all');

    useEffect(() => {
        if (!activeSpace) return;
        const unsubInsights = db.subscribeToInsights(activeSpace.id, setInsights);
        const unsubClusters = db.subscribeToClusters(activeSpace.id, setClusters);
        return () => {
            unsubInsights();
            unsubClusters();
        };
    }, [activeSpace]);

    const filteredInsights = useMemo(() => {
        return insights.filter(insight => {
            const matchesSearch = insight.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                insight.content.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = filter === 'all' || 
                                (filter === 'unclustered' && insight.clusteringStatus === 'unclustered') ||
                                (filter === 'completed' && insight.processingStatus === 'completed');
            return matchesSearch && matchesFilter;
        });
    }, [insights, searchTerm, filter]);

    const selectedInsight = insights.find(i => i.id === selectedInsightId);

    if (!activeSpace) return null;

    return (
        <div className="flex h-full min-h-0 bg-background overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                <header className="p-6 border-b shrink-0 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <BrainCircuit className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Support Intelligence</h1>
                                <p className="text-sm text-muted-foreground">Automatic support memory extracted from human conversations.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-indigo-500/5 border-indigo-500/20 text-indigo-400 font-bold uppercase tracking-tighter h-6">
                                <Lock className="h-3 w-3 mr-1.5" /> Internal Only
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search extracted insights..." 
                                className="pl-9 h-10 bg-muted/20 border-white/5"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center bg-muted/30 border border-white/5 rounded-lg p-1">
                            {(['all', 'unclustered', 'completed'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                                        filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <div className="grid grid-cols-1 gap-4">
                            {filteredInsights.map((insight) => (
                                <Card 
                                    key={insight.id}
                                    onClick={() => setSelectedInsightId(insight.id)}
                                    className={cn(
                                        "cursor-pointer hover:border-indigo-500/30 transition-all group overflow-hidden border-white/5 bg-white/[0.02]",
                                        selectedInsightId === insight.id && "ring-2 ring-indigo-500/50 border-indigo-500/50"
                                    )}
                                >
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch">
                                            <div className={cn(
                                                "w-1 shrink-0",
                                                insight.signalScore && insight.signalScore > 0.8 ? "bg-emerald-500" : "bg-indigo-500/20"
                                            )} />
                                            <div className="p-4 flex-1 space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <h3 className="font-bold text-base group-hover:text-indigo-400 transition-colors">
                                                            {insight.title || "Untitiled Resolution"}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 italic opacity-70">
                                                            "{insight.summary}"
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                                                        <Badge variant="secondary" className="bg-white/5 text-[9px] uppercase font-black tracking-tight h-5">
                                                            {insight.source.channel}
                                                        </Badge>
                                                        <p className="text-[9px] text-muted-foreground font-bold uppercase">
                                                            {formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                                    <div className="flex items-center gap-1.5">
                                                        <Sparkles className="h-3 w-3" />
                                                        <span>{Math.round((insight.signalScore || 0) * 100)}% Confidence</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <UserIcon className="h-3 w-3" />
                                                        <span>By {insight.createdByName || 'Unknown'}</span>
                                                    </div>
                                                    {insight.clusterId && (
                                                        <div className="flex items-center gap-1.5 text-indigo-400">
                                                            <Zap className="h-3 w-3" />
                                                            <span>Clustered</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {filteredInsights.length === 0 && (
                                <div className="text-center py-24 space-y-4 opacity-50">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                        <MessageSquare className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">No insights yet</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                            The brain automatically extracts insights from your human support responses. Keep chatting to train the memory!
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </div>

            {selectedInsight && (
                <div className="w-[450px] border-l bg-card shrink-0 h-full overflow-hidden animate-in slide-in-from-right duration-300">
                    <InsightDetailPanel 
                        insight={selectedInsight} 
                        onClose={() => setSelectedInsightId(null)}
                        allUsers={allUsers}
                    />
                </div>
            )}
        </div>
    );
}
