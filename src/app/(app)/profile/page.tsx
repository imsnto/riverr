
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateUser, getPersonalAgent, addBot, getAllUsers, getHelpCenters } from '@/lib/db';
import { getInitials } from '@/lib/utils';
import { Key, Copy, Bot as BotIcon, ArrowRight, Sparkles, MessageCircle, Settings, User as UserIcon } from 'lucide-react';
import { Bot, User, HelpCenter } from '@/lib/data';
import AgentSettingsDialog from '@/components/dashboard/agent-settings-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProfilePage() {
    const { appUser, setAppUser, firebaseUser, activeSpace } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [name, setName] = useState(appUser?.name || '');
    const [avatar, setAvatar] = useState(appUser?.avatarUrl || '');
    const [personalAgent, setPersonalAgent] = useState<Bot | null>(null);
    const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
    const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeTab = searchParams.get('tab') || 'account';

    useEffect(() => {
        if (appUser) {
            getPersonalAgent(appUser.id).then(setPersonalAgent);
            if (activeSpace) {
                getHelpCenters(activeSpace.id).then(setHelpCenters);
            }
        }
    }, [appUser, activeSpace]);

    if (!appUser) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveChanges = async () => {
        if (appUser && firebaseUser) {
            const updatedUserData = {
                name: name,
                avatarUrl: avatar,
            };
            
            try {
                await updateUser(firebaseUser.uid, updatedUserData);
                setAppUser(prevUser => prevUser ? { ...prevUser, ...updatedUserData } : null);
                toast({
                    title: 'Profile Updated',
                    description: 'Your profile has been successfully updated.',
                });
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Update Failed',
                    description: 'Could not update your profile. Please try again.',
                });
            }
        }
    }

    const handleCreateAgent = async () => {
        if (!appUser) return;
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
        const created = await addBot(newAgent);
        setPersonalAgent(created);
        setIsAgentDialogOpen(true);
    };

    const handleSaveAgent = async (data: any) => {
        if (personalAgent) {
            await updateUser(firebaseUser!.uid, {}); // dummy update to trigger refresh or call setPersonalAgent
            setPersonalAgent(data);
            toast({ title: 'Agent Updated' });
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
             <Button variant="ghost" onClick={() => router.push('/')} className="absolute top-4 left-4">
                &larr; Back to Dashboard
            </Button>
            <div className="w-full max-w-2xl space-y-8">
                <div className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 mb-4 ring-4 ring-primary/10">
                        <AvatarImage src={avatar} alt={name} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <h1 className="text-3xl font-bold">{name}</h1>
                    <p className="text-muted-foreground">{appUser.email}</p>
                </div>

                <Tabs defaultValue={activeTab} className="w-full" onValueChange={(v) => router.push(`/profile?tab=${v}`)}>
                    <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-muted/50 p-1">
                        <TabsTrigger value="account" className="rounded-lg gap-2">
                            <UserIcon className="h-4 w-4" /> Account
                        </TabsTrigger>
                        <TabsTrigger value="agent" className="rounded-lg gap-2">
                            <Sparkles className="h-4 w-4" /> My AI Agent
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="account" className="space-y-6 pt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Account Details</CardTitle>
                                <CardDescription>Manage your public identity and core account settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col items-center space-y-4">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        ref={fileInputRef} 
                                        onChange={handleAvatarChange} 
                                        className="hidden" 
                                    />
                                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        Change Profile Picture
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Display Name</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={appUser.email} disabled className="h-11 bg-muted/20" />
                                    <p className="text-xs text-muted-foreground pl-1">Primary email for your Manowar account.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/30 border-t p-6">
                                <Button onClick={handleSaveChanges} className="w-full md:w-auto ml-auto px-8">Save Changes</Button>
                            </CardFooter>
                        </Card>

                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Key className="h-4 w-4" />
                                    Developer API Tools
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Use your authentication token for API testing or local integration development.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" size="sm" className="w-full gap-2 h-10 border-primary/20 hover:bg-primary/10" onClick={async () => {
                                    if (firebaseUser) {
                                        const token = await firebaseUser.getIdToken(true);
                                        await navigator.clipboard.writeText(token);
                                        toast({ title: 'Token Copied' });
                                    }
                                }}>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Session ID Token
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="agent" className="space-y-6 pt-4">
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
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
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
                                            <Badge variant="outline" className="h-5 text-[9px] font-bold opacity-50 border-dashed">Web</Badge>
                                        </dd>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

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
