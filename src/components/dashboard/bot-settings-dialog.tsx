
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
import { Bot as BotData } from '@/lib/data';
import { Bot, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const botSettingsSchema = z.object({
  name: z.string().min(1, 'Bot name is required.'),
  welcomeMessage: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
});

type BotSettingsFormValues = z.infer<typeof botSettingsSchema>;

interface BotSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (botData: BotData) => void;
}

const COLOR_SWATCHES = [
  '#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#ec4899'
];

export default function BotSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
}: BotSettingsDialogProps) {
  const { toast } = useToast();
  const form = useForm<BotSettingsFormValues>({
    resolver: zodResolver(botSettingsSchema),
    defaultValues: {
      name: '',
      welcomeMessage: '',
      primaryColor: '#3b82f6',
    },
  });
  
  const primaryColor = form.watch('primaryColor');
  const welcomeMessage = form.watch('welcomeMessage');

  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        welcomeMessage: bot.welcomeMessage || '',
        primaryColor: bot.styleSettings?.primaryColor || '#3b82f6',
      });
    }
  }, [bot, form]);

  if (!bot) return null;

  const onSubmit = (values: BotSettingsFormValues) => {
    const updatedBot: BotData = {
        ...bot,
        name: values.name,
        welcomeMessage: values.welcomeMessage,
        styleSettings: {
            ...bot.styleSettings,
            primaryColor: values.primaryColor,
        }
    };
    onSave(updatedBot);
    toast({ title: 'Bot settings saved!' });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl grid-cols-1 md:grid-cols-2 p-0">
        {/* Form Section */}
        <div className="p-6 flex flex-col">
            <DialogHeader>
            <DialogTitle>Bot Settings: {bot.name}</DialogTitle>
            <DialogDescription>
                Customize the appearance and behavior of your chat bot.
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="bot-settings-form" className="py-4 space-y-4 flex-1">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Bot Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Support Bot" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Hi there! How can I help?" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                        <div className="flex items-center gap-2">
                             <Input {...field} className="w-28"/>
                             <div className="flex gap-1">
                                {COLOR_SWATCHES.map(color => (
                                    <button 
                                        key={color}
                                        type="button"
                                        onClick={() => form.setValue('primaryColor', color)}
                                        className={cn("h-6 w-6 rounded-full border-2", field.value === color ? 'border-ring' : 'border-transparent')}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                             </div>
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </form>
            </Form>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button type="submit" form="bot-settings-form">
                    Save Changes
                </Button>
            </DialogFooter>
        </div>

        {/* Preview Section */}
        <div className="bg-muted/50 p-6 flex flex-col items-center justify-center rounded-r-lg">
             <div className="w-64 h-96 rounded-lg shadow-2xl bg-background flex flex-col overflow-hidden">
                {/* Header */}
                <div 
                    className="p-4 text-white flex items-center gap-3"
                    style={{ backgroundColor: primaryColor }}
                >
                    <Bot className="h-6 w-6" />
                    <h3 className="font-bold">{form.getValues('name')}</h3>
                </div>
                {/* Body */}
                <div className="p-4 flex-1 space-y-3">
                    <div className="flex items-end gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}33`}}>
                            <Bot className="h-5 w-5" style={{ color: primaryColor }}/>
                        </div>
                        <div className="p-3 rounded-lg bg-muted max-w-[80%]">
                            <p className="text-sm">{welcomeMessage || "Hi! How can I help?"}</p>
                        </div>
                    </div>
                     <div className="flex justify-end">
                        <div className="p-3 rounded-lg text-white max-w-[80%]" style={{ backgroundColor: primaryColor }}>
                            <p className="text-sm">I have a question about my bill.</p>
                        </div>
                    </div>
                </div>
                 {/* Footer */}
                <div className="p-2 border-t">
                    <div className="relative">
                        <Input placeholder="Type a message..." readOnly/>
                        <div 
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-white"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <MessageSquare className="h-4 w-4" />
                        </div>
                    </div>
                </div>
             </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
