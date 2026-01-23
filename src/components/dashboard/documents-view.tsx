
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Document, User, Space, Hub } from '@/lib/data';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Search, Users, Globe, MoreHorizontal, Share2, Trash2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { addDocument, getDocumentsInHub, deleteDocument, updateDocument } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { TooltipContent } from '@radix-ui/react-tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { Carousel, CarouselContent, CarouselItem } from '../ui/carousel';
import { ScrollArea } from '../ui/scroll-area';
import NewDocumentDialog from './new-document-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import DocumentsSidebar from './documents-sidebar';
import { formatDistanceToNow } from 'date-fns';

interface DocumentsViewProps {
  activeSpace: Space;
  appUser: User;
  allUsers: User[];
  activeHub: Hub;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function DocumentsView({ activeSpace, appUser, allUsers, activeHub }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sharingDoc, setSharingDoc] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  
  useEffect(() => {
    if (activeHub) {
      getDocumentsInHub(activeHub.id).then(fetchedDocs => {
        setDocuments(fetchedDocs);
      });
    }
  }, [activeHub]);


  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (doc.isPublic || (doc.allowedUserIds && doc.allowedUserIds.includes(appUser.id)))
    );
  }, [documents, searchTerm, appUser.id]);
  
  const recentDocuments = useMemo(() => {
    return [...documents]
      .filter(doc => doc.isPublic || (doc.allowedUserIds && doc.allowedUserIds.includes(appUser.id)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);
  }, [documents, appUser.id]);
  
  const handleCreateNew = async () => {
    const now = new Date().toISOString();
    const newDocData: Omit<Document, 'id'> = {
        name: '',
        content: '<h1></h1>',
        spaceId: activeSpace.id,
        hubId: activeHub.id,
        createdBy: appUser.id,
        createdAt: now,
        updatedAt: now,
        type: 'notes' as const,
        isLocked: false,
        tags: [],
        comments: [],
        isPublic: false, // Private by default
        allowedUserIds: [appUser.id] // Private to creator by default
    };
    try {
        const newDoc = await addDocument(newDocData);
        toast({ title: 'Document Created' });
        router.push(`/documents/${newDoc.id}`);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to create document' });
    }
  };
  
  const handleDelete = async (docId: string) => {
    try {
        await deleteDocument(docId);
        setDocuments(prev => prev.filter(d => d.id !== docId));
        toast({ title: "Document deleted" });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to delete document' });
    }
  }

  const handleSharingSave = async (sharingData: Partial<Document>) => {
      if (!sharingDoc) return;
      const updatedDoc = { ...sharingDoc, ...sharingData };
      try {
          await updateDocument(sharingDoc.id, updatedDoc);
          setDocuments(prev => prev.map(d => d.id === sharingDoc.id ? updatedDoc : d));
          setSharingDoc(null);
          toast({ title: 'Sharing settings updated' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Failed to update sharing settings' });
      }
  };


  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
        <>
            <div className="flex flex-col h-full">
                <div className="p-4 shrink-0">
                    <h1 className="text-3xl font-bold">Documents</h1>
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search documents..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="px-4 pb-4">
                        <h2 className="text-lg font-semibold my-4">Recents</h2>
                        <Carousel opts={{ align: "start", dragFree: true }} className="w-full -ml-4">
                            <CarouselContent>
                                {recentDocuments.map((doc) => (
                                    <CarouselItem key={doc.id} className="basis-2/5 sm:basis-1/3 pl-4">
                                        <Card className="h-32 bg-secondary" onClick={() => router.push(`/documents/${doc.id}`)}>
                                            <CardContent className="p-3 flex flex-col justify-between h-full">
                                                <FileText className="h-5 w-5 text-muted-foreground" />
                                                <span className="text-sm font-medium line-clamp-3">{doc.name}</span>
                                            </CardContent>
                                        </Card>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </Carousel>

                        <div className="mt-8">
                             <div className="flex items-center justify-between mb-2">
                                 <h2 className="text-lg font-semibold">All Documents</h2>
                             </div>
                            {filteredDocuments.map(doc => (
                                <div key={doc.id} className="flex items-center group -ml-2">
                                    <Button variant="ghost" className="flex-1 justify-start h-12" onClick={() => router.push(`/documents/${doc.id}`)}>
                                        <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
                                        <span className="truncate">{doc.name}</span>
                                    </Button>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSharingDoc(doc)}>
                                            <Share2 className="h-4 w-4" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => setDocToDelete(doc)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                             {filteredDocuments.length === 0 && (
                                <p className="text-sm text-center text-muted-foreground py-4">No documents found.</p>
                            )}
                        </div>
                    </div>
                </ScrollArea>
                <Button className="absolute bottom-24 right-6 h-14 w-14 rounded-full shadow-lg" onClick={handleCreateNew}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </Button>
            </div>
        </>
    );
  }

  // DESKTOP VIEW
  return (
    <>
      <div className="grid h-full grid-cols-[280px_1fr]">
        <DocumentsSidebar
          documents={documents.filter(doc => doc.isPublic || (doc.allowedUserIds && doc.allowedUserIds.includes(appUser.id)))}
          onSelectDocument={(id) => router.push(`/documents/${id}`)}
        />
        <main className="overflow-y-auto p-8">
          <h1 className="text-3xl font-bold mb-8">Good afternoon, {appUser.name.split(' ')[0]}</h1>

          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
             <Clock className="h-5 w-5" />
            Recently visited
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recentDocuments.slice(0, 3).map(doc => (
                 <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/documents/${doc.id}`)}>
                    <CardHeader className="p-4">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                           <FileText className="h-4 w-4 text-muted-foreground"/>
                           <span className="truncate">{doc.name}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                         <p className="text-xs text-muted-foreground">
                            Edited {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                        </p>
                    </CardContent>
                </Card>
            ))}
             <Card
              className="hover:shadow-md transition-shadow cursor-pointer flex items-center justify-center bg-card border-dashed hover:border-primary"
              onClick={handleCreateNew}
            >
              <div className="p-4 text-center text-muted-foreground">
                <Plus className="mx-auto h-6 w-6 mb-2" />
                <p className="text-sm font-medium">New page</p>
              </div>
            </Card>
          </div>
        </main>
      </div>
      <NewDocumentDialog
        isOpen={!!sharingDoc}
        onOpenChange={() => setSharingDoc(null)}
        spaceId={sharingDoc?.spaceId || ''}
        spaceMembers={allUsers.filter(u => activeSpace.members[u.id])}
        onCreate={() => {}}
        isEditing={true}
        initialData={{
            name: sharingDoc?.name || '',
            access: sharingDoc?.isPublic ? 'public' : 'private',
            allowedUserIds: sharingDoc?.allowedUserIds || []
        }}
        onEditSave={handleSharingSave}
    />
    <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the document "{docToDelete?.name}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={async () => {
                        if (docToDelete) {
                            await handleDelete(docToDelete.id);
                        }
                    }}
                    className={cn(buttonVariants({ variant: "destructive" }))}
                >
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
