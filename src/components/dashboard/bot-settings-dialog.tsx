
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
import { Bot, MessageSquare, ChevronLeft, MoreHorizontal, X, ChevronDown, Home, Ticket, Send, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';


function MemberSelect({ allUsers, selectedUsers, onChange }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void }) {
    const [open, setOpen] = React.useState(false);
  
    const handleSelect = (userId: string) => {
        const newSelected = selectedUsers.includes(userId)
            ? selectedUsers.filter(id => id !== userId)
            : [...selectedUsers, userId];
        onChange(newSelected);
    };

    return (
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto min-h-10"
            >
             <div className="flex flex-wrap gap-1">
                 {selectedUsers.length > 0 ? selectedUsers.map(id => {
                     const user = allUsers.find(u => u.id === id);
                     return <Badge variant="secondary" key={id}>{user?.name || 'Unknown'}</Badge>;
                 }) : "Select agents..."}
             </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search users..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {allUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.name}
                      onSelect={() => handleSelect(user.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {user.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
}

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
  agentIds: z.array(z.string()).optional(),
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
  allUsers
}: BotSettingsDialogProps) {
  const [chatStarted, setChatStarted] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState('');


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
      agentIds: [],
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
    if (typeof window !== 'undefined') {
        setOrigin(window.location.origin);
    }
  }, [])


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
        agentIds: bot.agentIds || [],
      });
    }
  }, [bot, form]);
  
  useEffect(() => {
      if (!isOpen) {
          setChatStarted(false);
          setPreviewMessage('');
          setIsPreviewMinimized(false);
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
        agentIds: values.agentIds,
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
    
    const uniqueKey = `${msg.id}-${msg.timestamp}`;
    
    return (
      <div key={uniqueKey} className="flex items-end gap-2 justify-end">
        <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: watchedValues.primaryColor }}>
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  };

  const promptButtons = [watchedValues.promptButton1, watchedValues.promptButton2, watchedValues.promptButton3].filter(Boolean);
  const embedScript = `
<script>
    window.riverrChatConfig = { botId: "${bot.id}", hubId: "${bot.hubId}" };
    var d=document,s=d.createElement('script');
    s.src='${origin}/chatbot-loader.js';
    s.async=true;
    d.body.appendChild(s);
</script>
  `.trim();


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] grid-cols-1 md:grid-cols-2 p-0">
        {/* Form Section */}
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>Bot Settings: {bot.name}</DialogTitle>
            <DialogDescription>
                Customize the appearance and behavior of your chat bot.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="bot-settings-form" className="p-6 space-y-6">
                
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

                 <FormField
                    control={form.control}
                    name="agentIds"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Live Agents</FormLabel>
                        <FormControl>
                            <MemberSelect 
                                allUsers={allUsers} 
                                selectedUsers={field.value || []} 
                                onChange={field.onChange}
                            />
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
                     <AccordionItem value="installation">
                        <AccordionTrigger>Installation</AccordionTrigger>
                        <AccordionContent className="space-y-6">
                            <div>
                                <Label className="font-semibold">Embeddable Script</Label>
                                <p className="text-sm text-muted-foreground mt-1 mb-2">To add this chatbot to your website, paste this code snippet before the closing <code>&lt;/body&gt;</code> tag of your HTML file.</p>
                                <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto font-mono text-foreground">
                                    <code>{embedScript}</code>
                                </pre>
                            </div>
                            <div>
                                <Label className="font-semibold">Webflow Installation</Label>
                                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 mt-2">
                                    <li>In your Webflow project, go to <strong>Project Settings</strong>.</li>
                                    <li>Click on the <strong>Custom Code</strong> tab.</li>
                                    <li>Find the <strong>Footer Code</strong> section.</li>
                                    <li>Paste the code snippet from above into this box.</li>
                                    <li>Click <strong>Save Changes</strong> and then <strong>Publish</strong> your site.</li>
                                </ol>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t bg-background shrink-0">
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
            {isPreviewMinimized ? (
                <div 
                    className="absolute bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                    style={{ backgroundColor: watchedValues.primaryColor }}
                    onClick={() => setIsPreviewMinimized(false)}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-white">
                        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            ) : (
             <>
                <div className="w-80 h-[450px] text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: watchedValues.backgroundColor }}>
                    {/* Header */}
                    <div className="p-3 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        {watchedValues.logoUrl ? (
                            <img src={watchedValues.logoUrl} alt="Bot Logo" className="h-6 w-6 object-contain" />
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
                <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer bg-white" onClick={() => setIsPreviewMinimized(true)}>
                    <ChevronDown className="h-7 w-7 text-zinc-900" />
                </div>
             </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
