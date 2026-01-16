
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
import { Label } from '@/components/ui/label';
import { Bot as BotData, ChatContact, ChatMessage, User } from '@/lib/data';
import { Bot, MessageSquare, Home, Ticket, ChevronRight, Layout, MessagesSquare, Tv2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';


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
  appUser,
  allUsers,
}: BotSettingsDialogProps) {
  const [isPreviewChatOpen, setIsPreviewChatOpen] = useState(false);
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
          setIsPreviewChatOpen(false);
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

  const renderMessageBubble = (msg: ChatMessage) => {
    if (msg.type !== 'message' || !contact) {
        return null;
    }
    
    // In preview, all messages are from the contact
    return (
      <div key={msg.id} className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
            <AvatarImage src={contact.avatarUrl} />
            <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
        </Avatar>
        <div className={cn("rounded-lg p-3 max-w-xs", "bg-card border")}>
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
                    <Label>Spaces</Label>
                    <Card className="p-2 space-y-1">
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
             <div className="w-72 h-[500px] rounded-2xl shadow-2xl bg-background flex flex-col overflow-hidden">
                {isPreviewChatOpen ? (
                    <>
                    {/* Chat Header */}
                    <div style={{ backgroundColor: watchedValues.primaryColor }} className="p-3 text-white flex items-center gap-2 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20" onClick={() => setIsPreviewChatOpen(false)}>
                            <ArrowLeft />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">
                                    {getInitials(watchedValues.name)}
                                </div>
                                 <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" style={{ borderColor: watchedValues.primaryColor }}/>
                            </div>
                            <div>
                                <h3 className="font-bold">{watchedValues.name}</h3>
                                <p className="text-xs opacity-80">We'll reply as soon as we can</p>
                            </div>
                        </div>
                    </div>
                    {/* Chat Body */}
                    <ScrollArea className="flex-1 bg-white dark:bg-background" ref={scrollAreaRef}>
                        <div className="p-3 space-y-4">
                            <p className="text-xs text-center text-muted-foreground p-2">This is a preview. Your messages will be sent to your inbox.</p>
                            {messages.map(renderMessageBubble)}
                        </div>
                    </ScrollArea>
                    {/* Chat Composer */}
                    <div className="p-2 border-t bg-background flex-shrink-0">
                        <Textarea 
                            placeholder="Message..."
                            value={previewMessage}
                            onChange={(e) => setPreviewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePreviewSend(); }}}
                            minRows={1}
                        />
                        <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={handlePreviewSend} disabled={!previewMessage.trim()}>Send</Button>
                        </div>
                    </div>
                    </>
                ) : (
                    <>
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
                        <button onClick={() => setIsPreviewChatOpen(true)} className="w-full flex justify-between items-center p-3 bg-white dark:bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="font-semibold text-sm">Send us a message</p>
                                <p className="text-xs text-muted-foreground">We'll reply as soon as we can</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                    {/* Footer */}
                    <div className="p-2 border-t flex justify-around items-center">
                        <Button variant="ghost" className="flex flex-col h-auto p-2 font-normal text-xs gap-1">
                            <MessageSquare className="h-5 w-5" />
                            Messages
                        </Button>
                        {watchedValues.showTickets && (
                            <Button variant="ghost" className="flex flex-col h-auto p-2 font-normal text-xs gap-1">
                                <Ticket className="h-5 w-5" />
                                Tickets
                            </Button>
                        )}
                    </div>
                    </>
                )}
             </div>
             <div className="absolute bottom-5 right-5 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer" style={{ backgroundColor: watchedValues.primaryColor }} onClick={() => setIsPreviewChatOpen(true)}>
                 <MessageSquare className="h-7 w-7 text-white" />
             </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
