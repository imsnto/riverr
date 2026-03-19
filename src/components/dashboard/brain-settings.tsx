'use client';

import React, { useState, useEffect } from 'react';
import * as db from '@/lib/db';
import type { Space, Hub, BrainJob } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BrainCircuit, MessageSquare, Lightbulb, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as firestore } from '@/lib/firebase';

interface BrainSettingsProps {
  activeSpace: Space | null;
  activeHub: Hub | null;
}

export default function BrainSettings({ activeSpace, activeHub }: BrainSettingsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [recentJobs, setRecentJobs] = useState<BrainJob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!activeSpace) return;

    const q = query(
      collection(firestore, 'brain_jobs'),
      where('params.spaceId', '==', activeSpace.id),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrainJob));
      setRecentJobs(jobs);
    });

    return () => unsubscribe();
  }, [activeSpace]);

  const runIngest = async () => {
    if (!activeSpace || !activeHub) return;
    setIsRunning(true);
    try {
      const jobId = await db.startBrainJob('ingest_conversations', {
        spaceId: activeSpace.id,
        hubId: activeHub.id,
      });
      toast({ title: 'Ingestion Started', description: `Started job ID: ${jobId}` });
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
      toast({ title: 'Distillation Started', description: `Started job ID: ${jobId}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to start distillation' });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header>
        <h1 className="text-2xl font-bold">Business Brain</h1>
        <p className="text-muted-foreground">Train your AI Agent by distilling knowledge from past conversations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-primary/10 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversation Ingestion
            </CardTitle>
            <CardDescription>
              Collect messages from this hub and prepare them for processing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runIngest} 
              disabled={isRunning || !activeSpace || !activeHub}
              className="w-full font-bold"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Run Ingestion
            </Button>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 bg-indigo-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-indigo-500" />
              Support Distillation
            </CardTitle>
            <CardDescription>
              Analyze ingested messages to create high-quality support intents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runDistill} 
              disabled={isRunning || !activeSpace}
              variant="secondary"
              className="w-full font-bold"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
              Distill Knowledge
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Recent Activity</h2>
        <div className="space-y-3">
          {recentJobs.map((job) => (
            <Card key={job.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="text-sm font-bold capitalize">{job.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">
                        Started {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 uppercase font-black">
                    {job.status}
                  </Badge>
                </div>

                {job.status === 'running' && job.progress && (
                  <div className="space-y-2 animate-in fade-in duration-500">
                    <Progress value={(job.progress.current / job.progress.total) * 100} className="h-1.5" />
                    <p className="text-[10px] text-center text-muted-foreground italic">{job.progress.message}</p>
                  </div>
                )}

                {job.status === 'failed' && job.error && (
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] text-red-400 font-medium">Error: {job.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {recentJobs.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <BrainCircuit className="mx-auto h-8 w-8 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground mt-2">No recent brain activity in this space.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}