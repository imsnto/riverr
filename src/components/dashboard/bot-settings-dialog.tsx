
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
import { Bot, MessageSquare, ChevronLeft, MoreHorizontal, X, ChevronDown, Home, Ticket, Send } from 'lucide-react';
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
  welcomeMessage: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  showTickets: z.boolean(),
  promptButton1: z.string().optional(),
  promptButton2: z.string().optional(),
  promptButton3: z.string().optional(),
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
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      logoUrl: '',
      showTickets: false,
      promptButton1: '',
      promptButton2: '',
      promptButton3: '',
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
  }, [messages, chatStarted]);


  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        welcomeMessage: bot.welcomeMessage || 'Hi there',
        primaryColor: bot.styleSettings?.primaryColor || '#3b82f6',
        backgroundColor: bot.styleSettings?.backgroundColor || '#111827',
        logoUrl: bot.styleSettings?.logoUrl || '',
        showTickets: bot.spaces?.tickets ?? false,
        promptButton1: bot.promptButtons?.[0] || '',
        promptButton2: bot.promptButtons?.[1] || '',
        promptButton3: bot.promptButtons?.[2] || '',
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
            messages: true,
            tickets: values.showTickets,
        },
        styleSettings: {
            ...bot.styleSettings,
            primaryColor: values.primaryColor,
            backgroundColor: values.backgroundColor,
            logoUrl: values.logoUrl || '',
        },
        promptButtons: [values.promptButton1, values.promptButton2, values.promptButton3].filter(Boolean) as string[],
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
    
    return (
      <div key={msg.id} className="flex items-end gap-2 justify-end">
        <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: watchedValues.primaryColor }}>
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  };

  const promptButtons = [watchedValues.promptButton1, watchedValues.promptButton2, watchedValues.promptButton3].filter(Boolean);


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
                        <AccordionTrigger>Content</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="welcomeMessage"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Welcome Message</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Hi there" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-2">
                                <FormLabel>Prompt Buttons</FormLabel>
                                <FormField control={form.control} name="promptButton1" render={({ field }) => (<FormItem><FormControl><Input placeholder="Prompt 1..." {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="promptButton2" render={({ field }) => (<FormItem><FormControl><Input placeholder="Prompt 2..." {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="promptButton3" render={({ field }) => (<FormItem><FormControl><Input placeholder="Prompt 3..." {...field} /></FormControl></FormItem>)} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="branding">
                        <AccordionTrigger>Branding</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="logoUrl"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Logo URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://your-domain.com/logo.png" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="backgroundColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Background Color</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#111827" {...field} />
                                        <div
                                        className="w-8 h-8 rounded-md border"
                                        style={{ backgroundColor: field.value }}
                                        ></div>
                                    </div>
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
                                    <FormLabel>Customer Message Color</FormLabel>
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
             <div className="w-80 h-[600px] text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: watchedValues.backgroundColor }}>
                {/* Header */}
                <div className="p-3 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                     {watchedValues.logoUrl ? (
                        <img src={watchedValues.logoUrl} alt="Bot Logo" className="h-6 w-6" />
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-white">
                            <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" transform="rotate(90 12 12)"/>
                        </svg>
                    )}
                    <div>
                        <h3 className="font-bold text-white">{watchedValues.name}</h3>
                        <p className="text-xs text-zinc-400">We'll reply as soon as we can</p>
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
                    <div className="p-4 space-y-4">
                         <div className="flex items-end gap-2">
                             <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                                 <p className="text-sm whitespace-pre-wrap">{watchedValues.welcomeMessage}</p>
                             </div>
                         </div>
                         <p className="text-xs text-zinc-500">Fin • AI Agent • Just now</p>

                        {(messages.length === 0 && !chatStarted) ? (
                            <div className="pt-2 space-y-2">
                                {promptButtons.map((prompt, index) => (
                                     <Button key={index} onClick={() => handlePromptClick(prompt)} variant="outline" className="w-full justify-center bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white rounded-md">
                                        {prompt}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                             messages.map(renderMessageBubble)
                        )}
                    </div>
                </ScrollArea>
                
                {/* Footer */}
                <div className="p-4 border-t shrink-0 space-y-3" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    {(chatStarted || messages.length > 0) ? (
                        <div className="relative">
                        <Textarea 
                            placeholder="Message..."
                            value={previewMessage}
                            onChange={(e) => setPreviewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePreviewSend(); }}}
                            minRows={1}
                            className="bg-zinc-800 border-zinc-700 text-white pr-10"
                        />
                         <Button size="icon" variant="ghost" onClick={handlePreviewSend} disabled={!previewMessage.trim()} className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700">
                            <Send className="h-4 w-4" />
                         </Button>
                        </div>
                    ) : (
                         <div className="text-center">
                            <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white" onClick={() => setChatStarted(true)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send us a message
                            </Button>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs text-zinc-500">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }}>
                                <Home className="h-5 w-5" />
                            </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }}>
                                <MessageSquare className="h-5 w-5" />
                            </Button>
                            {watchedValues.showTickets && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }}>
                                    <Ticket className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                        <a href="#" className="underline">We run on Intercom</a>
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
