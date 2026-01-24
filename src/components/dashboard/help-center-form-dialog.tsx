
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
import { HelpCenter } from '@/lib/data';

const helpCenterSchema = z.object({
  name: z.string().min(2, 'Knowledge Base name is required.'),
});

type HelpCenterFormValues = z.infer<typeof helpCenterSchema>;

interface HelpCenterFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (name: string) => void;
  helpCenter: HelpCenter | null;
}

export default function HelpCenterFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  helpCenter,
}: HelpCenterFormDialogProps) {
  const form = useForm<HelpCenterFormValues>({
    resolver: zodResolver(helpCenterSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: helpCenter?.name || '',
      });
    }
  }, [isOpen, helpCenter, form]);

  const onSubmit = (values: HelpCenterFormValues) => {
    onSave(values.name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {helpCenter ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
          </DialogTitle>
          <DialogDescription>
            {helpCenter
              ? 'Update the name of your knowledge base.'
              : 'Give your new knowledge base a name.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Product Guides" {...field} />
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
