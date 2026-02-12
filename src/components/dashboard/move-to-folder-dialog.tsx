'use client';
import React, { useState } from 'react';
import { HelpCenter, HelpCenterCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { ChevronRight, Folder, Inbox, Library } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderTreeItemProps {
  collection: HelpCenterCollection;
  allCollections: HelpCenterCollection[];
  level: number;
  selectedDestination: { libraryId: string | null; folderId: string | null };
  onSelectDestination: (dest: { libraryId: string | null; folderId: string | null }) => void;
  libraryId: string;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({ collection, allCollections, level, selectedDestination, onSelectDestination, libraryId }) => {
  const children = allCollections.filter(c => c.parentId === collection.id);
  const [isOpen, setIsOpen] = useState(true);

  const isSelected = selectedDestination.libraryId === libraryId && selectedDestination.folderId === collection.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-1 rounded-md cursor-pointer",
          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${(level + 1) * 1.5}rem` }}
        onClick={() => onSelectDestination({ libraryId, folderId: collection.id })}
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
              selectedDestination={selectedDestination}
              onSelectDestination={onSelectDestination}
              libraryId={libraryId}
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
  helpCenters: HelpCenter[];
  onMove: (destination: { libraryId: string | null; folderId: string | null }) => void;
}

export default function MoveToFolderDialog({ isOpen, onOpenChange, collections, helpCenters, onMove }: MoveToFolderDialogProps) {
  const [selectedDestination, setSelectedDestination] = useState<{ libraryId: string | null; folderId: string | null }>({ libraryId: null, folderId: null });

  const handleMove = () => {
    onMove(selectedDestination);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Move items</SheetTitle>
          <SheetDescription>Select a destination library or collection.</SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <ScrollArea className="h-72 border rounded-md">
            <div className="p-2 space-y-1">
                 <div
                    className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer",
                        selectedDestination.libraryId === null ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    onClick={() => setSelectedDestination({ libraryId: null, folderId: null })}
                >
                    <Inbox className="h-4 w-4 ml-1" />
                    <span>Inbox (Unassigned)</span>
                </div>
              {helpCenters.map(hc => {
                  const rootCollectionsForHc = collections.filter(c => c.helpCenterId === hc.id && !c.parentId);
                  const isLibrarySelected = selectedDestination.libraryId === hc.id && selectedDestination.folderId === null;
                  
                  return (
                    <div key={hc.id}>
                        <div
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-md cursor-pointer",
                                isLibrarySelected ? 'bg-accent' : 'hover:bg-accent/50'
                            )}
                            onClick={() => setSelectedDestination({ libraryId: hc.id, folderId: null })}
                        >
                            <Library className="h-4 w-4 ml-1"/>
                            <span className="font-semibold">{hc.name}</span>
                        </div>
                        {rootCollectionsForHc.map(collection => (
                             <FolderTreeItem
                                key={collection.id}
                                collection={collection}
                                allCollections={collections}
                                level={0}
                                selectedDestination={selectedDestination}
                                onSelectDestination={setSelectedDestination}
                                libraryId={hc.id}
                            />
                        ))}
                    </div>
                  )
              })}
            </div>
          </ScrollArea>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove}>Move</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
