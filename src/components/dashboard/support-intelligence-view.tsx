
// src/components/dashboard/support-intelligence-view.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Insight, Cluster, User } from '@/lib/data';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { 
    MessageSquare, 
    ChevronRight, 
    ChevronDown, 
    ExternalLink, 
    BrainCircuit,
    Sparkles,
    Zap,
    Clock,
    User as UserIcon,
    History
} from 'lucide-react';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import InsightDetailPanel from './insight-detail-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SupportIntelligenceViewProps {
    onBack?: () => void;
}

export default function SupportIntelligenceView({ onBack }: SupportIntelligenceViewProps) {
    const { activeSpace, allUsers } = useAuth();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
    const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'clusters' | 'notes'>('clusters');

    useEffect(() => {
        if (!activeSpace) return;
        const unsubInsights = db.subscribeToInsights(activeSpace.id, setInsights);
        const unsubClusters = db.subscribeToClusters(activeSpace.id, setClusters);
        return () => {
            unsubInsights();
            unsubClusters();
        };
    }, [activeSpace]);

    const unclusteredInsights = useMemo(() => {
        return insights.filter(i => !i.clusterId || i.clusteringStatus === 'unclustered');
    }, [insights]);

    if (!activeSpace) return null;

    return (
        <div className="flex h-full min-h-0 bg-background overflow-hidden relative">
            <div className="flex-1 flex flex-col min-w-0">
                <header className="p-6 border-b shrink-0 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Private · AI ingestion on
                            </div>
                            <h1 className="text-2xl font-bold">Support Intelligence</h1>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-fit">
                        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-full h-10">
                            <TabsTrigger value="clusters" className="rounded-full px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-black">Clusters</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-full px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-black">Notes</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </header>

                <ScrollArea className="flex-1">
                    <div className="p-6 max-w-5xl mx-auto space-y-4">
                        {activeTab === 'clusters' ? (
                            <>
                                {clusters.map((cluster) => {
                                    const clusterInsights = insights.filter(i => i.clusterId === cluster.id);
                                    const isExpanded = expandedClusterId === cluster.id;
                                    const isHighSignal = cluster.signalLevel === 'high' || cluster.insightCount > 10;

                                    return (
                                        <div key={cluster.id} className="space-y-2">
                                            <Card 
                                                className={cn(
                                                    "cursor-pointer border-white/5 bg-[#161616] hover:bg-[#1a1a1a] transition-all overflow-hidden",
                                                    isExpanded && "ring-1 ring-primary/50"
                                                )}
                                                onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                                            >
                                                <div className="p-5 flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <h3 className="text-lg font-bold text-white truncate">{cluster.title}</h3>
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] uppercase font-black px-1.5 h-5 border-none",
                                                                isHighSignal ? "bg-amber-500/10 text-amber-500" : "bg-zinc-500/10 text-zinc-400"
                                                            )}>
                                                                {isHighSignal ? 'high signal' : 'low signal'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                            <span>{cluster.insightCount} notes</span>
                                                            <span>·</span>
                                                            <span>last added {formatDistanceToNow(new Date(cluster.updatedAt), { addSuffix: true })}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
                                                </div>
                                            </Card>

                                            {isExpanded && (
                                                <div className="pl-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    {clusterInsights.map(insight => (
                                                        <div 
                                                            key={insight.id} 
                                                            className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/[0.02] cursor-pointer flex items-center justify-between group"
                                                            onClick={() => setSelectedInsightId(insight.id)}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                <p className="text-sm font-medium truncate pr-4">{insight.title || insight.summary}</p>
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {unclusteredInsights.length > 0 && (
                                    <div className="pt-8">
                                        <Card className="border-white/5 bg-[#161616]/50 border-dashed">
                                            <div className="p-5 flex items-center justify-between opacity-50">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-bold text-zinc-400">Unclustered notes</h3>
                                                    <p className="text-xs text-muted-foreground font-medium">{unclusteredInsights.length} notes · not enough signal to cluster yet</p>
                                                </div>
                                                <ChevronDown className="h-5 w-5 text-zinc-600" />
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-2">
                                {insights.map((insight) => (
                                    <div 
                                        key={insight.id} 
                                        className="p-4 rounded-xl border border-white/5 bg-[#161616] hover:bg-[#1a1a1a] cursor-pointer flex items-center justify-between group"
                                        onClick={() => setSelectedInsightId(insight.id)}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                                <History className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{insight.title || 'Untitled Note'}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{insight.summary}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-40">{insight.source.channel}</span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {insights.length === 0 && (
                            <div className="text-center py-24 space-y-4 opacity-50">
                                <BrainCircuit className="mx-auto h-12 w-12 text-muted-foreground" />
                                <div>
                                    <h3 className="font-bold">Building your memory...</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">Finn will extract intelligence from your support answers automatically.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {selectedInsightId && insights.find(i => i.id === selectedInsightId) && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[100] animate-in fade-in duration-200">
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl shadow-2xl animate-in slide-in-from-right duration-300">
                        <InsightDetailPanel 
                            insight={insights.find(i => i.id === selectedInsightId)!} 
                            onClose={() => setSelectedInsightId(null)}
                            allUsers={allUsers}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
