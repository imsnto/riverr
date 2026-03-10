'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { EmailConfig, PhoneChannelLookup } from '@/lib/data';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Plus, Loader2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ConnectEmailDialog from './connect-email-dialog';
import EmailConfigDrawer from './email-config-drawer';
import { ScrollArea } from '../ui/scroll-area';

export default function PersonalChannelsSettings() {
    const { appUser } = useAuth();
    const { toast } = useToast();
    const [emails, setEmails] = useState<EmailConfig[]>([]);
    const [phones, setPhones] = useState<PhoneChannelLookup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnectOpen, setIsConnectOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<EmailConfig | null>(null);

    useEffect(() => {
        if (appUser) {
            const unsubEmails = db.subscribeToAgentEmailConfigs(appUser.id, setEmails);
            db.getDirectPhoneNumbersForUser(appUser.id).then(setPhones);
            setIsLoading(false);
            return () => unsubEmails();
        }
    }, [appUser]);

    const handleDisconnect = async (configId: string) => {
        if (!appUser) return;
        try {
            await db.deleteAgentEmailConfig(appUser.id, configId);
            toast({ title: 'Email disconnected' });
            setEditingConfig(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to disconnect' });
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h1 className="text-2xl font-bold">My Channels</h1>
                <p className="text-muted-foreground text-sm">Connect your personal accounts to send and receive messages.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Personal Email</CardTitle>
                            <CardDescription>Connect your work email to handle threads from your personal inbox.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setIsConnectOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Email Address
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="divide-y border rounded-lg overflow-hidden">
                        {emails.map(email => (
                            <div key={email.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{email.label || 'My Email'}</p>
                                        <p className="text-xs text-muted-foreground">{email.emailAddress}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase font-black px-1.5 h-5">Connected</Badge>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingConfig(email)} className="h-8 text-[10px] uppercase font-black">Configure</Button>
                                </div>
                            </div>
                        ))}
                        {emails.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground italic text-sm">No email addresses connected.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Direct Phone Number</CardTitle>
                    <CardDescription>Numbers assigned directly to you for SMS and Voice handling.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="divide-y border rounded-lg overflow-hidden">
                        {phones.map(phone => (
                            <div key={phone.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Phone className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{phone.channelAddress}</p>
                                        <p className="text-xs text-muted-foreground">{phone.label || 'Direct Line'}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-[10px] uppercase font-black px-1.5 h-5">Read Only</Badge>
                            </div>
                        ))}
                        {phones.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground italic text-sm">No direct number assigned. Contact your hub admin.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <ConnectEmailDialog 
                isOpen={isConnectOpen} 
                onOpenChange={setIsConnectOpen}
                userId={appUser?.id}
                hubId="agent"
                spaceId="personal"
            />

            {editingConfig && appUser && (
                <EmailConfigDrawer 
                    isOpen={!!editingConfig}
                    onOpenChange={(open) => !open && setEditingConfig(null)}
                    config={editingConfig}
                    spaceId={appUser.id}
                    hubId="agent"
                    onSave={(updated) => setEmails(prev => prev.map(e => e.id === updated.id ? updated : e))}
                    onDisconnect={handleDisconnect}
                />
            )}
        </div>
    );
}
