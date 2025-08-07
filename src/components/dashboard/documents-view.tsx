
'use client';

import React, { useState, useMemo } from 'react';
import { Document, User, Space } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Search, Users, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { addDocument } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import NewDocumentDialog from './new-document-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { TooltipContent } from '@radix-ui/react-tooltip';

interface DocumentsViewProps {
  documents: Document[];
  activeSpace: Space;
  appUser: User;
  allUsers: User[];
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

export default function DocumentsView({ documents, activeSpace, appUser, allUsers }: DocumentsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewDocDialogOpen, setIsNewDocDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (doc.isPublic || (doc.allowedUserIds && doc.allowedUserIds.includes(appUser.id)))
    );
  }, [documents, searchTerm, appUser.id]);
  
  const handleCreateNew = async (docData: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'content' | 'comments' | 'tags' | 'type' | 'isLocked'>) => {
    const now = new Date().toISOString();
    const newDocData: Omit<Document, 'id'> = {
        ...docData,
        content: '',
        createdBy: appUser.id,
        createdAt: now,
        updatedAt: now,
        type: 'notes' as const,
        isLocked: false,
        tags: [],
        comments: []
    };
    try {
        const newDoc = await addDocument(newDocData);
        toast({ title: 'Document Created' });
        router.push(`/documents/${newDoc.id}`);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to create document' });
    }
  };

  const spaceMembers = allUsers.filter(u => activeSpace.members[u.id]);

  return (
    <>
      <div className="flex flex-col p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground">
              All documents for the current space.
            </p>
          </div>
          <Button onClick={() => setIsNewDocDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Document
          </Button>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
              placeholder="Search documents..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
           <TooltipProvider>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map(doc => {
                    const sharedWithUsers = doc.isPublic ? [] : allUsers.filter(u => doc.allowedUserIds?.includes(u.id));
                    return (
                        <Card key={doc.id} className="hover:shadow-md transition-shadow flex flex-col">
                            <div className="cursor-pointer flex-grow" onClick={() => router.push(`/documents/${doc.id}`)}>
                                <CardHeader>
                                    <CardTitle className="flex items-start gap-2 text-base">
                                        <FileText className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
                                        <span className="flex-1">{doc.name}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">
                                        Updated {new Date(doc.updatedAt).toLocaleDateString()}
                                    </p>
                                </CardContent>
                            </div>
                            <CardFooter className="p-3 pt-0 mt-auto">
                                <div className="flex items-center gap-2">
                                    {doc.isPublic ? (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Globe className="h-3 w-3" />
                                            <span>Public</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center -space-x-2">
                                            {sharedWithUsers.slice(0, 3).map(user => (
                                                <Tooltip key={user.id}>
                                                    <TooltipTrigger asChild>
                                                        <Avatar className="h-6 w-6 border-2 border-background">
                                                            <AvatarImage src={user.avatarUrl} />
                                                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                                        </Avatar>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{user.name}</p></TooltipContent>
                                                </Tooltip>
                                            ))}
                                            {sharedWithUsers.length > 3 && (
                                                 <Tooltip>
                                                     <TooltipTrigger asChild>
                                                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                                                            +{sharedWithUsers.length - 3}
                                                        </div>
                                                     </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>
                                                            {sharedWithUsers.slice(3).map(u => u.name).join(', ')}
                                                        </p>
                                                      </TooltipContent>
                                                 </Tooltip>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                    )
                })}
              </div>
          </TooltipProvider>
          {filteredDocuments.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm ? `No documents match "${searchTerm}".` : "Get started by creating a new document."}
              </p>
              {!searchTerm && (
                  <Button className="mt-4" onClick={() => setIsNewDocDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Document
                  </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <NewDocumentDialog
        isOpen={isNewDocDialogOpen}
        onOpenChange={setIsNewDocDialogOpen}
        spaceId={activeSpace.id}
        spaceMembers={spaceMembers}
        onCreate={handleCreateNew}
      />
    </>
  );
}
