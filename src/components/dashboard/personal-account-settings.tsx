
'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { updateUser } from '@/lib/db';
import { getInitials } from '@/lib/utils';
import { Key, Copy, User as UserIcon, Loader2, Upload } from 'lucide-react';

export default function PersonalAccountSettings() {
    const { appUser, setAppUser, firebaseUser } = useAuth();
    const { toast } = useToast();
    
    const [name, setName] = useState(appUser?.name || '');
    const [avatar, setAvatar] = useState(appUser?.avatarUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!appUser) return null;

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
            setIsSaving(true);
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
            } finally {
                setIsSaving(false);
            }
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-muted-foreground text-sm">Manage your personal identity and account settings.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                    <CardDescription>Manage your public identity and core account settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                            <AvatarImage src={avatar} alt={name} />
                            <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputRef} 
                                onChange={handleAvatarChange} 
                                className="hidden" 
                            />
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9">
                                <Upload className="mr-2 h-4 w-4" />
                                Change Avatar
                            </Button>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">JPG, PNG or GIF. Max 1MB.</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Display Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={appUser.email} disabled className="h-11 bg-muted/20" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black px-1">Managed by your identity provider</p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t p-6">
                    <Button onClick={handleSaveChanges} disabled={isSaving} className="ml-auto px-8">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </CardFooter>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Developer Tools
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Use your authentication token for API testing or local integration development.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" size="sm" className="w-full gap-2 h-10 border-primary/20 hover:bg-primary/10 bg-background" onClick={async () => {
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
        </div>
    );
}
