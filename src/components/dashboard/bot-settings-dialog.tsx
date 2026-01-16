
'use client';

import React, { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
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
import { Bot, MessageSquare, Home, Ticket, ChevronRight, Layout, MessagesSquare, Tv2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

const botSettingsSchema = z.object({
  name: z.string().min(1, 'Bot name is required.'),
  layout: z.enum(['default', 'compact']),
  showHome: z.boolean(),
  showMessages: z.boolean(),
  showTickets: z.boolean(),
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

const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

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
      welcomeMessage: 'Hi there',
      primaryColor: '#0057ff',
      layout: 'default',
      showHome: true,
      showMessages: true,
      showTickets: false,
    },
  });
  
  const watchedValues = form.watch();

  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        welcomeMessage: bot.welcomeMessage || 'Hi there',
        primaryColor: bot.styleSettings?.primaryColor || '#0057ff',
        layout: bot.layout || 'default',
        showHome: bot.spaces?.home ?? true,
        showMessages: bot.spaces?.messages ?? true,
        showTickets: bot.spaces?.tickets ?? false,
      });
    }
  }, [bot, form]);

  if (!bot) return null;

  const onSubmit = (values: BotSettingsFormValues) => {
    const updatedBot: BotData = {
        ...bot,
        name: values.name,
        welcomeMessage: values.welcomeMessage,
        layout: values.layout,
        spaces: {
            home: values.showHome,
            messages: values.showMessages,
            tickets: values.showTickets,
        },
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
      <DialogContent className="max-w-4xl grid-cols-1 md:grid-cols-2 p-0">
        {/* Form Section */}
        <div className="p-6 flex flex-col">
            <DialogHeader>
            <DialogTitle>Bot Settings: {bot.name}</DialogTitle>
            <DialogDescription>
                Customize the appearance and behavior of your chat bot.
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="bot-settings-form" className="py-4 space-y-6 flex-1 overflow-y-auto pr-2">
                
                <div className="space-y-2">
                    <Label>Layout</Label>
                    <Controller
                        control={form.control}
                        name="layout"
                        render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                                <Card className={cn("p-4 flex flex-col items-center justify-center cursor-pointer", field.value === 'default' && 'ring-2 ring-primary')}>
                                    <RadioGroupItem value="default" id="default" className="sr-only"/>
                                    <Tv2 className="h-8 w-8 mb-2" />
                                    <Label htmlFor="default">Default</Label>
                                    <p className="text-xs text-muted-foreground">Larger view for a rich experience</p>
                                </Card>
                                <Card className={cn("p-4 flex flex-col items-center justify-center cursor-pointer", field.value === 'compact' && 'ring-2 ring-primary')}>
                                    <RadioGroupItem value="compact" id="compact" className="sr-only"/>
                                    <Layout className="h-8 w-8 mb-2" />
                                    <Label htmlFor="compact">Compact</Label>
                                    <p className="text-xs text-muted-foreground">Minimal view for a focused experience</p>
                                </Card>
                            </RadioGroup>
                        )}
                    />
                </div>

                 <div className="space-y-2">
                    <Label>Spaces</Label>
                    <Card className="p-2 space-y-1">
                        <FormField
                            control={form.control}
                            name="showHome"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
                                        <Home className="h-4 w-4" />
                                        <FormLabel className="font-normal">Home</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="showMessages"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
                                        <MessagesSquare className="h-4 w-4" />
                                        <FormLabel className="font-normal">Messages</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="showTickets"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
                                        <Ticket className="h-4 w-4" />
                                        <FormLabel className="font-normal">Tickets</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </Card>
                </div>
                
                 <Accordion type="single" collapsible defaultValue="welcome-message">
                    <AccordionItem value="welcome-message">
                        <AccordionTrigger>Set your welcome message</AccordionTrigger>
                        <AccordionContent>
                             <FormField
                                control={form.control}
                                name="welcomeMessage"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Welcome Message</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Hi there" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
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
        <div className="bg-muted/50 p-6 flex flex-col items-center justify-center rounded-r-lg relative overflow-hidden">
             <div className="w-72 h-[500px] rounded-2xl shadow-2xl bg-background flex flex-col overflow-hidden">
                {/* Header */}
                <div 
                    className="p-4 text-white flex flex-col justify-between flex-[2_2_0%]"
                    style={{ backgroundColor: watchedValues.primaryColor }}
                >
                    <div className="flex justify-between items-center">
                        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">
                            {getInitials(watchedValues.name)}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{watchedValues.welcomeMessage} 👋</h2>
                        <h3 className="text-2xl font-bold">How can we help?</h3>
                    </div>
                </div>
                {/* Body */}
                <div className="p-3 flex-1 bg-white dark:bg-background">
                    <button className="w-full flex justify-between items-center p-3 bg-white dark:bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div>
                            <p className="font-semibold text-sm">Send us a message</p>
                            <p className="text-xs text-muted-foreground">We'll reply as soon as we can</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>
                 {/* Footer */}
                <div className="p-2 border-t flex justify-around items-center">
                    {watchedValues.showHome && <Button variant="ghost" size="sm"><Home className="mr-1" /> Home</Button>}
                    {watchedValues.showMessages && <Button variant="ghost" size="sm"><MessageSquare className="mr-1" /> Messages</Button>}
                    {watchedValues.showTickets && <Button variant="ghost" size="sm"><Ticket className="mr-1" /> Tickets</Button>}
                </div>
             </div>
             <div className="absolute bottom-5 right-5 h-14 w-14 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: watchedValues.primaryColor }}>
                 <MessageSquare className="h-7 w-7 text-white" />
             </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
