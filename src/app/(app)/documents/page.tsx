
// src/app/(app)/documents/page.tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { getDocumentsInSpace, getAllUsers } from '@/lib/db';
import { Document, User, Space } from '@/lib/data';
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
    const { appUser, userSpaces, activeSpace, setActiveSpace, signOut } = useAuth();
    const router = useRouter();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!appUser) {
            router.push('/login');
            return;
        }

        if (userSpaces.length > 0 && !activeSpace) {
            setActiveSpace(userSpaces[0]);
        }
    }, [userSpaces, appUser, activeSpace, setActiveSpace, router]);

    useEffect(() => {
        const fetchData = async () => {
            if (activeSpace && appUser) {
                setIsLoading(true);
                try {
                    const [docs, users] = await Promise.all([
                        getDocumentsInSpace(activeSpace.id),
                        getAllUsers(),
                    ]);
                    setDocuments(docs);
                    setAllUsers(users);
                } catch (error) {
                    console.error("Failed to fetch document data:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetchData();
    }, [activeSpace, appUser]);

    if (isLoading || !activeSpace || !appUser) {
        return <LoadingState />;
    }

    return (
        <SidebarProvider defaultOpen={false}>
            <TopBar />
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
                        activeSpace={activeSpace}
                        appUser={appUser}
                        allUsers={allUsers}
                    />
                </main>
            </div>
        </SidebarProvider>
    );
}
