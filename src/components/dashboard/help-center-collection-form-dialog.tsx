'use client';
import React, { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { HelpCenterCollection } from '@/lib/data';

const collectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required.'),
  description: z.string().optional(),
});

type CollectionFormValues = z.infer<typeof collectionSchema>;

interface HelpCenterCollectionFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: CollectionFormValues, collectionId?: string) => void;
  collection: HelpCenterCollection | null;
  parentId?: string;
}

export default function HelpCenterCollectionFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  collection,
  parentId,
}: HelpCenterCollectionFormDialogProps) {
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: collection?.name || '',
        description: collection?.description || '',
      });
    }
  }, [isOpen, collection, form]);

  const onSubmit = (values: CollectionFormValues) => {
    onSave(values, collection?.id);
  };
  
  const title = collection ? 'Edit Collection' : (parentId ? 'New Sub-collection' : 'New Collection');
  const description = collection ? 'Update the collection details.' : 'Create a new collection to organize your articles.';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Getting Started" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this collection about?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
