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
import { Bot as BotData, ChatMessage, User, HelpCenter } from '@/lib/data';
import { Bot as BotIcon, MessageSquare, ChevronLeft, MoreHorizontal, X, ChevronDown, Home, Ticket, Send, Check, ChevronsUpDown, Library, Upload, Loader2 } from 'lucide-react';
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
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { answerChatQuestion } from '@/ai/flows/answer-chat-question';
import { marked } from 'marked';


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
  headerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  customerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  agentIds: z.array(z.string()).min(1, 'Please select at least one agent.'),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  identityCaptureEnabled: z.boolean().default(true),
  identityCaptureRequired: z.boolean().default(false),
  identityCaptureMessage: z.string().optional(),
});

type BotSettingsFormValues = z.infer<typeof botSettingsSchema>;

interface BotSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (botData: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  allUsers: User[];
  helpCenters: HelpCenter[];
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
  allUsers,
  helpCenters,
}: BotSettingsDialogProps) {
  const [chatStarted, setChatStarted] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { appUser, activeHub } = useAuth();


  const form = useForm<BotSettingsFormValues>({
    resolver: zodResolver(botSettingsSchema),
    defaultValues: {
      name: '',
      welcomeMessage: 'Hi there',
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      headerTextColor: '#ffffff',
      customerTextColor: '#ffffff',
      logoUrl: '',
      agentIds: [],
      allowedHelpCenterIds: [],
      identityCaptureEnabled: true,
      identityCaptureRequired: false,
      identityCaptureMessage: 'Before we start, could I get your name and email?',
    },
  });
  
  const watchedValues = form.watch();
  const selectedAgents = allUsers.filter(u => watchedValues.agentIds?.includes(u.id));

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [previewMessages, isAiThinking]);

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
        headerTextColor: bot.styleSettings?.headerTextColor || '#ffffff',
        customerTextColor: bot.styleSettings?.customerTextColor || '#ffffff',
        logoUrl: bot.styleSettings?.logoUrl || '',
        agentIds: bot.agentIds || [],
        allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
        identityCaptureEnabled: bot.identityCapture?.enabled ?? true,
        identityCaptureRequired: bot.identityCapture?.required ?? false,
        identityCaptureMessage: bot.identityCapture?.captureMessage || 'Before we start, could I get your name and email?',
      });
    } else {
        form.reset({
            name: 'New Support Bot',
            welcomeMessage: 'Hi there! How can we help you today?',
            primaryColor: '#3b82f6',
            backgroundColor: '#111827',
            headerTextColor: '#ffffff',
            customerTextColor: '#ffffff',
            logoUrl: '',
            agentIds: [],
            allowedHelpCenterIds: [],
            identityCaptureEnabled: true,
            identityCaptureRequired: false,
            identityCaptureMessage: 'Before we start, could I get your name and email?',
        });
    }
  }, [bot, form]);
  
  useEffect(() => {
      if (!isOpen) {
          setChatStarted(false);
          setPreviewMessage('');
          setPreviewMessages([]);
          setIsPreviewMinimized(false);
      }
  }, [isOpen]);

  const onSubmit = (values: BotSettingsFormValues) => {
    const commonData = {
        name: values.name,
        welcomeMessage: values.welcomeMessage,
        layout: 'default' as const,
        styleSettings: {
            primaryColor: values.primaryColor,
            backgroundColor: values.backgroundColor,
            headerTextColor: values.headerTextColor || '#ffffff',
            customerTextColor: values.customerTextColor || '#ffffff',
            logoUrl: values.logoUrl || '',
        },
        agentIds: values.agentIds || [],
        allowedHelpCenterIds: values.allowedHelpCenterIds || [],
        identityCapture: {
            enabled: values.identityCaptureEnabled,
            required: values.identityCaptureRequired,
            captureMessage: values.identityCaptureMessage,
        },
        // Hardcoded escalation triggers for now, based on the prompt
        escalationTriggers: {
            billingKeywords: [
                'refund', 'charge', 'charged', 'billing', 'invoice', 
                'payment', 'credit card', 'overcharged', 'subscription', 'pricing error'
            ],
            sentimentThreshold: -0.5,
        }
    };

    if (bot) {
        onSave({ ...bot, ...commonData });
    } else {
        onSave(commonData);
    }
    onOpenChange(false);
  };
  
    const handlePreviewSend = async () => {
        if (!previewMessage.trim() || !appUser || !activeHub) return;

        const userMessage: ChatMessage = {
            id: `user-msg-${Date.now()}`,
            conversationId: 'preview-convo',
            authorId: appUser.id,
            type: 'message',
            senderType: 'contact', // Simulating a contact
            content: previewMessage,
            timestamp: new Date().toISOString(),
        };
        setPreviewMessages(prev => [...prev, userMessage]);
        const question = previewMessage;
        setPreviewMessage('');
        setIsAiThinking(true);

        try {
            const aiResponse = await answerChatQuestion({
                question: question,
                hubId: activeHub.id,
                allowedHelpCenterIds: watchedValues.allowedHelpCenterIds || [],
                userId: 'preview-user-id', // Simulate a generic user for access control check
                botName: watchedValues.name || 'Support Bot',
            });

            let responseContent = aiResponse.answer;
            if (aiResponse.sources && aiResponse.sources.length > 0) {
                const sourcesText = aiResponse.sources.map(source => `- [${source.title}](${source.url})`).join('\n');
                responseContent += `\n\n**Sources:**\n${sourcesText}`;
            }

            const aiMessage: ChatMessage = {
                id: `ai-msg-${Date.now()}`,
                conversationId: 'preview-convo',
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: responseContent,
                timestamp: new Date().toISOString(),
            };
            setPreviewMessages(prev => [...prev, aiMessage]);

        } catch (e) {
            console.error("AI preview failed:", e);
            const errorMessage: ChatMessage = {
                 id: `err-msg-${Date.now()}`,
                conversationId: 'preview-convo',
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: "Sorry, I encountered an error during this preview. Check the server logs for more details.",
                timestamp: new Date().toISOString(),
            };
            setPreviewMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAiThinking(false);
        }
    };
  
  const embedScript = bot ? `
  <script
  src="https://studio--timeflow-6i3eo.us-central1.hosted.app/chatbot-loader.js"
  data-bot-id="${bot.id}"
  data-hub-id="${bot.hubId}"
  async
></script>
  `.trim() : '';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] grid-cols-1 md:grid-cols-2 p-0">
        {/* Form Section */}
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>{bot ? `Bot Settings: ${bot.name}` : 'Create New Bot'}</DialogTitle>
            <DialogDescription>
                {bot ? 'Customize the appearance and behavior of your chat bot.' : 'Create a new chatbot to embed on your website.'}
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
                
                 <Accordion type="single" collapsible defaultValue="content" className="w-full">
                    <AccordionItem value="content">
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
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="knowledge">
                        <AccordionTrigger>Knowledge Sources</AccordionTrigger>
                         <AccordionContent className="space-y-4">
                              <FormField
                                control={form.control}
                                name="allowedHelpCenterIds"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Allowed Help Centers</FormLabel>
                                    <p className="text-sm text-muted-foreground">Select which knowledge bases this bot can use to answer questions.</p>
                                    <MultiSelectPopover 
                                        title="Help Centers"
                                        options={helpCenters.map(hc => ({ value: hc.id, label: hc.name }))}
                                        selected={field.value || []}
                                        onChange={field.onChange}
                                    />
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="identity-capture">
                        <AccordionTrigger>Identity Capture</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="identityCaptureEnabled"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                        <FormLabel>Enable Identity Capture</FormLabel>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )}
                            />
                             {watchedValues.identityCaptureEnabled && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="identityCaptureMessage"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Capture Message</FormLabel>
                                            <FormControl><Textarea placeholder="Before we start..." {...field} value={field.value || ''} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="identityCaptureRequired"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel>Is providing an email required?</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </>
                             )}
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
                                        <FormLabel>Logo</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-16 w-16 rounded-md">
                                                    <AvatarImage src={field.value || undefined} alt="Logo preview" className="object-contain" />
                                                    <AvatarFallback className="rounded-md">
                                                        <BotIcon />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    ref={fileInputRef}
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            const file = e.target.files[0];
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                field.onChange(reader.result as string);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Upload Logo
                                                </Button>
                                                {field.value && (
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange('')}>
                                                        Remove
                                                    </Button>
                                                )}
                                            </div>
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
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer">
                                            <div
                                                className="w-full h-full"
                                                style={{ backgroundColor: field.value }}
                                            ></div>
                                            <input
                                                type="color"
                                                value={field.value}
                                                onChange={field.onChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="headerTextColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Header Text Color</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#ffffff" {...field} value={field.value || ''} />
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer">
                                            <div
                                                className="w-full h-full"
                                                style={{ backgroundColor: field.value || '#ffffff' }}
                                            ></div>
                                            <input
                                                type="color"
                                                value={field.value || '#ffffff'}
                                                onChange={field.onChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
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
                                    <FormLabel>Customer Message Background</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input placeholder="#0057ff" {...field} />
                                            <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer">
                                                <div
                                                    className="w-full h-full"
                                                    style={{ backgroundColor: field.value }}
                                                ></div>
                                                <input
                                                    type="color"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </FormControl>
                                     <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="customerTextColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer Message Text Color</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#ffffff" {...field} value={field.value || ''} />
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer">
                                            <div
                                                className="w-full h-full"
                                                style={{ backgroundColor: field.value || '#ffffff' }}
                                            ></div>
                                            <input
                                                type="color"
                                                value={field.value || '#ffffff'}
                                                onChange={field.onChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
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
                            {bot ? (
                                <>
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
                                </>
                            ) : (
                                <div className="text-center text-sm text-muted-foreground p-4">
                                    Save the bot to get the installation script.
                                </div>
                            )}
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
                    <MessageSquare className="h-7 w-7 text-white" />
                </div>
            ) : (
             <>
                <div className="w-80 h-[450px] text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4" style={{ backgroundColor: watchedValues.backgroundColor }}>
                    {/* Header */}
                    <div className="p-3 border-b flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex items-center gap-3">
                        {watchedValues.logoUrl && (
                          <img src={watchedValues.logoUrl} alt="Bot Logo" className="h-8 w-8 object-contain rounded-full" />
                        )}
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold truncate text-base" style={{ color: watchedValues.headerTextColor || '#ffffff' }}>{watchedValues.name}</h3>
                            {selectedAgents.length > 0 && (
                                <div className="flex -space-x-2 overflow-hidden">
                                {selectedAgents.map(agent => (
                                    <Avatar key={agent.id} className="h-5 w-5 border-2" style={{ borderColor: watchedValues.backgroundColor }}>
                                        <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                                        <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                                    </Avatar>
                                ))}
                                </div>
                            )}
                        </div>
                      </div>
                       <div className="flex items-center">
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => onOpenChange(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                       </div>
                    </div>
                    
                    {/* Body */}
                    <ScrollArea className="flex-1" ref={scrollAreaRef}>
                        <div className="p-4 space-y-4 max-w-full break-all text-wrap">
                             <div className="flex items-end gap-2">
                                <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs break-words">
                                    <p className="text-sm whitespace-pre-wrap">{watchedValues.welcomeMessage}</p>
                                </div>
                            </div>
                             <p className="text-xs text-zinc-500">AI Agent • Just now</p>

                            {previewMessages.map(msg => {
                                const isAgent = msg.senderType === 'agent';
                                const isUser = msg.senderType === 'contact';
                                const contentHtml = isAgent ? marked(msg.content) : msg.content;
                                
                                return (
                                <div
                                    key={msg.id}
                                    className={cn('flex items-end gap-2', isAgent ? 'justify-start' : 'justify-end')}
                                >
                                    {isAgent ? (
                                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs break-words">
                                        {msg.content && <div className="text-sm prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: contentHtml as string }} />}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm break-words" style={{ backgroundColor: watchedValues.primaryColor, color: watchedValues.customerTextColor || '#ffffff' }}>
                                            {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            {isAiThinking && (
                                <div className="flex items-end gap-2">
                                    <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs flex items-center gap-2">
                                    <BotIcon className="h-4 w-4 animate-pulse" />
                                    <p className="text-sm">Thinking...</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </ScrollArea>
                    
                    {/* Footer */}
                    <div className="p-2 border-t shrink-0 flex items-end gap-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <div className="relative flex-1">
                            <Textarea
                                placeholder="Message..."
                                value={previewMessage}
                                onChange={(e) => setPreviewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePreviewSend();
                                    }
                                }}
                                minRows={1}
                                className="bg-zinc-800 border-zinc-700 text-white pr-10 resize-none"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={handlePreviewSend}
                                disabled={!previewMessage.trim()}
                                className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
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

function MultiSelectPopover({ title, options, selected, onChange }: { title: string, options: { value: string, label: string }[], selected: string[], onChange: (selected: string[]) => void }) {
    const [open, setOpen] = useState(false);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value];
        onChange(newSelected);
    }
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto">
                    <div className="flex flex-wrap gap-1">
                        {selected.length > 0 ? selected.map(value => {
                            const option = options.find(o => o.value === value);
                            return <Badge variant="secondary" key={value}>{option?.label || 'Unknown'}</Badge>;
                        }) : `Select ${title}...`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder={`Search ${title}...`} />
                    <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem key={option.value} value={option.label} onSelect={() => handleSelect(option.value)}>
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
    
