
// src/components/dashboard/support-intelligence-view.tsx
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
    ExternalLink,
    ChevronDown,
    Plus,
    CheckCircle2
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import InsightDetailPanel from './insight-detail-panel';
import { Separator } from '../ui/separator';

interface SupportIntelligenceViewProps {
    onBack?: () => void;
}

export default function SupportIntelligenceView({ onBack }: SupportIntelligenceViewProps) {
    const { activeSpace, allUsers } = useAuth();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
    const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredClusters = useMemo(() => {
        return clusters.filter(c => 
            c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [clusters, searchTerm]);

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
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                Support Intelligence
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span>{clusters.length} clusters</span>
                                <span>·</span>
                                <span>{insights.length} notes</span>
                                <span>·</span>
                                <span>0 articles promoted</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="bg-muted/50 border-white/5 h-9">Settings</Button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="rounded-full px-6 h-9 font-bold bg-white text-black hover:bg-white/90">Clusters</Button>
                        <Button variant="ghost" size="sm" className="rounded-full px-6 h-9 font-bold text-muted-foreground">Articles</Button>
                    </div>
                </header>

                <ScrollArea className="flex-1">
                    <div className="p-6 max-w-5xl mx-auto space-y-4">
                        {/* Cluster Cards */}
                        {filteredClusters.map((cluster) => {
                            const clusterInsights = insights.filter(i => i.clusterId === cluster.id);
                            const isExpanded = expandedClusterId === cluster.id;
                            const isHighSignal = cluster.signalLevel === 'high' || cluster.insightCount > 10;

                            return (
                                <div key={cluster.id} className="space-y-2">
                                    <Card 
                                        className={cn(
                                            "cursor-pointer border-white/5 bg-[#1a1a1a] hover:bg-[#222] transition-all overflow-hidden",
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
                                                    <span>·</span>
                                                    <span>no article yet</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button size="sm" variant="outline" className="h-8 gap-1.5 font-bold border-white/10 hover:bg-white/5">
                                                    + article <ExternalLink className="h-3 w-3 opacity-50" />
                                                </Button>
                                                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
                                            </div>
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
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-40">{insight.source.channel}</span>
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Unclustered Notes Section */}
                        <div className="pt-8">
                            <Card className="border-white/5 bg-[#1a1a1a]/50 border-dashed">
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <h3 className="text-lg font-bold text-zinc-400">Unclustered notes</h3>
                                            <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 h-5 bg-zinc-500/10 text-zinc-500 border-none">ungrouped</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-medium">{unclusteredInsights.length} notes · not enough signal to cluster yet</p>
                                    </div>
                                    <ChevronDown className="h-5 w-5 text-zinc-600" />
                                </div>
                            </Card>
                        </div>

                        {clusters.length === 0 && (
                            <div className="text-center py-24 space-y-4 opacity-50">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                    <BrainCircuit className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Building your intelligence...</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        As your team answers support questions, Finn will extract patterns and group them into clusters here.
                                    </p>
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
