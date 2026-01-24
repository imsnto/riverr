
'use client';

import React from 'react';
import { HelpCenter } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

interface HelpCenterSettingsProps {
    helpCenter: HelpCenter | null;
}

export default function HelpCenterSettings({ helpCenter }: HelpCenterSettingsProps) {
    if (!helpCenter) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Knowledge Base Selected</CardTitle>
                    <CardDescription>Select a knowledge base from the sidebar to manage its settings.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Settings for {helpCenter.name}</CardTitle>
                <CardDescription>Manage settings for this knowledge base.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="hc-name">Knowledge Base Name</Label>
                    <Input id="hc-name" defaultValue={helpCenter.name} disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="hc-name">Custom Domain</Label>
                    <Input id="hc-name" placeholder="e.g. help.yourdomain.com" />
                </div>
            </CardContent>
            <CardContent>
                <Button>Save Settings</Button>
            </CardContent>
        </Card>
    );
}
