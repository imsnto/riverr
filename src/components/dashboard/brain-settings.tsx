
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/db';
import { Loader2, Bot, Users, BrainCircuit, Lightbulb, Search } from 'lucide-react';
import { RawConversationNode, SupportIntentNode } from '@/lib/data';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { SalesConversationExtraction } from '@/ai/flows/distill-sales-intelligence';
import { searchSalesExtractionsAction, type SearchSalesExtractionsResult } from '@/app/actions/chat';

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

function SupportIntentNodeCard({ node }: { node: SupportIntentNode }) {
    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    {node.intentKey}
                </CardTitle>
                <CardDescription>
                    {node.title}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>View Details</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-4 text-sm">
                                <div>
                                    <h4 className="font-semibold">Description</h4>
                                    <p className="text-muted-foreground">{node.description}</p>
                                </div>
                                {node.answerVariants.map((variant, i) => (
                                    <div key={variant.variantId}>
                                        <h4 className="font-semibold">Answer Variant {i+1}</h4>
                                        <blockquote className="border-l-2 pl-4 text-muted-foreground italic mt-1">
                                            {variant.template}
                                        </blockquote>
                                    </div>
                                ))}
                                <Badge>{node.learnedFromNodeIds.length} source conversation(s)</Badge>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    )
}

type SalesExtractionResultWithScore = SalesConversationExtraction & { id: string; _searchScore?: number };

