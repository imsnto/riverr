
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot as BotIcon, Sparkles, Settings, Loader2 } from 'lucide-react';
import { Bot, User, HelpCenter } from '@/lib/data';
import * as db from '@/lib/db';
import AgentSettingsDialog from './agent-settings-dialog';
import { useToast } from '@/hooks/use-toast';

interface PersonalAgentSettingsProps {
    helpCenters: HelpCenter[];
}

export default function PersonalAgentSettings({ helpCenters }: PersonalAgentSettingsProps) {
    const { appUser, firebaseUser, activeSpace } = useAuth();
    const { toast } = useToast();
    const [personalAgent, setPersonalAgent] = useState<Bot | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);

    useEffect(() => {
        if (appUser) {
            db.getPersonalAgent(appUser.id).then(agent => {
                setPersonalAgent(agent);
                setIsLoading(false);
            });
        }
    }, [appUser]);

    const handleCreateAgent = async () => {
        if (!appUser) return;
        setIsLoading(true);
        const newAgent: Omit<Bot, 'id'> = {
            ownerType: 'user',
            ownerId: appUser.id,
            name: `${appUser.name}'s Assistant`,
            isEnabled: true,
            aiEnabled: true,
            welcomeMessage: `Hi! I'm ${appUser.name}'s AI assistant. How can I help you?`,
            layout: 'default',
            styleSettings: {
                primaryColor: '#3b82f6',
                backgroundColor: '#111827',
                logoUrl: appUser.avatarUrl || '',
                chatbotIconsColor: '#3b82f6',
                chatbotIconsTextColor: '#ffffff'
            },
            agentIds: [appUser.id],
            allowedHelpCenterIds: [],
            identityCapture: { enabled: false, required: false },
            automations: { handoffKeywords: ['human', 'agent'], quickReplies: [] },
            escalationTriggers: { billingKeywords: [], sentimentThreshold: -0.5 },
            escalateToTeamInbox: true,
            hubId: 'personal',
            spaceId: activeSpace?.id || 'default'
        };
        try {
            const created = await db.addBot(newAgent);
            setPersonalAgent(created);
            setIsAgentDialogOpen(true);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to create agent' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAgent = async (data: any) => {
        if (personalAgent) {
            setPersonalAgent(data);
            toast({ title: 'Agent Updated' });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h1 className="text-2xl font-bold">My AI Agent</h1>
                <p className="text-muted-foreground text-sm">Your personal assistant for handling private messages and emails.</p>
            </div>

            {!personalAgent ? (
                <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/10">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <BotIcon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Your Personal AI Assistant</CardTitle>
                    <CardDescription className="max-w-md mx-auto mt-2">
                        Create a personal Agent to handle your direct inbox, set up auto-replies, and connect your own work email.
                    </CardDescription>
                    <Button onClick={handleCreateAgent} className="mt-8 px-10 h-12 rounded-xl shadow-lg shadow-primary/20 gap-2">
                        <Sparkles className="h-4 w-4" /> Create My Agent
                    </Button>
                </Card>
            ) : (
                <Card className="relative overflow-hidden border shadow-sm group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <BotIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    {personalAgent.name}
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase font-black tracking-tighter h-5">Personal</Badge>
                                </CardTitle>
                                <CardDescription>Status: {personalAgent.isEnabled ? 'Active' : 'Disabled'}</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => setIsAgentDialogOpen(true)} variant="outline" className="rounded-xl h-10 gap-2 font-bold border-white/10 hover:bg-muted transition-all">
                            <Settings className="h-4 w-4" /> Configure
                        </Button>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm border-t pt-6 bg-muted/20">
                        <div>
                            <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Knowledge</dt>
                            <dd className="font-bold flex items-center gap-1.5">
                                {personalAgent.allowedHelpCenterIds?.length ? (
                                    <><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> {personalAgent.allowedHelpCenterIds.length} Sources</>
                                ) : (
                                    <><div className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> No Sources</>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Escalation</dt>
                            <dd className="font-bold">{personalAgent.escalateToTeamInbox ? 'Team Inbox' : 'None'}</dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Channels</dt>
                            <dd className="flex flex-wrap gap-1.5 mt-1">
                                {personalAgent.channelConfig?.email?.enabled ? <Badge variant="secondary" className="h-5 text-[9px] font-bold">Email</Badge> : null}
                                {personalAgent.channelConfig?.sms?.enabled ? <Badge variant="secondary" className="h-5 text-[9px] font-bold">SMS</Badge> : null}
                                <Badge variant="outline" className="h-5 text-[9px] font-bold opacity-50 border-dashed">Direct</Badge>
                            </dd>
                        </div>
                    </CardContent>
                </Card>
            )}

            {personalAgent && (
                <AgentSettingsDialog
                    isOpen={isAgentDialogOpen}
                    onOpenChange={setIsAgentDialogOpen}
                    bot={personalAgent}
                    onSave={handleSaveAgent}
                    appUser={appUser}
                    allUsers={[]}
                    helpCenters={helpCenters}
                />
            )}
        </div>
    );
}
