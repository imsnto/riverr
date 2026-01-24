
'use client';
import React, { useState, useEffect } from 'react';
import { HelpCenter, HelpCenterArticle, HelpCenterCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Folder, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentTreeItemProps {
  item: HelpCenterCollection | HelpCenterArticle;
  allCollections: HelpCenterCollection[];
  allArticles: HelpCenterArticle[];
  level: number;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  searchTerm: string;
}

const ContentTreeItem: React.FC<ContentTreeItemProps> = ({ item, allCollections, allArticles, level, selectedIds, onToggleSelect, searchTerm }) => {
  const isCollection = 'parentId' in item;
  const [isOpen, setIsOpen] = useState(true);

  const children: (HelpCenterCollection | HelpCenterArticle)[] = isCollection
    ? [
        ...allCollections.filter(c => c.parentId === item.id),
        ...allArticles.filter(a => a.folderId === item.id)
      ]
    : [];
    
  const itemName = isCollection ? item.name : (item as HelpCenterArticle).title;
  const matchesSearch = itemName.toLowerCase().includes(searchTerm.toLowerCase());

  // If searching, and this item doesn't match, check if any children match.
  const hasVisibleChildren = searchTerm ? children.some(child => 
      ((child as HelpCenterCollection).name || (child as HelpCenterArticle).title).toLowerCase().includes(searchTerm.toLowerCase())
  ) : false;
  
  if (searchTerm && !matchesSearch && !hasVisibleChildren) {
      return null;
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 p-1 rounded-md"
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        {children.length > 0 ? (
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform cursor-pointer", isOpen && "rotate-90")}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          />
        ) : <div className="w-4 shrink-0" />}

        <Checkbox
            id={`item-${item.id}`}
            checked={selectedIds.has(item.id)}
            onCheckedChange={() => onToggleSelect(item.id)}
            className="shrink-0"
        />
        
        {isCollection ? <Folder className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
        
        <label htmlFor={`item-${item.id}`} className="truncate cursor-pointer">
            {itemName}
        </label>
      </div>

      {isOpen && children.length > 0 && (
        <div className="pl-4">
          {children.map(child => (
            <ContentTreeItem
              key={child.id}
              item={child}
              allCollections={allCollections}
              allArticles={allArticles}
              level={level + 1}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ManageHelpCenterContentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  helpCenter: HelpCenter;
  allArticles: HelpCenterArticle[];
  allCollections: HelpCenterCollection[];
  onSave: (selectedIds: { articles: string[], collections: string[] }) => void;
}

export default function ManageHelpCenterContentDialog({
  isOpen,
  onOpenChange,
  helpCenter,
  allArticles,
  allCollections,
  onSave,
}: ManageHelpCenterContentDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && helpCenter) {
      const initialIds = new Set<string>();
      allArticles.forEach(a => {
        if (a.helpCenterIds?.includes(helpCenter.id)) {
          initialIds.add(a.id);
        }
      });
      allCollections.forEach(c => {
        if (c.helpCenterIds?.includes(helpCenter.id)) {
          initialIds.add(c.id);
        }
      });
      setSelectedIds(initialIds);
    }
  }, [isOpen, helpCenter, allArticles, allCollections]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };
  
  const handleSave = () => {
    const selectedArticleIds = allArticles.filter(a => selectedIds.has(a.id)).map(a => a.id);
    const selectedCollectionIds = allCollections.filter(c => selectedIds.has(c.id)).map(c => c.id);
    onSave({ articles: selectedArticleIds, collections: selectedCollectionIds });
    onOpenChange(false);
  };

  const rootCollections = allCollections.filter(c => !c.parentId);
  const rootArticles = allArticles.filter(a => !a.folderId);
  const rootItems = [...rootCollections, ...rootArticles];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage content for "{helpCenter.name}"</DialogTitle>
          <DialogDescription>
            Select articles and folders to include in this Knowledge Base.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Input 
                placeholder="Search content library..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ScrollArea className="h-80 border rounded-md p-2">
                {rootItems.map(item => (
                    <ContentTreeItem
                        key={item.id}
                        item={item}
                        allCollections={allCollections}
                        allArticles={allArticles}
                        level={0}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        searchTerm={searchTerm}
                    />
                ))}
                 {rootItems.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground p-4">Your Content Library is empty.</p>
                )}
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