function SalesExtractionNodeCard({ node }: { node: SalesExtractionResultWithScore }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-semibold">
                    Extraction from Node <code className="text-xs bg-muted p-1 rounded">{node.sourceNodeId.substring(0, 8)}</code>
                </CardTitle>
                 <CardDescription>Outcome: <Badge variant={node.outcome === 'replied_positive' ? 'default' : 'secondary'}>{node.outcome}</Badge></CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>View Details</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-4 text-sm">
                                {node.leadPersonaHints && (
                                    <div>
                                        <h4 className="font-semibold">Persona Hints</h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {node.leadPersonaHints.industry && <Badge variant="outline">Industry: {node.leadPersonaHints.industry}</Badge>}
                                            {node.leadPersonaHints.role && <Badge variant="outline">Role: {node.leadPersonaHints.role}</Badge>}
                                            {node.leadPersonaHints.orgSize && <Badge variant="outline">Size: {node.leadPersonaHints.orgSize}</Badge>}
                                        </div>
                                    </div>
                                )}
                                {node.pains && node.pains.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold">Pains</h4>
                                        <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                                            {node.pains.map((pain, i) => <li key={i}>{pain}</li>)}
                                        </ul>
                                    </div>
                                )}
                                 {node.objections && node.objections.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold">Objections</h4>
                                        <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                                            {node.objections.map((o, i) => <li key={i}>{o}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {node.buyingSignals && node.buyingSignals.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold">Buying Signals</h4>
                                        <ul className="list-disc pl-5 mt-1 space-y-1 text-green-600">
                                            {node.buyingSignals.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
}

export default function BrainSettings() {
    const { toast } = useToast();
    const { activeSpace } = useAuth();
    const [isLoadingJob, setIsLoadingJob] = useState(false);
    const [isLoadingDistill, setIsLoadingDistill] = useState(false);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [rawConversations, setRawConversations] = useState<RawConversationNode[]>([]);
    const [supportIntents, setSupportIntents] = useState<SupportIntentNode[]>([]);
    const [salesExtractions, setSalesExtractions] = useState<SalesExtractionResultWithScore[]>([]);
    const [isSearching, setIsSearching] = useState(false);


    useEffect(() => {
        const fetchNodes = async () => {
            if (!activeSpace) return;
            setIsLoadingNodes(true);
            const [rawNodes, intentNodes, initialSalesExtractions] = await Promise.all([
                db.getMemoryNodes('raw_conversation'),
                db.getMemoryNodes('support_intent'),
                db.getSalesExtractions(activeSpace.id)
            ]);
            const spaceRawNodes = rawNodes.filter(n => n.spaceId === activeSpace.id);
            const spaceIntentNodes = intentNodes.filter(n => n.spaceId === activeSpace.id);
            setRawConversations(spaceRawNodes);
            setSupportIntents(spaceIntentNodes);
            setSalesExtractions(initialSalesExtractions as SalesExtractionResultWithScore[]);
            setIsLoadingNodes(false);
        };
        fetchNodes();
    }, [activeSpace]);


    const handleIngestConversations = async (channel: 'support' | 'sales') => {
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
                channel: channel,
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

    const handleDistillIntents = async (type: 'support_intent' | 'sales_intelligence') => {
        if (!activeSpace) {
            toast({
                variant: 'destructive',
                title: 'No active space',
                description: 'Please ensure you are in a valid workspace context.',
            });
            return;
        }
        setIsLoadingDistill(true);
        try {
            const jobType = type === 'support_intent' ? 'distill_support_intents' : 'distill_sales_intelligence';
            const jobId = await db.startBrainJob(jobType, { 
                spaceId: activeSpace.id,
            });
            toast({
                title: 'Job Started',
                description: `Started distillation job with ID: ${jobId}`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Failed to start job',
                description: 'Could not start the distillation job.',
            });
            console.error(error);
        } finally {
            setIsLoadingDistill(false);
        }
    };
    
    const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        if (!activeSpace) return;

        if (query.length < 2) {
            if(query.length === 0) {
                 const initialSalesExtractions = await db.getSalesExtractions(activeSpace.id);
                 setSalesExtractions(initialSalesExtractions as SalesExtractionResultWithScore[]);
            }
            return;
        }

        setIsSearching(true);
        const results = await searchSalesExtractionsAction({ query, spaceId: activeSpace.id });
        setSalesExtractions(results.extractions as SalesExtractionResultWithScore[]);
        setIsSearching(false);
    }

    return (
        <Tabs defaultValue="support" className="space-y-6">
            <TabsList>
                <TabsTrigger value="support">Support Intelligence</TabsTrigger>
                <TabsTrigger value="sales">Sales Intelligence</TabsTrigger>
            </TabsList>

            <TabsContent value="support" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Business Brain Jobs (Support)</CardTitle>
                        <CardDescription>
                            Manually trigger jobs to process data for the support brain.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <h3 className="font-semibold">1. Ingest Support Conversations</h3>
                                <p className="text-sm text-muted-foreground">
                                    Import and process support tickets from connected sources (e.g., email).
                                </p>
                            </div>
                            <Button onClick={() => handleIngestConversations('support')} disabled={isLoadingJob}>
                                {isLoadingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Start Ingestion
                            </Button>
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <h3 className="font-semibold">2. Distill Support Intents</h3>
                                <p className="text-sm text-muted-foreground">
                                    Analyze conversations to create a structured answer library.
                                </p>
                            </div>
                            <Button onClick={() => handleDistillIntents('support_intent')} disabled={isLoadingDistill}>
                                {isLoadingDistill && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Start Distillation
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Distilled Support Intents ({supportIntents.length})</CardTitle>
                        <CardDescription>
                            The structured knowledge the agent uses to answer support questions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoadingNodes ? (
                             <div className="flex items-center justify-center gap-2 py-8">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-muted-foreground">Loading distilled knowledge...</span>
                            </div>
                        ) : supportIntents.length > 0 ? (
                            <div className="space-y-4">
                                {supportIntents.map(node => <SupportIntentNodeCard key={node.id} node={node} />)}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <BrainCircuit className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-2 text-sm font-semibold text-foreground">No Distilled Knowledge</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Run a distillation job to build the answer library.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

             <TabsContent value="sales" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Business Brain Jobs (Sales)</CardTitle>
                        <CardDescription>
                            Manually trigger jobs to process data for the sales brain.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <h3 className="font-semibold">1. Ingest Sales Conversations</h3>
                                <p className="text-sm text-muted-foreground">
                                    Import and process sales conversations from connected sources.
                                </p>
                            </div>
                            <Button onClick={() => handleIngestConversations('sales')} disabled={isLoadingJob}>
                                {isLoadingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Start Ingestion
                            </Button>
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <h3 className="font-semibold">2. Distill Sales Intelligence</h3>
                                <p className="text-sm text-muted-foreground">
                                    Analyze sales conversations to extract personas, pains, and signals.
                                </p>
                            </div>
                            <Button onClick={() => handleDistillIntents('sales_intelligence')} disabled={isLoadingDistill}>
                                {isLoadingDistill && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Start Distillation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Sales Intelligence Extractions ({salesExtractions.length})</CardTitle>
                        <CardDescription>
                            Search and audit the structured data extracted from sales conversations.
                        </CardDescription>
                         <div className="relative pt-4">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search pains, objections, signals..." className="pl-8" onChange={handleSearch} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isSearching ? (
                            <div className="flex items-center justify-center gap-2 py-8">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-muted-foreground">Searching...</span>
                            </div>
                        ) : salesExtractions.length > 0 ? (
                            <div className="space-y-4">
                                {salesExtractions.map(node => <SalesExtractionNodeCard key={node.id} node={node} />)}
                            </div>
                        ) : (
                             <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <BrainCircuit className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-2 text-sm font-semibold text-foreground">No Sales Extractions Found</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Run a sales distillation job to build this library.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

        </Tabs>
    );
}
