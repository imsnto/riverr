
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Building2, Check, FolderKanban, Plus, Rocket, Star, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Hub, Space, User } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import HubComponentEditor from '@/components/dashboard/hub-component-editor';
import { SpaceMember } from '@/lib/data';

const intents = [
    { id: 'project-management', label: 'Project Management', icon: <FolderKanban className="h-8 w-8" /> },
    { id: 'sales-crm', label: 'Sales / CRM', icon: <Star className="h-8 w-8" /> },
    { id: 'internal-ops', label: 'Internal Team Ops', icon: <Users className="h-8 w-8" /> },
    { id: 'client-delivery', label: 'Client Delivery', icon: <Building2 className="h-8 w-8" /> },
];

const hubTemplates: Record<string, { name: string, components: string[] }> = {
    'project-management': { name: 'Project Hub', components: ['tasks', 'documents'] },
    'sales-crm': { name: 'Sales Hub', components: ['deals', 'contacts'] },
    'internal-ops': { name: 'Team Hub', components: ['tasks', 'documents'] },
    'client-delivery': { name: 'Client Hub', components: ['tasks', 'inbox'] }
};

export default function OnboardingPage() {
    const { appUser, userSpaces, setUserSpaces, setActiveSpace, setActiveHub, status } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [step, setStep] = useState(1);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    // Form states
    const [intent, setIntent] = useState('');
    const [spaceName, setSpaceName] = useState('');
    const [hubName, setHubName] = useState('');
    const [hubComponents, setHubComponents] = useState<string[]>([]);

    useEffect(() => {
        if (appUser) {
            db.getAllUsers().then(setAllUsers);
            setSpaceName(`${appUser.name}'s Workspace`);
        }
    }, [appUser]);

    if (status === 'loading' || !appUser || userSpaces.length === 0) {
        return <div>Loading...</div>;
    }

    const systemSpace = userSpaces.find(s => s.isOnboarding);

    if (!systemSpace && status === 'authenticated') {
        router.push('/space-selection');
        return null;
    }

    const totalSteps = 4;
    const progress = ((step - 1) / (totalSteps - 1)) * 100;

    const handleIntentSelect = async (selectedIntent: string) => {
        setIntent(selectedIntent);
        await db.updateUser(appUser.id, { onboardingIntent: selectedIntent });
        const template = hubTemplates[selectedIntent];
        if (template) {
            setHubName(template.name);
            setHubComponents(template.components);
        }
        setStep(2);
    };
    
    const handleCreateSpace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!systemSpace || !spaceName.trim()) return;

        const membersMap: Record<string, SpaceMember> = { [appUser.id]: { role: 'Admin' } };
        await db.updateSpace(systemSpace.id, {
            name: spaceName,
            isSystem: false,
            isOnboarding: false,
            members: membersMap
        });
        const updatedSpaces = await db.getSpacesForUser(appUser.id);
        setUserSpaces(updatedSpaces);
        const newSpace = updatedSpaces.find(s => s.id === systemSpace.id);
        if (newSpace) setActiveSpace(newSpace);

        setStep(3);
    };
    
    const handleCreateHub = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!systemSpace || !hubName.trim()) return;

        const newHubData: Omit<Hub, 'id'> = {
            name: hubName,
            spaceId: systemSpace.id,
            type: intent || 'custom',
            createdAt: new Date().toISOString(),
            createdBy: appUser.id,
            isDefault: true,
            settings: { components: hubComponents, defaultView: hubComponents[0] || 'tasks' },
            isPrivate: false,
            memberIds: [appUser.id],
            statuses: [],
        };

        const newHub = await db.addHub(newHubData);
        setActiveHub(newHub);
        setStep(4);
    };

    const handleLaunch = async () => {
        await db.updateUser(appUser.id, { onboardingComplete: true });
        const hub = await db.getHubsForSpace(systemSpace!.id).then(hubs => hubs[0]);
        if (hub) {
            router.push(`/space/${systemSpace!.id}/hub/${hub.id}/${hub.settings.defaultView || 'overview'}`);
        } else {
            router.push('/space-selection');
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
                        />
                         <div className="flex justify-between mt-8">
                            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleCreateHub}>
                        <h1 className="text-3xl font-bold text-center mb-2">Create your first Hub.</h1>
                        <p className="text-muted-foreground text-center mb-8">Hubs are workspaces within your Space. Let's customize it.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Hub Name</label>
                                <Input value={hubName} onChange={e => setHubName(e.target.value)} placeholder="e.g. Project Hub" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Features</label>
                                <HubComponentEditor selected={hubComponents} setSelected={setHubComponents} />
                            </div>
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
                                            {hubComponents.map(comp => <Badge key={comp} variant="secondary">{comp}</Badge>)}
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
