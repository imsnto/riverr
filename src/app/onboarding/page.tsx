
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Building2, Check, FolderKanban, Plus, Rocket, Star, Users, Headset, LogOut, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Hub, Space, User, Status } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import HubComponentEditor from '@/components/dashboard/hub-component-editor';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: '#6b7280' },
    { name: 'In Progress', color: '#3b82f6' },
    { name: 'In Review', color: '#f59e0b' },
    { name: 'Done', color: '#22c55e' },
];

const intents = [
    { id: 'project-management', label: 'Project Management', icon: <FolderKanban className="h-8 w-8" /> },
    { id: 'sales-crm', label: 'Sales / CRM', icon: <Star className="h-8 w-8" /> },
    { id: 'support', label: 'Support', icon: <Headset className="h-8 w-8" /> },
    { id: 'internal-ops', label: 'Internal Team Ops', icon: <Users className="h-8 w-8" /> },
    { id: 'client-delivery', label: 'Client Delivery', icon: <Building2 className="h-8 w-8" /> },
];

const hubTemplates: Record<string, { name: string, components: string[] }> = {
    'project-management': { name: 'Project Hub', components: ['tasks', 'help-center'] },
    'sales-crm': { name: 'Sales Hub', components: ['deals', 'contacts', 'inbox'] },
    'support': { name: 'Support Hub', components: ['tickets', 'help-center', 'inbox'] },
    'internal-ops': { name: 'Team Hub', components: ['tasks', 'help-center'] },
    'client-delivery': { name: 'Client Hub', components: ['tasks', 'inbox'] }
};

const knowledgeFeatureSummary = (
    <div className="text-sm space-y-1">
        <p>Knowledge will allow you to:</p>
        <ul className="list-disc list-inside text-muted-foreground text-xs">
            <li>Create internal documentation</li>
            <li>Publish public help articles</li>
            <li>Build a shared brain for your team</li>
        </ul>
    </div>
);


