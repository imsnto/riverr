
// src/components/dashboard/support-intelligence-view.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Insight, Topic, User } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { 
    MessageSquare, 
    ChevronRight, 
    ChevronDown, 
    BrainCircuit,
    Zap,
    Clock,
    User as UserIcon,
    History,
    ArrowLeft,
    Filter,
    Search,
    ArrowUpRight,
    Target,
    AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import InsightDetailPanel from './insight-detail-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

interface SupportIntelligenceViewProps {
    insights: Insight[];
    topics: Topic[];
    allUsers: User[];
}

type SubFilter = 'all' | 'ungrouped' | 'recent' | 'high-signal';

export default function SupportIntelligenceView({ insights, topics, allUsers }: SupportIntelligenceViewProps) {
    const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'topics' | 'insights'>('topics');
    const [subFilter, setSubFilter] = useState<SubFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredInsights = useMemo(() => {
        let list = [...insights];
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(i => 
                i.title?.toLowerCase().includes(q) || 
                i.summary?.toLowerCase().includes(q) ||
                i.content?.toLowerCase().includes(q)
            );
        }

        if (subFilter === 'ungrouped') {
            list = list.filter(i => !i.topicId || i.groupingStatus === 'ungrouped');
        } else if (subFilter === 'high-signal') {
            list = list.filter(i => (i.signalScore || 0) > 0.8);
        } else if (subFilter === 'recent') {
            list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return list;
    }, [insights, subFilter, searchQuery]);

    const selectedTopic = useMemo(() => {
        return topics.find(t => t.id === selectedTopicId);
    }, [topics, selectedTopicId]);

    const topicInsights = useMemo(() => {
        if (!selectedTopicId) return [];
        return insights.filter(i => i.topicId === selectedTopicId);
    }, [insights, selectedTopicId]);

    const renderSignalBadge = (level: string, count: number) => {
        if (level === 'high' || count > 10) {
            return <Badge className="bg-amber-500/10 text-amber-500 border-none text-[10px] uppercase font-black px-2 h-5">🔥 High Signal</Badge>;
        }
        if (level === 'medium' || count > 5) {
            return <Badge className="bg-blue-500/10 text-blue-400 border-none text-[10px] uppercase font-black px-2 h-5">⚡ Medium</Badge>;
        }
        return <Badge className="bg-zinc-500/10 text-zinc-400 border-none text-[10px] uppercase font-black px-2 h-5">• Low</Badge>;
    }

    const renderInsightCard = (insight: Insight) => (
        <Card 
            key={insight.id} 
            className="border-white/5 bg-[#161616] hover:bg-[#1a1a1a] transition-all cursor-pointer group overflow-hidden"
            onClick={() => setSelectedInsightId(insight.id)}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                    <h4 className="font-bold text-sm text-white group-hover:text-primary transition-colors leading-snug">
                        {insight.title || insight.summary}
                    </h4>
                    <span className="text-[10px] font-black uppercase text-muted-foreground opacity-40 shrink-0">
                        {insight.source.channel}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                    {insight.summary || insight.content.substring(0, 140)}
                </p>
                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                        {insight.topicId ? (
                            <Badge variant="outline" className="text-[9px] border-white/10 text-muted-foreground bg-white/5 h-5 px-1.5 font-bold truncate max-w-[150px]">
                                Topic: {topics.find(t => t.id === insight.topicId)?.title || 'Assigned'}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-500/70 bg-amber-500/5 h-5 px-1.5 font-bold uppercase">
                                Ungrouped
                            </Badge>
                        )}
                    </div>
                    <span className="text-[9px] text-muted-foreground/50 font-medium">
                        {formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })}
                    </span>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="flex h-full min-h-0 bg-background overflow-hidden relative">
            <div className="flex-1 flex flex-col min-w-0">
                <header className="p-6 border-b shrink-0 space-y-6 bg-card/30">
                    <div className="flex items-center justify-between gap-8">
                        <div className="space-y-1 text-left">
                            <h1 className="text-2xl font-bold tracking-tight">Support Intelligence</h1>
                            <p className="text-sm text-muted-foreground font-medium">AI is learning from support conversations automatically</p>
                        </div>
                        <div className="relative w-full max-w-sm hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search insights..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white/5 border-white/10 h-10 focus-visible:ring-primary/50" 
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-lg w-fit">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-8 px-6 text-xs font-bold rounded-md", activeTab === 'topics' ? "bg-white text-black hover:bg-white hover:text-black" : "text-muted-foreground")}
                            onClick={() => { setActiveTab('topics'); setSelectedTopicId(null); }}
                        >
                            Topics
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-8 px-6 text-xs font-bold rounded-md", activeTab === 'insights' ? "bg-white text-black hover:bg-white hover:text-black" : "text-muted-foreground")}
                            onClick={() => { setActiveTab('insights'); setSelectedTopicId(null); }}
                        >
                            Insights
                        </Button>
                    </div>
                </header>

                <ScrollArea className="flex-1">
                    <div className="p-6 max-w-6xl mx-auto min-h-full flex flex-col">
                        {activeTab === 'topics' ? (
                            selectedTopicId && selectedTopic ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="flex flex-col gap-4">
                                        <Button variant="ghost" size="sm" className="w-fit -ml-2 h-8 text-muted-foreground hover:text-foreground" onClick={() => setSelectedTopicId(null)}>
                                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Topics
                                        </Button>
                                        <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 text-left">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    {renderSignalBadge(selectedTopic.signalLevel, selectedTopic.insightCount)}
                                                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{selectedTopic.insightCount} insights</span>
                                                </div>
                                                <h2 className="text-3xl font-bold text-white leading-tight">{selectedTopic.title}</h2>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" className="font-bold h-9 px-4 rounded-xl gap-2">
                                                    <ArrowUpRight className="h-4 w-4" /> Create Article
                                                </Button>
                                                <Button size="sm" variant="ghost" className="font-bold h-9 px-4 rounded-xl text-muted-foreground">
                                                    Ignore Topic
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="bg-white/5" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {topicInsights.map(renderInsightCard)}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {topics.map((topic) => (
                                            <Card 
                                                key={topic.id} 
                                                className="border-white/5 bg-[#161616] hover:bg-[#1a1a1a] transition-all cursor-pointer group text-left"
                                                onClick={() => setSelectedTopicId(topic.id)}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="space-y-1">
                                                            {renderSignalBadge(topic.signalLevel, topic.insightCount)}
                                                            <h3 className="text-lg font-bold text-white leading-snug pt-1">{topic.title}</h3>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="h-4 w-4" /></Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-6 font-medium">
                                                        {topic.summary || `Identifying recurring issues across ${topic.insightCount} individual support interactions...`}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                                                        <span>{topic.insightCount} insights</span>
                                                        <span>Seen {formatDistanceToNow(new Date(topic.updatedAt), { addSuffix: true })}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {topics.length === 0 && (
                                        <div className="text-center py-32 border-2 border-dashed rounded-3xl border-white/5 bg-white/[0.01]">
                                            <Target className="mx-auto h-12 w-12 text-muted-foreground opacity-10 mb-4" />
                                            <h3 className="text-lg font-bold text-white/50">No patterns yet</h3>
                                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2 italic font-medium">
                                                As your team answers support questions, we’ll automatically group recurring issues here.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['all', 'ungrouped', 'recent', 'high-signal'] as SubFilter[]).map((f) => (
                                        <Button
                                            key={f}
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "h-8 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                                subFilter === f ? "bg-white/10 text-white border border-white/10" : "text-muted-foreground hover:text-white"
                                            )}
                                            onClick={() => setSubFilter(f)}
                                        >
                                            {f.replace('-', ' ')}
                                        </Button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredInsights.map(renderInsightCard)}
                                </div>

                                {filteredInsights.length === 0 && (
                                    <div className="text-center py-32 opacity-20">
                                        <MessageSquare className="mx-auto h-12 w-12 mb-4" />
                                        <p className="text-sm font-bold uppercase tracking-widest">No insights found</p>
                                    </div>
                                )}
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
