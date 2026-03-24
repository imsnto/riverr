
// src/components/dashboard/patterns-view.tsx
'use client';

import React from 'react';
import { Cluster } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, ArrowUpRight, Plus, Archive, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatternsViewProps {
    clusters: Cluster[];
    onPromote?: (cluster: Cluster) => void;
    onDismiss?: (cluster: Cluster) => void;
}

export default function PatternsView({ clusters, onPromote, onDismiss }: PatternsViewProps) {
    const highSignal = clusters.filter(c => c.signalLevel === 'high' || c.insightCount > 10);
    const regular = clusters.filter(c => c.signalLevel !== 'high' && c.insightCount <= 10);

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
            <header className="p-6 shrink-0 space-y-1">
                <h1 className="text-2xl font-bold">Patterns</h1>
                <p className="text-sm text-muted-foreground">Recurring themes detected across all notes</p>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-6 max-w-4xl space-y-6">
                    {/* Pattern Cards */}
                    {[...highSignal, ...regular].map((cluster) => {
                        const isHigh = cluster.signalLevel === 'high' || cluster.insightCount > 10;
                        return (
                            <Card 
                                key={cluster.id} 
                                className={cn(
                                    "border-white/5 bg-[#161616] hover:bg-[#1a1a1a] transition-all",
                                    isHigh && "ring-1 ring-amber-500/20 border-amber-500/10"
                                )}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-white leading-snug">{cluster.title}</h3>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                <span>{cluster.insightCount} notes</span>
                                                <span>·</span>
                                                <span>Support Intel</span>
                                                <span>·</span>
                                                <span>3 weeks</span>
                                            </div>
                                        </div>
                                        <Badge 
                                            variant="outline" 
                                            className={cn(
                                                "text-[9px] uppercase font-black px-2 h-5 border-none",
                                                isHigh ? "bg-amber-500/10 text-amber-500" : "bg-zinc-500/10 text-zinc-400"
                                            )}
                                        >
                                            {isHigh ? 'high signal' : 'medium'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-9 px-4 font-bold bg-[#222] text-white hover:bg-[#2a2a2a] border border-white/5"
                                            onClick={() => onPromote?.(cluster)}
                                        >
                                            Draft article <ArrowUpRight className="ml-2 h-3.5 w-3.5 opacity-50" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-9 px-4 font-bold text-muted-foreground hover:text-white"
                                            onClick={() => onDismiss?.(cluster)}
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {clusters.length === 0 && (
                        <div className="text-center py-24 border-2 border-dashed rounded-3xl border-white/5 bg-white/[0.01]">
                            <Zap className="mx-auto h-10 w-10 text-muted-foreground opacity-10 mb-4" />
                            <h3 className="text-lg font-bold text-white/50">Analyzing interactions...</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2 italic">
                                Patterns will appear here once we detect recurring resolutions in your support notes.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-center pt-8">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-white/5 bg-muted/20">
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
