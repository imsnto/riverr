
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot as BotIcon, Sparkles, Settings, Loader2, Plus, MoreHorizontal, Copy, Trash2 } from 'lucide-react';
import { Bot, User, HelpCenter } from '@/lib/data';
import * as db from '@/lib/db';
import AgentSettingsDialog from './agent-settings-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface PersonalAgentSettingsProps {
    helpCenters: HelpCenter[];
}

export default function PersonalAgentSettings({ helpCenters }: PersonalAgentSettingsProps) {
    const { appUser, activeSpace } = useAuth();
    const { toast } = useToast();
    const [personalAgents, setPersonalAgents] = useState<Bot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Bot | null>(null);
    const [agentToDelete, setAgentToDelete] = useState<Bot | null>(null);

    const refreshAgents = async () => {
        if (appUser) {
            const agents = await db.getPersonalAgents(appUser.id);
            setPersonalAgents(agents);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshAgents();
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
            setPersonalAgents(prev => [...prev, created]);
            setSelectedAgent(created);
            setIsAgentDialogOpen(true);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to create agent' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDuplicateAgent = async (bot: Bot) => {
        const { id, ...rest } = bot;
        const duplicatedData: Omit<Bot, 'id'> = {
            ...rest,
            name: `${bot.name} (Copy)`,
        };
        try {
            const created = await db.addBot(duplicatedData);
            setPersonalAgents(prev => [...prev, created]);
            toast({ title: 'Agent Duplicated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to duplicate agent' });
        }
    };

    const handleSaveAgent = async (data: any) => {
        if ('id' in data) {
            await db.updateBot(data.id, data);
            toast({ title: 'Agent Updated' });
            refreshAgents();
        }
    };

    const handleDeleteConfirm = async () => {
        if (!agentToDelete) return;
        try {
            await db.deleteBot(agentToDelete.id);
            toast({ title: 'Agent deleted' });
            refreshAgents();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Failed to delete agent' });
        } finally {
            setAgentToDelete(null);
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">My AI Agents</h1>
                    <p className="text-muted-foreground text-sm">Your personal assistants for handling private messages and emails.</p>
                </div>
                {personalAgents.length > 0 && (
                    <Button onClick={handleCreateAgent} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        New Agent
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                {personalAgents.map((agent) => (
                    <Card key={agent.id} className="relative overflow-hidden border shadow-sm group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                    <BotIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        {agent.name}
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase font-black tracking-tighter h-5">Personal</Badge>
                                    </CardTitle>
                                    <CardDescription>Status: {agent.isEnabled ? 'Active' : 'Disabled'}</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => { setSelectedAgent(agent); setIsAgentDialogOpen(true); }} variant="outline" className="rounded-xl h-10 gap-2 font-bold border-white/10 hover:bg-muted transition-all">
                                    <Settings className="h-4 w-4" /> Configure
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-10 w-10">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleDuplicateAgent(agent)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Duplicate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setAgentToDelete(agent)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm border-t pt-6 bg-muted/20">
                            <div>
                                <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Knowledge</dt>
                                <dd className="font-bold flex items-center gap-1.5">
                                    {agent.allowedHelpCenterIds?.length ? (
                                        <><div className="h-1.5 w-1.5 rounded-full bg-green-500" /> {agent.allowedHelpCenterIds.length} Sources</>
                                    ) : (
                                        <><div className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> No Sources</>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Escalation</dt>
                                <dd className="font-bold">{agent.escalateToTeamInbox ? 'Team Inbox' : 'None'}</dd>
                            </div>
                            <div className="col-span-2">
                                <dt className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Channels</dt>
                                <dd className="flex flex-wrap gap-1.5 mt-1">
                                    {agent.channelConfig?.email?.enabled ? <Badge variant="secondary" className="h-5 text-[9px] font-bold">Email</Badge> : null}
                                    {agent.channelConfig?.sms?.enabled ? <Badge variant="secondary" className="h-5 text-[9px] font-bold">SMS</Badge> : null}
                                    <Badge variant="outline" className="h-5 text-[9px] font-bold opacity-50 border-dashed">Direct</Badge>
                                </dd>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {personalAgents.length === 0 && (
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
                )}
            </div>

            {selectedAgent && (
                <AgentSettingsDialog
                    isOpen={isAgentDialogOpen}
                    onOpenChange={setIsAgentDialogOpen}
                    bot={selectedAgent}
                    onSave={handleSaveAgent}
                    appUser={appUser}
                    allUsers={[]}
                    helpCenters={helpCenters}
                />
            )}

            <AlertDialog open={!!agentToDelete} onOpenChange={() => setAgentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the agent "{agentToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className={cn(buttonVariants({ variant: 'destructive' }))}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
