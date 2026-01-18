'use client';

import React from 'react';
import { Document } from '@/lib/data';
import { Button } from '../ui/button';
import { Plus, FileText, Search } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';

interface DocumentsSidebarProps {
  documents: Document[];
  onSelectDocument: (id: string) => void;
  onNewDocument: () => void;
}

export default function DocumentsSidebar({ documents, onSelectDocument, onNewDocument }: DocumentsSidebarProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="hidden md:flex flex-col h-full p-2 border-r bg-card">
      <div className="relative p-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          className="pl-8 h-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex justify-between items-center p-2 mt-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Private</h2>
        <Button variant="ghost" size="icon" onClick={onNewDocument} className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className={cn(
                  "group flex items-center justify-between p-2 rounded-md cursor-pointer",
                  'hover:bg-accent/50'
              )}
              onClick={() => onSelectDocument(doc.id)}
            >
                <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-sm">{doc.name}</span>
                </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
