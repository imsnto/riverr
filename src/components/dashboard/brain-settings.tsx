'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/db';
import { Loader2 } from 'lucide-react';

export default function BrainSettings() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleIngestConversations = async () => {
        setIsLoading(true);
        try {
            const jobId = await db.startBrainJob('ingest_conversations', { source: 'gmail' });
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
            setIsLoading(false);
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
                        <Button onClick={handleIngestConversations} disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Start Ingestion
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
