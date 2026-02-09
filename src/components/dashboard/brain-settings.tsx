
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/db';
import { Loader2, Bot, Users } from 'lucide-react';
import { RawConversationNode } from '@/lib/data';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

function RawConversationNodeCard({ node }: { node: RawConversationNode }) {
    const participants = node.participants || [];
    const customer = participants.find(p => p.role === 'customer');
    const agents = participants.filter(p => p.role === 'agent' || p.role === 'rep');

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-semibold">
                    {customer ? `Conversation with ${customer.name}` : 'Internal Conversation'}
                </CardTitle>
                <CardDescription>
                    From {node.sourceType} on {format(new Date(node.startedAt), 'PPP')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Participants:</span>
                    <div className="flex flex-wrap gap-1">
                        {agents.map(p => <Badge key={p.email} variant="secondary">{p.name}</Badge>)}
                        {customer && <Badge variant="outline">{customer.name}</Badge>}
                    </div>
                </div>
                <ScrollArea className="h-40 border rounded-md p-2 bg-muted/50">
                    <pre className="text-xs whitespace-pre-wrap font-sans">
                        {node.normalized.cleanedText}
                    </pre>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}


export default function BrainSettings() {
    const { toast } = useToast();
    const { activeSpace } = useAuth();
    const [isLoadingJob, setIsLoadingJob] = useState(false);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [rawConversations, setRawConversations] = useState<RawConversationNode[]>([]);

    useEffect(() => {
        const fetchNodes = async () => {
            if (!activeSpace) return;
            setIsLoadingNodes(true);
            const nodes = await db.getMemoryNodes('raw_conversation');
            const spaceNodes = nodes.filter(n => n.spaceId === activeSpace.id);
            setRawConversations(spaceNodes);
            setIsLoadingNodes(false);
        };
        fetchNodes();
    }, [activeSpace]);


    const handleIngestConversations = async () => {
        if (!activeSpace) {
            toast({
                variant: 'destructive',
                title: 'No active space',
                description: 'Please ensure you are in a valid workspace context.',
            });
            return;
        }
        setIsLoadingJob(true);
        try {
            const jobId = await db.startBrainJob('ingest_conversations', { 
                source: 'gmail',
                spaceId: activeSpace.id,
            });
            toast({
                title: 'Job Started',
                description: `Started conversation ingestion job with ID: ${jobId}`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Failed to start job',
                description: 'Could not start the conversation ingestion job.',
            });
            console.error(error);
        } finally {
            setIsLoadingJob(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Business Brain Jobs</CardTitle>
                    <CardDescription>
                        Manually trigger jobs to process data and build the business brain.
                        In a production system, this would be automated.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <h3 className="font-semibold">Ingest Historical Conversations</h3>
                            <p className="text-sm text-muted-foreground">
                                Import and process conversations from connected sources (e.g., email).
                            </p>
                        </div>
                        <Button onClick={handleIngestConversations} disabled={isLoadingJob}>
                            {isLoadingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Start Ingestion
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Raw Memory Nodes</CardTitle>
                    <CardDescription>
                        Audit the raw, normalized conversations ingested into the brain.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingNodes ? (
                         <div className="flex items-center justify-center gap-2 py-8">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-muted-foreground">Loading memory nodes...</span>
                        </div>
                    ) : rawConversations.length > 0 ? (
                        <div className="space-y-4">
                            {rawConversations.map(node => <RawConversationNodeCard key={node.id} node={node} />)}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-sm font-semibold text-foreground">No Memory Nodes Found</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Run an ingestion job to populate the brain's memory.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
