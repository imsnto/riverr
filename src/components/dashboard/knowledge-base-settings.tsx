'use client';
import React, { useState, useEffect, useTransition, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCenter, Hub } from '@/lib/data';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { generateCoverImage } from '@/ai/flows/generate-cover-image';
import { Loader2, Upload, Wand2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface KnowledgeBaseSettingsProps {
    activeHub: Hub | null;
}

export default function KnowledgeBaseSettings({ activeHub }: KnowledgeBaseSettingsProps) {
    const { toast } = useToast();
    const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
    const [selectedHelpCenter, setSelectedHelpCenter] = useState<HelpCenter | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeHub) {
            setIsLoading(true);
            db.getHelpCenters(activeHub.id).then(data => {
                setHelpCenters(data);
                if (data.length > 0) {
                    setSelectedHelpCenter(data[0]);
                }
                setIsLoading(false);
            });
        }
    }, [activeHub]);
    
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedHelpCenter) return;
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const updatedHelpCenter = { ...selectedHelpCenter, coverImageUrl: dataUrl };
            await db.updateHelpCenter(selectedHelpCenter.id, { coverImageUrl: dataUrl });
            setSelectedHelpCenter(updatedHelpCenter);
            setHelpCenters(prev => prev.map(hc => hc.id === selectedHelpCenter.id ? updatedHelpCenter : hc));
            toast({ title: 'Cover image updated!' });
        };
        reader.readAsDataURL(file);
    };
    
    const handleGenerateImage = () => {
        if (!prompt.trim() || !selectedHelpCenter) return;
        startTransition(async () => {
            try {
                const result = await generateCoverImage(prompt);
                const updatedHelpCenter = { ...selectedHelpCenter, coverImageUrl: result.imageUrl };
                await db.updateHelpCenter(selectedHelpCenter.id, { coverImageUrl: result.imageUrl });
                setSelectedHelpCenter(updatedHelpCenter);
                setHelpCenters(prev => prev.map(hc => hc.id === selectedHelpCenter.id ? updatedHelpCenter : hc));
                toast({ title: 'New cover image generated!' });
            } catch (e) {
                toast({ variant: 'destructive', title: 'Image generation failed.' });
            }
        });
    };

    if (isLoading) {
        return <p>Loading...</p>;
    }

    if (!activeHub || helpCenters.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Libraries Found</CardTitle>
                    <CardDescription>Create a library in the 'Knowledge' section first.</CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Library Settings</CardTitle>
                    <CardDescription>Manage general settings for your libraries.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Label htmlFor="hc-select">Select Library</Label>
                    <Select value={selectedHelpCenter?.id || ''} onValueChange={(id) => setSelectedHelpCenter(helpCenters.find(hc => hc.id === id) || null)}>
                        <SelectTrigger id="hc-select"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            {helpCenters.map(hc => <SelectItem key={hc.id} value={hc.id}>{hc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            {selectedHelpCenter && selectedHelpCenter.visibility !== 'internal' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Cover Image</CardTitle>
                        <CardDescription>Set the background image for the header of your public help center.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative aspect-video w-full rounded-lg border overflow-hidden">
                            <Image
                                src={selectedHelpCenter.coverImageUrl || "https://picsum.photos/seed/hchero/1600/900"}
                                alt="Cover image preview"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4" /> Upload Image
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ai-prompt">Or generate with AI</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="ai-prompt"
                                    placeholder="e.g., abstract blue waves, minimalist landscape"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                                <Button onClick={handleGenerateImage} disabled={isGenerating || !prompt.trim()}>
                                    {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                    <span className="sr-only">Generate</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
