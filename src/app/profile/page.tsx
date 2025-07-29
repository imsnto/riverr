
'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function ProfilePage() {
    const { appUser, setAppUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [name, setName] = useState(appUser?.name || '');
    const [avatar, setAvatar] = useState(appUser?.avatarUrl || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const handleSaveChanges = () => {
        if (appUser) {
            const updatedUser = {
                ...appUser,
                name: name,
                avatarUrl: avatar,
            };
            setAppUser(updatedUser);
            // Here you would also update the user in your database
            toast({
                title: 'Profile Updated',
                description: 'Your profile has been successfully updated.',
            });
        }
    }


    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
             <Button variant="ghost" onClick={() => router.push('/')} className="absolute top-4 left-4">
                &larr; Back to Dashboard
            </Button>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Your Profile</CardTitle>
                    <CardDescription>Manage your account settings and profile information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24">
                            <AvatarImage src={avatar} alt={name} />
                            <AvatarFallback>{getInitials(name)}</AvatarFallback>
                        </Avatar>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            className="hidden" 
                        />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            Change Picture
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={appUser.email} disabled />
                        <p className="text-xs text-muted-foreground">You cannot change your email address.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveChanges} className="w-full">Save Changes</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
