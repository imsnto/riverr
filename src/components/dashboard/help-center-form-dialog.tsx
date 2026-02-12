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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Globe, Lock } from 'lucide-react';
import { Label } from '../ui/label';

const helpCenterSchema = z.object({
  name: z.string().min(2, 'Library name is required.'),
  visibility: z.enum(['public', 'internal']).default('public'),
});

export type HelpCenterFormValues = z.infer<typeof helpCenterSchema>;

interface HelpCenterFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: HelpCenterFormValues) => void;
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
      visibility: 'public',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: helpCenter?.name || '',
        visibility: helpCenter?.visibility || 'public',
      });
    }
  }, [isOpen, helpCenter, form]);

  const onSubmit = (values: HelpCenterFormValues) => {
    onSave(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {helpCenter ? 'Edit Library' : 'Create Library'}
          </DialogTitle>
          <DialogDescription>
            {helpCenter
              ? 'Update the details of your library.'
              : 'Create a new library to organize your content.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="help-center-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
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

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Visibility</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <FormItem>
                        <RadioGroupItem
                          value="public"
                          id="public"
                          className="sr-only"
                        />
                        <Label
                          htmlFor="public"
                          className="flex h-full flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-6 text-center transition-colors hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                        >
                          <Globe className="mb-3 h-6 w-6" />
                          Public
                          <p className="mt-1 text-center text-xs text-muted-foreground">
                            Accessible on a public URL and can be used by
                            public-facing AI agents.
                          </p>
                        </Label>
                      </FormItem>
                      <FormItem>
                        <RadioGroupItem
                          value="internal"
                          id="internal"
                          className="sr-only"
                        />
                        <Label
                          htmlFor="internal"
                          className="flex h-full flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-6 text-center transition-colors hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                        >
                          <Lock className="mb-3 h-6 w-6" />
                          Internal
                          <p className="mt-1 text-center text-xs text-muted-foreground">
                            Only accessible to team members and internal AI
                            agents.
                          </p>
                        </Label>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="help-center-form">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
