
'use client';

import React, { useState, useMemo } from 'react';
import { Document, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import DocumentEditor from './document-editor';

interface DocumentsViewProps {
  documents: Document[];
  onSave: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string) => Promise<Document | null>;
  onDelete: (docId: string) => void;
  activeSpaceId: string;
  appUser: User;
  allUsers: User[];
}

export default function DocumentsView({ documents, onSave, onDelete, activeSpaceId, appUser, allUsers }: DocumentsViewProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedDoc(null);
  };
  
  const handleSelectDoc = (doc: Document) => {
    setIsCreating(false);
    setSelectedDoc(doc);
  };
  
  const handleBackToList = () => {
    setSelectedDoc(null);
    setIsCreating(false);
  }
  
  const handleSaveAndSelect = async (docData: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>, docId?: string) => {
    const savedDoc = await onSave(docData, docId);
    if (savedDoc) {
      handleSelectDoc(savedDoc);
    }
  }

  if (selectedDoc || isCreating) {
    return (
      <DocumentEditor
        document={selectedDoc}
        onBack={handleBackToList}
        onSave={handleSaveAndSelect}
        onDelete={onDelete}
        spaceId={activeSpaceId}
        appUser={appUser}
        allUsers={allUsers}
        onCreate={handleSaveAndSelect}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
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
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectDoc(doc)}>
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
