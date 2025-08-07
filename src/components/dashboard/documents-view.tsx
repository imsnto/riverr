

'use client';

import React, { useState, useMemo } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { addDocument } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface DocumentsViewProps {
  documents: Document[];
  activeSpaceId: string;
  appUser: User;
}

export default function DocumentsView({ documents, activeSpaceId, appUser }: DocumentsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const handleCreateNew = async () => {
    const now = new Date().toISOString();
    const newDocData = {
        name: 'Untitled Document',
        content: '',
        spaceId: activeSpaceId,
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

  return (
    <div className="flex flex-col p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            All documents for the current space.
          </p>
        </div>
        <Button onClick={handleCreateNew}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocuments.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/documents/${doc.id}`)}>
              <CardHeader>
                <CardTitle className="flex items-start gap-2 text-base">
                    <FileText className="h-5 w-5 mt-1 text-muted-foreground" />
                    <span className="flex-1">{doc.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredDocuments.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">No documents found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? `No documents match "${searchTerm}".` : "Get started by creating a new document."}
            </p>
            {!searchTerm && (
                <Button className="mt-4" onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Document
                </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
