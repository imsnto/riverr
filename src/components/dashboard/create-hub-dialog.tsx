'use client';

import React, { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Hub } from '@/lib/data';
import HubComponentEditor from './hub-component-editor';

const hubSchema = z.object({
  name: z.string().min(2, 'Hub name is required.'),
  components: z.array(z.string()).min(1, "Please select at least one feature."),
});

export type HubFormValues = z.infer<typeof hubSchema>;

interface CreateHubDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: HubFormValues) => void;
}

export default function CreateHubDialog({ isOpen, onOpenChange, onSave }: CreateHubDialogProps) {
  const form = useForm<HubFormValues>({
    resolver: zodResolver(hubSchema),
    defaultValues: { name: 'New Hub', components: ['tasks'] },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ name: 'New Hub', components: ['tasks'] });
    }
  }, [isOpen, form]);

  const onSubmit = (values: HubFormValues) => {
    onSave(values);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create New Hub</SheetTitle>
          <SheetDescription>
            Hubs are workspaces within a space. Customize the features for this new hub.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="hub-form" className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hub Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Project Management" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="components"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Features</FormLabel>
                    <HubComponentEditor 
                        selected={field.value}
                        setSelected={field.onChange}
                    />
                   <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="hub-form">Create Hub</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
