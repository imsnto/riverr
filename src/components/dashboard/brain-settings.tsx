'use client';

import React, { useState, useEffect, useTransition } from 'react';
import * as db from '@/lib/db';
import type { Space, Hub, BrainJob } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BrainCircuit, Database, Lightbulb, CheckCircle2, AlertCircle, Clock, Play, Search, ExternalLink, RefreshCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as firestore } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';

interface BrainSettingsProps {
  activeSpace: Space | null;
  activeHub: Hub | null;
}

export default function BrainSettings({ activeSpace, activeHub }: BrainSettingsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [recentJobs, setRecentJobs] = useState<BrainJob[]>([]);
  const [indexedChunks, setIndexedChunks] = useState<any[]>([]);
  const [isReindexing, startReindexTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!activeSpace) return;

    // To avoid requiring a composite index during the prototype phase,
    // we fetch filtered jobs and sort them locally.
    const q = query(
      collection(firestore, 'brain_jobs'),
      where('params.spaceId', '==', activeSpace.id),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as BrainJob))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentJobs(jobs);
    });

    return () => unsubscribe();
  }, [activeSpace]);

  useEffect(() => {
    if (activeHub) {
      db.getBrainChunks(activeHub.id).then(setIndexedChunks);
    }
  }, [activeHub]);

  const runIngest = async () => {
    if (!activeSpace || !activeHub) return;
    setIsRunning(true);
    try {
      const jobId = await db.startBrainJob('ingest_conversations', {
        spaceId: activeSpace.id,
        hubId: activeHub.id,
      });
      toast({ title: 'Ingestion Started', description: `Job ID: ${jobId}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to start ingestion' });
    } finally {
      setIsRunning(false);
    }
  };

  const runDistill = async () => {
    if (!activeSpace) return;
    setIsRunning(true);
    try {
      const jobId = await db.startBrainJob('distill_support_intents', {
        spaceId: activeSpace.id,
      });
      toast({ title: 'Distillation Started', description: `Job ID: ${jobId}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to start distillation' });
    } finally {
      setIsRunning(false);
    }
  };

  const handleMassReindex = () => {
    if (!activeHub) return;
    startReindexTransition(async () => {
      try {
        console.log('REINDEX: Triggering mass reindex API...');
        const response = await fetch('/api/admin/reindex-help-center', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ hubId: activeHub.id })
        });
        
        const payload = await response.json().catch(() => null);
        console.log('REINDEX: Server response', response.status, payload);

        if (!response.ok) {
          throw new Error(payload?.error || 'Server responded with error');
        }

        toast({ title: "Mass Reindexing Complete", description: `Reindexed ${payload.articles} articles into ${payload.totalChunks} vector chunks.` });
        db.getBrainChunks(activeHub.id).then(setIndexedChunks);
      } catch (e: any) {
        console.error('REINDEX: Client failure', e);
        toast({ 
          variant: 'destructive', 
          title: 'Mass Reindexing Failed',
          description: e.message || 'Check console for details.'
        });
      }
    });
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredChunks = indexedChunks.filter(chunk => 
    chunk.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chunk.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <BrainCircuit className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">Business Brain</h1>
        </div>
        <p className="text-muted-foreground text-sm">Distill intelligence and reusable knowledge from your workspace conversations.</p>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
          <TabsTrigger value="overview" className="px-6">Pipeline & Overview</TabsTrigger>
          <TabsTrigger value="index" className="px-6">Knowledge Index Explorer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/10 bg-primary/5 hover:border-primary/20 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase font-black tracking-widest text-primary">
                  <Database className="h-4 w-4" />
                  Ingestion Pipeline
                </CardTitle>
                <CardDescription>
                  Scan conversations in this hub and prepare them for AI distillation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={runIngest} 
                  disabled={isRunning || !activeSpace || !activeHub}
                  className="w-full font-bold h-11 rounded-xl shadow-lg shadow-primary/20"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Start Ingestion
                </Button>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/10 bg-indigo-500/5 hover:border-indigo-500/20 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase font-black tracking-widest text-indigo-400">
                  <Lightbulb className="h-4 w-4" />
                  Support Distillation
                </CardTitle>
                <CardDescription>
                  Analyze chunks to extract reusable Q&A and generate vector embeddings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={runDistill} 
                  disabled={isRunning || !activeSpace}
                  variant="secondary"
                  className="w-full font-bold h-11 rounded-xl shadow-lg shadow-indigo-500/10"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                  Distill Support Knowledge
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-60">Job History & Progress</h2>
                {recentJobs.some(j => j.status === 'running') && (
                    <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">
                        Job in progress...
                    </Badge>
                )}
            </div>
            
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden border-white/5 bg-white/[0.02]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                            job.status === 'completed' ? 'bg-green-500/10' : job.status === 'failed' ? 'bg-red-500/10' : 'bg-primary/10'
                        )}>
                            {getStatusIcon(job.status)}
                        </div>
                        <div>
                          <p className="text-sm font-bold capitalize">{job.type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight opacity-50">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                          "text-[10px] h-5 uppercase font-black px-2",
                          job.status === 'completed' ? 'border-green-500/50 text-green-500' : 
                          job.status === 'failed' ? 'border-red-500/50 text-red-500' : ''
                      )}>
                        {job.status}
                      </Badge>
                    </div>

                    {job.status === 'running' && job.progress && (
                      <div className="space-y-2 px-11 animate-in fade-in duration-500">
                        <Progress value={(job.progress.current / job.progress.total) * 100} className="h-1 rounded-full bg-white/5" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">{job.progress.message}</p>
                      </div>
                    )}

                    {job.status === 'failed' && job.error && (
                      <div className="ml-11 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <p className="text-[10px] text-red-400 font-medium">Error: {job.error}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {recentJobs.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed rounded-2xl border-white/5 bg-white/[0.01]">
                  <BrainCircuit className="mx-auto h-8 w-8 text-muted-foreground opacity-10 mb-2" />
                  <p className="text-sm text-muted-foreground font-medium italic">No recent brain activity detected.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="index" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search indexed chunks..." 
                className="pl-9 h-10 bg-white/5 border-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 font-bold border-white/10 bg-white/5 gap-2"
                onClick={handleMassReindex}
                disabled={isReindexing}
              >
                {isReindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Reindex Content Library
              </Button>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 h-10 px-4 text-xs font-bold uppercase">
                {indexedChunks.length} Chunks Total
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-4">
                {filteredChunks.map((chunk) => (
                  <Card key={chunk.id} className="bg-black/20 border-white/5 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tight h-5">
                            {chunk.sourceType?.replace(/_/g, ' ')}
                          </Badge>
                          <h4 className="text-sm font-bold truncate max-w-[300px]">{chunk.title}</h4>
                        </div>
                        {chunk.url && (
                          <a href={chunk.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 italic">
                          "{chunk.text}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-50">
                        <div className="flex gap-4">
                          <span>Vector Model: {chunk.embeddingModel}</span>
                          <span>Dims: {chunk.embeddingDim || 2048}</span>
                        </div>
                        <span>Indexed {formatDistanceToNow(new Date(chunk.createdAt || Date.now()), { addSuffix: true })}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredChunks.length === 0 && (
                  <div className="text-center py-20 opacity-50">
                    <Search className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm italic">No indexed content found matching your search.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
