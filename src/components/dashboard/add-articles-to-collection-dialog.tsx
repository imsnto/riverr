'use client';
import React, { useState, useEffect } from 'react';
import { HelpCenterArticle, HelpCenterCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface AddArticlesToCollectionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  collection: HelpCenterCollection;
  allArticles: HelpCenterArticle[];
  onSave: (articleIds: string[]) => void;
}

export default function AddArticlesToCollectionDialog({
  isOpen,
  onOpenChange,
  collection,
  allArticles,
  onSave,
}: AddArticlesToCollectionDialogProps) {
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Pre-select articles already in the collection
      const articlesInCollection = allArticles
        .filter(article => article.collectionIds.includes(collection.id))
        .map(article => article.id);
      setSelectedArticleIds(articlesInCollection);
    }
  }, [isOpen, allArticles, collection]);

  const handleToggleArticle = (articleId: string) => {
    setSelectedArticleIds(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  const handleSave = () => {
    onSave(selectedArticleIds);
    onOpenChange(false);
  };

  const filteredArticles = allArticles.filter(article => 
    article.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add articles to "{collection.name}"</DialogTitle>
          <DialogDescription>
            Select articles to include in this collection.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Input 
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-4 space-y-2">
              {filteredArticles.length > 0 ? filteredArticles.map(article => (
                <div key={article.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`article-${article.id}`}
                    checked={selectedArticleIds.includes(article.id)}
                    onCheckedChange={() => handleToggleArticle(article.id)}
                  />
                  <Label htmlFor={`article-${article.id}`} className="font-normal cursor-pointer">
                    {article.title}
                  </Label>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center">No articles found.</p>
              )}
            </div>
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
