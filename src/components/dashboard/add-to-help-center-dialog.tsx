
'use client';
import React, { useState, useEffect } from 'react';
import { HelpCenter, HelpCenterArticle, HelpCenterCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface AddToHelpCenterDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  helpCenters: HelpCenter[];
  selectedItems: (HelpCenterArticle | HelpCenterCollection)[];
  onSave: (helpCenterIds: string[]) => void;
}

export default function AddToHelpCenterDialog({
  isOpen,
  onOpenChange,
  helpCenters,
  selectedItems,
  onSave,
}: AddToHelpCenterDialogProps) {
  const [selectedHelpCenterIds, setSelectedHelpCenterIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      // Find common help centers
      const firstItemIds = selectedItems[0].helpCenterIds || [];
      const commonIds = firstItemIds.filter(id => 
        selectedItems.every(item => item.helpCenterIds?.includes(id))
      );
      setSelectedHelpCenterIds(commonIds);
    }
  }, [isOpen, selectedItems]);

  const handleToggleHelpCenter = (hcId: string) => {
    setSelectedHelpCenterIds(prev =>
      prev.includes(hcId)
        ? prev.filter(id => id !== hcId)
        : [...prev, hcId]
    );
  };

  const handleSave = () => {
    onSave(selectedHelpCenterIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Knowledge Base</DialogTitle>
          <DialogDescription>
            Select the Knowledge Bases where these {selectedItems.length} item(s) should appear.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-64 border rounded-md my-4">
          <div className="p-4 space-y-2">
            {helpCenters.length > 0 ? helpCenters.map(hc => (
              <div key={hc.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`hc-${hc.id}`}
                  checked={selectedHelpCenterIds.includes(hc.id)}
                  onCheckedChange={() => handleToggleHelpCenter(hc.id)}
                />
                <Label htmlFor={`hc-${hc.id}`} className="font-normal cursor-pointer">
                  {hc.name}
                </Label>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center">No Knowledge Bases found.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Update Knowledge Bases</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
