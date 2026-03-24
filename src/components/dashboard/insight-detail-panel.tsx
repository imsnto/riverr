
'use client';

import React, { useState } from 'react';
import { Insight, User, Article, HelpCenter } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
    X, 
    ArrowLeft, 
    Share2, 
    ExternalLink, 
    ShieldCheck,
    History,
    Info,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { getInitials } from '@/lib/utils';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface InsightDetailPanelProps {
    insight: Insight;
    onClose: () => void;
    allUsers: User[];
}

export default function InsightDetailPanel({ insight, onClose, allUsers }: InsightDetailPanelProps) {
    const { toast } = useToast();
    const [isPromoting, setIsPromoting] = useState(false);
    const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
    const [libraries, setLibraries] = useState<HelpCenter[]>([]);
    const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
    
    const creator = allUsers.find(u => u.id === insight.author.userId);

    const handlePromoteClick = async () => {
        if (!insight.hubId) return;
        const fetchedLibs = await db.getHelpCenters(insight.hubId);
        setLibraries(fetchedLibs);
        if (fetchedLibs.length > 0) setSelectedLibraryId(fetchedLibs[0].id);
        setIsPromotionDialogOpen(true);
    };

    const handleConfirmPromotion = async () => {
        if (!selectedLibraryId) return;
        setIsPromoting(true);
        try {
            const articleData: Omit<Article, 'id'> = {
                spaceId: insight.spaceId,
                hubId: insight.hubId!,
                sourceType: 'insight',
                sourceInsightId: insight.id,
                destinationLibraryId: selectedLibraryId,
                visibility: libraries.find(l => l.id === selectedLibraryId)?.visibility || 'private',
                title: insight.title,
                body: insight.content,
                summary: insight.summary,
                status: 'draft',
                authorId: insight.author.userId || 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            await db.addArticle(articleData);
            await db.updateInsight(insight.id, { groupingStatus: 'grouped' });
            
            toast({ title: "Article Created", description: "The insight has been promoted to a draft article." });
            setIsPromotionDialogOpen(false);
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: "Promotion failed" });
        } finally {
            setIsPromoting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] border-l border-white/10 text-left">
            <header className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Intelligence Detail</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" className="h-8 rounded-lg font-bold gap-2" onClick={handlePromoteClick}>
                        <ArrowUpRight className="h-3.5 w-3.5" /> Promote to Article
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-8 space-y-10 pb-32 max-w-2xl mx-auto">
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
                        <p className="text-sm text-muted-foreground leading-relaxed italic">"{insight.summary}"</p>
                        
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

                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                                <Info className="h-3.5 w-3.5" /> Memory Content
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
                                <p className="text-xs font-bold uppercase text-white">{insight.source.channel || 'webchat'}</p>
                            </div>
                            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] space-y-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-wider">Origin</p>
                                <p className="text-xs font-bold capitalize text-white">{insight.origin}</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-white/5" />

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                            <History className="h-3.5 w-3.5" /> Attribution
                        </h4>
                        <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                <AvatarImage src={creator?.avatarUrl} />
                                <AvatarFallback className="bg-zinc-800 text-[10px] font-bold">{getInitials(insight.author.name || 'U')}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{insight.author.name || 'System Agent'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">Extracted {format(new Date(insight.createdAt), "MMM d, yyyy · HH:mm")}</p>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 px-3">
                                View Chat <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
                <DialogContent className="sm:max-w-md bg-[#0d1117] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Promote to Article</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Create a curated documentation draft from this insight.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Select Destination Library</Label>
                            <Select value={selectedLibraryId} onValueChange={setSelectedLibraryId}>
                                <SelectTrigger className="bg-white/5 border-white/10 h-12">
                                    <SelectValue placeholder="Choose a library..." />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0d1117] border-white/10">
                                    {libraries.map(lib => (
                                        <SelectItem key={lib.id} value={lib.id}>{lib.name} ({lib.visibility})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsPromotionDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPromotion} disabled={isPromoting || !selectedLibraryId} className="px-8 font-bold">
                            {isPromoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Create Draft Article
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