export default function OnboardingPage() {
    const { appUser, setAppUser, signOut, userSpaces, status, setActiveSpace, setActiveHub } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isLaunching, setIsLaunching] = useState(false);

    // Form states
    const [intent, setIntent] = useState('');
    const [spaceName, setSpaceName] = useState('');
    const [hubName, setHubName] = useState('');
    const [hubComponents, setHubComponents] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'loading') {
            return;
        }

        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            // ONLY redirect if onboarding is strictly complete.
            if (appUser?.onboardingComplete) {
                router.push('/');
                return;
            }
            
            setIsLoading(false);
        }

    }, [status, appUser?.onboardingComplete, router]);


    useEffect(() => {
        if (appUser && !spaceName) {
            setSpaceName(`${appUser.name.split(' ')[0]}'s Workspace`);
        }
    }, [appUser, spaceName]);

    const handleIntentSelect = (selectedIntent: string) => {
        setIntent(selectedIntent);
        const template = hubTemplates[selectedIntent];
        if (template) {
            setHubName(template.name);
            setHubComponents(template.components);
        }
        setStep(2);
    };
    
    const handleCreateSpace = (e: React.FormEvent) => {
        e.preventDefault();
        if (!spaceName.trim()) return;
        setStep(3);
    };
    
    const handleCreateHub = (e: React.FormEvent) => {
        e.preventDefault();
        if (!hubName.trim()) return;
        setStep(4);
    };

    const handleLaunch = async () => {
        if (!appUser || !spaceName.trim() || !hubName.trim()) return;
        
        setIsLaunching(true);
        try {
            // 1. Create the Space
            const membersMap: Record<string, { role: string }> = { [appUser.id]: { role: 'Admin' } };
            const newSpaceId = await db.addSpace({
                name: spaceName,
                members: membersMap as any,
                isSystem: false,
                isOnboarding: false
            });

            // 2. Create the Hub
            const newHubData: Omit<Hub, 'id'> = {
                name: hubName,
                spaceId: newSpaceId,
                type: intent || 'project-management',
                createdAt: new Date().toISOString(),
                createdBy: appUser.id,
                isDefault: true,
                settings: { components: hubComponents, defaultView: 'overview' },
                isPrivate: false,
                memberIds: [appUser.id],
                statuses: defaultStatuses,
            };
            const newHub = await db.addHub(newHubData);

            // 3. Mark onboarding as complete for the user
            await db.updateUser(appUser.id, { 
                onboardingComplete: true,
                onboardingIntent: intent 
            });
            
            // 4. Update local state immediately so AuthProvider/Layout can react
            setAppUser(prev => prev ? { ...prev, onboardingComplete: true } : null);
            
            // 5. Explicitly set active context for immediate redirect logic
            // (The AuthProvider will also pick this up via its spaces subscription eventually)
            const spaceObj = { id: newSpaceId, name: spaceName, members: membersMap as any };
            setActiveSpace(spaceObj as Space);
            setActiveHub(newHub);

            toast({ title: 'Workspace ready!', description: 'Welcome to Manowar.' });
            
            const view = newHub.settings?.defaultView || 'overview';
            router.push(`/space/${newSpaceId}/hub/${newHub.id}/${view}`);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to create workspace', description: 'Please try again later.' });
            setIsLaunching(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Setting up your onboarding experience...</p>
            </div>
        );
    }

    const totalSteps = 4;
    const progress = ((step - 1) / (totalSteps - 1)) * 100;

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-background p-4">
            {/* Stuck protection */}
            <div className="absolute top-6 right-6">
                <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                </Button>
            </div>

            <div className="w-full max-w-2xl mx-auto">
                <Progress value={progress} className="mb-8" />
                
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-3xl font-bold text-center mb-2">Let’s build your workspace.</h1>
                        <p className="text-muted-foreground text-center mb-8">What are you hoping to build or manage?</p>
                        <div className="grid grid-cols-2 gap-4">
                            {intents.map(item => (
                                <Card key={item.id} className="cursor-pointer hover:border-primary transition-all hover:scale-[1.02]" onClick={() => handleIntentSelect(item.id)}>
                                    <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary mb-4">
                                            {item.icon}
                                        </div>
                                        <p className="font-semibold">{item.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
                
                {step === 2 && (
                    <form onSubmit={handleCreateSpace} className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <h1 className="text-3xl font-bold text-center mb-2">Name your new Space.</h1>
                        <p className="text-muted-foreground text-center mb-8">This is the home for your company, project, or team.</p>
                        <Input 
                            value={spaceName}
                            onChange={e => setSpaceName(e.target.value)}
                            placeholder="e.g., Marketing Team"
                            className="text-lg h-14 text-center bg-muted/20 border-2"
                            autoFocus
                        />
                         <div className="flex justify-between mt-12">
                            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button type="submit" size="lg" disabled={!spaceName.trim()}>Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleCreateHub} className="animate-in fade-in slide-in-from-right-4 duration-500">
                         <div className="text-center">
                            <h1 className="text-3xl font-bold mb-2">Create your first Hub</h1>
                            <p className="text-muted-foreground text-center mb-6">A Hub is a focused workspace inside your Space. Use Hubs to organize teams or business functions.</p>
                         </div>

                        <Accordion type="single" collapsible className="w-full mb-6">
                            <AccordionItem value="item-1" className="border-none bg-muted/30 rounded-xl px-4">
                                <AccordionTrigger className="hover:no-underline">What’s the difference between a Space and a Hub?</AccordionTrigger>
                                <AccordionContent>
                                    <div className="text-sm text-muted-foreground space-y-2 pb-2">
                                        <p><strong className="text-foreground">Space</strong> = Your company or organization.</p>
                                        <p><strong className="text-foreground">Hub</strong> = A focused environment for a team (e.g., Sales Hub, Dev Hub).</p>
                                        <p><strong className="text-foreground">Features</strong> = The specific tools active in that environment.</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Hub Name</label>
                                <Input value={hubName} onChange={e => setHubName(e.target.value)} placeholder="e.g. Project Hub" className="h-12" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Tools</label>
                                <HubComponentEditor selected={hubComponents} setSelected={setHubComponents} />
                            </div>
                             <Card className="bg-primary/5 border-primary/10">
                                <CardContent className="p-4 space-y-2">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <Check className="h-4 w-4 text-primary" />
                                        This Hub will include:
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground pl-6">
                                        {hubComponents.map(c => <li key={c} className="capitalize">{c.replace('-', ' ')}</li>)}
                                    </ul>
                                    {hubComponents.includes('help-center') && (
                                        <>
                                            <Separator className="my-3"/>
                                            {knowledgeFeatureSummary}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                         <div className="flex justify-between mt-12">
                            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button type="submit" size="lg" disabled={!hubName.trim() || hubComponents.length === 0}>Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </form>
                )}

                {step === 4 && (
                     <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="text-center mb-8">
                            <div className="inline-block bg-green-100 dark:bg-green-900/50 p-4 rounded-full mb-4">
                                <Rocket className="h-12 w-12 text-green-500" />
                            </div>
                            <h1 className="text-3xl font-bold">You're ready to launch!</h1>
                            <p className="text-muted-foreground mt-2">Double check your configuration before we build your space.</p>
                        </div>
                        <Card className="p-6 border-2">
                            <ul className="space-y-6">
                                <li className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Space</p>
                                        <p className="font-bold text-lg">{spaceName}</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <Plus className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Default Hub</p>
                                        <p className="font-bold text-lg">{hubName}</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <FolderKanban className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Active Features</p>
                                        <div className="flex flex-wrap gap-2">
                                            {hubComponents.map(comp => <Badge key={comp} variant="secondary" className="capitalize">{comp.replace('-', ' ')}</Badge>)}
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </Card>
                         <div className="flex justify-between mt-12">
                            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isLaunching}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button onClick={handleLaunch} size="lg" disabled={isLaunching} className="px-10 shadow-xl shadow-primary/20">
                                {isLaunching ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating your workspace...</>
                                ) : (
                                    <>Launch My Workspace <Rocket className="ml-2 h-4 w-4"/></>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
