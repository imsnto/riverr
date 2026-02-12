'use client';
import React, { useState, useEffect } from 'react';
import { HelpCenterArticle, HelpCenter } from '@/lib/data';
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

interface AddArticlesToLibraryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  library: HelpCenter;
  unassignedArticles: HelpCenterArticle[];
  onSave: (articleIds: string[]) => void;
}

export default function AddArticlesToLibraryDialog({
  isOpen,
  onOpenChange,
  library,
  unassignedArticles,
  onSave,
}: AddArticlesToLibraryDialogProps) {
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedArticleIds([]);
      setSearchTerm('');
    }
  }, [isOpen]);

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

  const filteredArticles = unassignedArticles.filter(article => 
    article.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add articles to "{library.name}"</DialogTitle>
          <DialogDescription>
            Select unassigned articles to add to this library.
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
                    id={`add-article-${article.id}`}
                    checked={selectedArticleIds.includes(article.id)}
                    onCheckedChange={() => handleToggleArticle(article.id)}
                  />
                  <Label htmlFor={`add-article-${article.id}`} className="font-normal cursor-pointer">
                    {article.title}
                  </Label>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center">No unassigned articles found.</p>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={selectedArticleIds.length === 0}>Add Selected Articles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
