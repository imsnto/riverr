'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.02,35.636,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
)

export default function LoginPage() {
    const { signInWithGoogle, status, signUpWithEmailAndPassword, signInWithEmailAndPassword } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSignUp, setIsSignUp] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/');
        }
    }, [status, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isSignUp) {
                if (!name) {
                    toast({ variant: 'destructive', title: 'Name is required' });
                    setLoading(false);
                    return;
                }
                await signUpWithEmailAndPassword(name, email, password);
            } else {
                await signInWithEmailAndPassword(email, password);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Authentication Failed',
                description: 'Please check your credentials and try again.',
            });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-20">
                 <div className="absolute inset-0 bg-gradient-to-tr from-background via-transparent to-primary/30"></div>
                 <div className="absolute inset-0 bg-gradient-to-bl from-background via-transparent to-accent/30"></div>
            </div>
            
            <div className="z-10 flex flex-col items-center text-center mb-12">
                <Image 
                    src="/manowar.png"
                    width={100}
                    height={100}
                    alt="Manowar Logo"
                    data-ai-hint="logo"
                    className="mb-4"
                />
                <h1 className="text-4xl font-bold tracking-tighter text-foreground">Welcome to Manowar</h1>
                <p className="text-muted-foreground mt-2">The collective brain for your business.</p>
            </div>

            <Card className="w-full max-w-sm z-10 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
                    <CardDescription>Enter your details to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div className="space-y-1">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>

                    <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
                        <GoogleIcon />
                        Sign in with Google
                    </Button>
                </CardContent>
                 <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
                        <Button variant="link" className="p-0" onClick={() => setIsSignUp(!isSignUp)}>
                            {isSignUp ? "Sign In" : "Sign Up"}
                        </Button>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}