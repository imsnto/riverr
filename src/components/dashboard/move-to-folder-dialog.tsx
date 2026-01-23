'use client';
import React, { useState } from 'react';
import { HelpCenterCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderTreeItemProps {
  collection: HelpCenterCollection;
  allCollections: HelpCenterCollection[];
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({ collection, allCollections, level, selectedFolderId, onSelectFolder }) => {
  const children = allCollections.filter(c => c.parentId === collection.id);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-1 rounded-md cursor-pointer",
          selectedFolderId === collection.id ? 'bg-accent' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${level * 1.5}rem` }}
        onClick={() => onSelectFolder(collection.id)}
      >
        {children.length > 0 ? (
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          />
        ) : <div className="w-4" />}
        <Folder className="h-4 w-4" />
        <span className="truncate">{collection.name}</span>
      </div>
      {isOpen && children.length > 0 && (
        <div>
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              collection={child}
              allCollections={allCollections}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};


interface MoveToFolderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  collections: HelpCenterCollection[];
  onMove: (folderId: string | null) => void;
}

export default function MoveToFolderDialog({ isOpen, onOpenChange, collections, onMove }: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const rootCollections = collections.filter(c => c.parentId === null);

  const handleMove = () => {
    onMove(selectedFolderId);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move items</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-72 border rounded-md">
            <div className="p-2">
                 <div
                    className={cn(
                        "flex items-center gap-2 p-1 rounded-md cursor-pointer",
                        selectedFolderId === null ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    onClick={() => setSelectedFolderId(null)}
                >
                    <Folder className="h-4 w-4 ml-4" />
                    <span>Content Library (root)</span>
                </div>
              {rootCollections.map(collection => (
                <FolderTreeItem
                  key={collection.id}
                  collection={collection}
                  allCollections={collections}
                  level={0}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
