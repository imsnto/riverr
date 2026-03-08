
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Building2, Check, FolderKanban, Plus, Rocket, Star, Users, Headset } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Hub, Space, User, SpaceMember } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import HubComponentEditor from '@/components/dashboard/hub-component-editor';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

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
    const { appUser, setAppUser, userSpaces, setUserSpaces, setActiveSpace, setActiveHub, status, activeHub } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

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
            // We ignore the number of real spaces here because naming the space 
            // in step 2 promotes the onboarding space to a "real" space.
            if (appUser?.onboardingComplete) {
                router.push('/space-selection');
                return;
            }

            // If they have no spaces at all (edge case recovery)
            if (userSpaces.length === 0) {
                 router.push('/space-selection');
                 return;
            }
            
            setIsLoading(false);
        }

    }, [status, appUser?.onboardingComplete, userSpaces.length, router]);


    useEffect(() => {
        if (appUser) {
            setSpaceName(`${appUser.name}'s Workspace`);
        }
    }, [appUser]);

    const activeSpace = useAuth().activeSpace;
    const hubFormValues = { name: hubName, components: hubComponents };


    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading setup...</div>;
    }


    const totalSteps = 4;
    const progress = ((step - 1) / (totalSteps - 1)) * 100;

    const handleIntentSelect = async (selectedIntent: string) => {
        if (!appUser) return;
        setIntent(selectedIntent);
        // We don't await the user update to keep the UI snappy
        db.updateUser(appUser.id, { onboardingIntent: selectedIntent });
        
        const template = hubTemplates[selectedIntent];
        if (template) {
            setHubName(template.name);
            setHubComponents(template.components);
        }
        setStep(2);
    };
    
    const handleCreateSpace = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentSystemSpace = userSpaces.find(s => s.isOnboarding);
        if (!currentSystemSpace || !spaceName.trim() || !appUser) return;

        const membersMap: Record<string, { role: string }> = { [appUser.id]: { role: 'Admin' } };
        
        await db.updateSpace(currentSystemSpace.id, {
            name: spaceName,
            isSystem: false,
            isOnboarding: false,
            members: membersMap as any
        });
        
        const updatedSpaces = await db.getSpacesForUser(appUser.id);
        setUserSpaces(updatedSpaces);
        
        const newSpace = updatedSpaces.find(s => s.id === currentSystemSpace.id);
        if (newSpace) setActiveSpace(newSpace);

        setStep(3);
    };
    
    const handleCreateHub = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSpace || !hubName.trim() || !appUser) return;

        const newHubData: Omit<Hub, 'id'> = {
            name: hubName,
            spaceId: activeSpace.id,
            type: intent || 'custom',
            createdAt: new Date().toISOString(),
            createdBy: appUser.id,
            isDefault: true,
            settings: { components: hubComponents, defaultView: 'overview' },
            isPrivate: false,
            memberIds: [appUser.id],
            statuses: [],
        };

        const newHub = await db.addHub(newHubData);
        setActiveHub(newHub);
        setStep(4);
    };

    const handleLaunch = async () => {
        if (!activeSpace || !appUser) return;
        
        // Mark onboarding as complete
        await db.updateUser(appUser.id, { onboardingComplete: true });
        
        // IMPORTANT: Update local state immediately so the AuthProvider and page redirects see the change
        setAppUser(prev => prev ? { ...prev, onboardingComplete: true } : null);
        
        const hubToLaunch = activeHub;
        
        if (hubToLaunch) {
            router.push(`/space/${activeSpace.id}/hub/${hubToLaunch.id}/${hubToLaunch.settings.defaultView || 'overview'}`);
        } else {
            const fetchedHub = await db.getHubsForSpace(activeSpace.id).then(hubs => hubs[0]);
             if (fetchedHub) {
                 setActiveHub(fetchedHub);
                 router.push(`/space/${activeSpace.id}/hub/${fetchedHub.id}/${fetchedHub.settings.defaultView || 'overview'}`);
             } else {
                router.push('/space-selection');
             }
        }
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-2xl mx-auto">
                <Progress value={progress} className="mb-8" />
                
                {step === 1 && (
                    <div>
                        <h1 className="text-3xl font-bold text-center mb-2">Let’s build your workspace.</h1>
                        <p className="text-muted-foreground text-center mb-8">What are you hoping to build or manage?</p>
                        <div className="grid grid-cols-2 gap-4">
                            {intents.map(item => (
                                <Card key={item.id} className="cursor-pointer hover:border-primary" onClick={() => handleIntentSelect(item.id)}>
                                    <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                                        {item.icon}
                                        <p className="font-semibold mt-4">{item.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
                
                {step === 2 && (
                    <form onSubmit={handleCreateSpace}>
                        <h1 className="text-3xl font-bold text-center mb-2">Name your new Space.</h1>
                        <p className="text-muted-foreground text-center mb-8">This is the home for your company, project, or team.</p>
                        <Input 
                            value={spaceName}
                            onChange={e => setSpaceName(e.target.value)}
                            placeholder="e.g., Marketing Team"
                            className="text-lg h-12 text-center"
                            autoFocus
                        />
                         <div className="flex justify-between mt-8">
                            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleCreateHub}>
                         <div className="text-center">
                            <h1 className="text-3xl font-bold mb-2">Create your first Hub</h1>
                            <p className="text-muted-foreground text-center mb-6">A Hub is a focused workspace inside your Space. Use Hubs to organize teams, workflows, or business functions.</p>
                         </div>

                        <Accordion type="single" collapsible className="w-full mb-6">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>What’s the difference between a Space and a Hub?</AccordionTrigger>
                                <AccordionContent>
                                    <div className="text-sm text-muted-foreground space-y-2">
                                        <p><strong className="text-foreground">Space</strong> = Your company or organization.</p>
                                        <p><strong className="text-foreground">Hub</strong> = A focused environment for a team or function.</p>
                                        <p><strong className="text-foreground">Features</strong> = The tools available inside that Hub.</p>
                                        <p className="pt-2 text-xs">Example:<br/>Space: Acme Inc.<br/>Hub 1: Sales (Deals, Contacts, Inbox)<br/>Hub 2: Support (Tickets, Knowledge)</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Hub Name</label>
                                <Input value={hubName} onChange={e => setHubName(e.target.value)} placeholder="e.g. Project Hub" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Tools</label>
                                <HubComponentEditor selected={hubComponents} setSelected={setHubComponents} />
                            </div>
                             <Card className="bg-muted/50">
                                <CardContent className="p-4 space-y-2">
                                    <h4 className="font-semibold text-sm">This Hub will include:</h4>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                                        {hubFormValues.components.map(c => <li key={c} className="capitalize">{c.replace('-', ' ')}</li>)}
                                    </ul>
                                    {hubFormValues.components.includes('help-center') && (
                                        <>
                                            <Separator className="my-3"/>
                                            {knowledgeFeatureSummary}
                                        </>
                                    )}
                                    <p className="text-xs text-muted-foreground pt-2">You can change features anytime in settings.</p>
                                </CardContent>
                            </Card>
                        </div>

                         <div className="flex justify-between mt-8">
                            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </form>
                )}

                {step === 4 && (
                     <div>
                        <div className="text-center mb-8">
                            <div className="inline-block bg-green-100 dark:bg-green-900/50 p-3 rounded-full mb-4">
                                <Rocket className="h-10 w-10 text-green-500" />
                            </div>
                            <h1 className="text-3xl font-bold">You're all set!</h1>
                            <p className="text-muted-foreground mt-2">Here’s what your new workspace will include:</p>
                        </div>
                        <Card className="p-6">
                            <ul className="space-y-4">
                                <li className="flex items-center">
                                    <Check className="h-5 w-5 text-green-500 mr-3"/>
                                    <div><span className="font-semibold">Space:</span> {spaceName}</div>
                                </li>
                                <li className="flex items-center">
                                    <Check className="h-5 w-5 text-green-500 mr-3"/>
                                    <div><span className="font-semibold">Hub:</span> {hubName}</div>
                                </li>
                                <li className="flex items-start">
                                    <Check className="h-5 w-5 text-green-500 mr-3 mt-1"/>
                                    <div>
                                        <span className="font-semibold">Features:</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {hubComponents.map(comp => <Badge key={comp} variant="secondary">{comp.replace('-', ' ')}</Badge>)}
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </Card>
                         <div className="flex justify-between mt-8">
                            <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button onClick={handleLaunch}>Launch My Workspace <Rocket className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
