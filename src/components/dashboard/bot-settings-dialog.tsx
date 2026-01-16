'use client';

import React, { useEffect, useState, useRef } from 'react';
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
import { Bot as BotData, ChatContact, ChatMessage, User } from '@/lib/data';
import { Bot, MessageSquare, ChevronLeft, MoreHorizontal, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';


const botSettingsSchema = z.object({
  name: z.string().min(1, 'Bot name is required.'),
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
  onSendMessage: (content: string) => void;
  messages: ChatMessage[];
  contact: ChatContact | null;
  appUser: User | null;
  allUsers: User[];
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
  onSendMessage,
  messages,
  contact,
}: BotSettingsDialogProps) {
  const [chatStarted, setChatStarted] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const form = useForm<BotSettingsFormValues>({
    resolver: zodResolver(botSettingsSchema),
    defaultValues: {
      name: '',
      welcomeMessage: 'Hi there',
      primaryColor: '#0057ff',
      showTickets: false,
    },
  });
  
  const watchedValues = form.watch();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);


  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        welcomeMessage: bot.welcomeMessage || 'Hi there',
        primaryColor: bot.styleSettings?.primaryColor || '#0057ff',
        showTickets: bot.spaces?.tickets ?? false,
      });
    }
  }, [bot, form]);
  
  useEffect(() => {
      if (!isOpen) {
          setChatStarted(false);
          setPreviewMessage('');
      }
  }, [isOpen]);

  if (!bot) return null;

  const onSubmit = (values: BotSettingsFormValues) => {
    const updatedBot: BotData = {
        ...bot,
        name: values.name,
        welcomeMessage: values.welcomeMessage,
        layout: 'default',
        spaces: {
            ...bot.spaces,
            home: false,
            messages: true,
            tickets: values.showTickets,
        },
        styleSettings: {
            ...bot.styleSettings,
            primaryColor: values.primaryColor,
        }
    };
    onSave(updatedBot);
    onOpenChange(false);
  };
  
  const handlePreviewSend = () => {
    if (!previewMessage.trim()) return;
    onSendMessage(previewMessage);
    setPreviewMessage('');
  }

  const handlePromptClick = (text: string) => {
    onSendMessage(text);
    setChatStarted(true);
  };

  const renderMessageBubble = (msg: ChatMessage) => {
    if (msg.type !== 'message' || !contact) {
        return null;
    }
    
    // In preview, all messages are from the contact (the "customer")
    return (
      <div key={msg.id} className="flex items-end gap-2 justify-end">
        <div className={cn("rounded-xl p-3 max-w-xs", "bg-blue-600 text-white rounded-br-sm")}>
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
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
                
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Bot Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Support Bot" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                 <div className="space-y-2">
                    <FormLabel>Spaces</FormLabel>
                    <Card className="p-2 space-y-1">
                         <FormField
                            control={form.control}
                            name="showTickets"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
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
                
                 <Accordion type="single" collapsible defaultValue="welcome-message" className="w-full">
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
                    <AccordionItem value="branding">
                        <AccordionTrigger>Branding</AccordionTrigger>
                        <AccordionContent>
                            <FormField
                                control={form.control}
                                name="primaryColor"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Primary Color</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input placeholder="#0057ff" {...field} />
                                            <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: field.value }}></div>
                                        </div>
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
             <div className="w-80 h-[600px] bg-zinc-900 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b border-zinc-700 flex items-center gap-3 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-white">
                        <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" transform="rotate(90 12 12)"/>
                    </svg>
                    <div>
                        <h3 className="font-bold text-white">{watchedValues.name}</h3>
                        <p className="text-xs text-zinc-400">The team can also help</p>
                    </div>
                    <div className="ml-auto flex items-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700">
                            <MoreHorizontal className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => onOpenChange(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                
                {/* Body */}
                <ScrollArea className="flex-1" ref={scrollAreaRef}>
                    <div className="p-4">
                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                            <p className="text-sm whitespace-pre-wrap">{watchedValues.welcomeMessage} 👋</p>
                            <p className="text-sm whitespace-pre-wrap mt-2">What would you like help with?</p>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">Intercom live chat・Just now</p>
                    </div>

                    {(messages.length === 0 && !chatStarted) ? (
                        <div className="px-4 space-y-2">
                            <Button onClick={() => handlePromptClick('Choosing a pricing plan')} variant="outline" className="w-full justify-center bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white rounded-full">
                                Choosing a pricing plan
                            </Button>
                            <Button onClick={() => handlePromptClick('Learn more about Intercom')} variant="outline" className="w-full justify-center bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white rounded-full">
                                Learn more about Intercom
                            </Button>
                            <Button onClick={() => handlePromptClick('Start a free 14-day trial')} variant="outline" className="w-full justify-center bg-white border-white hover:bg-zinc-200 text-zinc-900 font-semibold rounded-full">
                                Start a free 14-day trial
                            </Button>
                        </div>
                    ) : (
                        <div className="px-4 space-y-4">
                            {messages.map(renderMessageBubble)}
                        </div>
                    )}
                </ScrollArea>
                
                {/* Footer */}
                <div className="p-4 border-t border-zinc-700 shrink-0">
                    {(chatStarted || messages.length > 0) && (
                        <div className="mb-3">
                        <Textarea 
                            placeholder="Message..."
                            value={previewMessage}
                            onChange={(e) => setPreviewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePreviewSend(); }}}
                            minRows={1}
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                        <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={handlePreviewSend} disabled={!previewMessage.trim()}>Send</Button>
                        </div>
                        </div>
                    )}
                    <div className="text-center text-xs text-zinc-500">
                        By chatting with us, you agree to our <a href="#" className="underline">Privacy Policy</a>
                    </div>
                </div>
             </div>
             <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer bg-white" onClick={() => {}}>
                <ChevronDown className="h-7 w-7 text-zinc-900" />
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
