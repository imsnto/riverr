
// src/app/(app)/documents/page.tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { getDocumentsInSpace, getAllUsers } from '@/lib/db';
import { Document, User } from '@/lib/data';
import React, { useState, useEffect } from 'react';
import DocumentsView from '@/components/dashboard/documents-view';
import { TopBar } from '@/components/dashboard/top-bar';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { BarChart, FolderKanban, ClipboardCheck, MessageSquare, BookOpen, Timer, Workflow, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LoadingState = () => (
    <div className="flex h-screen items-center justify-center">
        <p>Loading documents...</p>
    </div>
);

export default function DocumentsPage() {
    const { appUser, userSpaces, signOut } = useAuth();
    const router = useRouter();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const activeSpace = userSpaces.length > 0 ? userSpaces[0] : null;

    useEffect(() => {
        if (activeSpace && appUser) {
            setIsLoading(true);
            Promise.all([
                getDocumentsInSpace(activeSpace.id),
                getAllUsers(),
            ]).then(([docs, users]) => {
                setDocuments(docs);
                setAllUsers(users);
                setIsLoading(false);
            }).catch(error => {
                console.error("Failed to fetch document data:", error);
                setIsLoading(false);
            });
        } else if (!appUser) {
            router.push('/login');
        } else {
             setIsLoading(false);
        }
    }, [activeSpace, appUser, router]);

    if (isLoading || !activeSpace || !appUser) {
        return <LoadingState />;
    }

    return (
        <SidebarProvider defaultOpen={false}>
            <TopBar activeSpace={activeSpace} onSpaceChange={() => {}} allSpaces={userSpaces} />
            <div className="flex flex-1 h-screen pt-16">
                 <Sidebar collapsible="icon">
                     <div className="flex flex-col h-full">
                        <div className="space-y-2 pt-4">
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BarChart className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=tasks')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <FolderKanban className="w-7 h-7"/>
                            </Button>
                             <Button onClick={() => router.push('/mytasks')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <ClipboardCheck className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=messages')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <MessageSquare className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/documents')} variant={'secondary'} className="h-12 w-full justify-center rounded-none">
                                <BookOpen className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=timesheets')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Timer className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=flows')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Workflow className="w-7 h-7"/>
                            </Button>
                        </div>
                        <div className="mt-auto space-y-2">
                            <Button onClick={() => router.push('/?view=settings')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Settings className="w-7 h-7"/>
                            </Button>
                        </div>
                    </div>
                </Sidebar>
                <main className="flex-1 overflow-auto">
                    <DocumentsView
                        documents={documents.filter(d => d.spaceId === activeSpace.id)}
                        activeSpaceId={activeSpace.id}
                        appUser={appUser}
                    />
                </main>
            </div>
        </SidebarProvider>
    );
}
