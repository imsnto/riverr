
'use client';

import React, { useEffect, useState, useRef } from 'react';
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
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
import { Bot as BotIcon, X, Check, ChevronsUpDown, Upload, Loader2, Send, MessageSquare, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { marked } from 'marked';
import { handleIncomingMessage, AgentAdapters, BotConfig as AgentConfig, Conversation as AgentConversation, IncomingMessage } from '@/lib/agent';
import { searchHelpCenterAction, searchSupportAction } from '@/app/actions/chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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

const agentSettingsSchema = z.object({
  name: z.string().min(1, 'Agent name is required.'),
  welcomeMessage: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  headerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  customerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  chatbotIconsTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  chatbotIconsColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  agentIds: z.array(z.string()).min(1, 'Please select at least one agent.'),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  identityCaptureEnabled: z.boolean().default(true),
  identityCaptureRequired: z.boolean().default(false),
  identityCaptureMessage: z.string().optional(),
});

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>;

interface AgentSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (agentData: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  allUsers: User[];
  helpCenters: HelpCenter[];
}

const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot: agent,
  onSave,
  allUsers,
  helpCenters,
}: AgentSettingsDialogProps) {
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);
  const [previewConversation, setPreviewConversation] = useState<AgentConversation | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { appUser, activeHub } = useAuth();


  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: '',
      welcomeMessage: 'Hi there',
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      headerTextColor: '#ffffff',
      customerTextColor: '#ffffff',
      chatbotIconsColor: '#ffffff',
      chatbotIconsTextColor: '#000000',
      logoUrl: '',
      agentIds: [],
      allowedHelpCenterIds: [],
      identityCaptureEnabled: true,
      identityCaptureRequired: false,
      identityCaptureMessage: 'Before we start, could I get your name and email?',
    },
  });
  
  const watchedValues = form.watch();
  const selectedLiveAgents = allUsers.filter(u => watchedValues.agentIds?.includes(u.id));

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [previewMessages, isAiThinking]);


  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        welcomeMessage: agent.welcomeMessage || 'Hi there',
        primaryColor: agent.styleSettings?.primaryColor || '#3b82f6',
        backgroundColor: agent.styleSettings?.backgroundColor || '#111827',
        headerTextColor: agent.styleSettings?.headerTextColor || '#ffffff',
        customerTextColor: agent.styleSettings?.customerTextColor || '#ffffff',
        chatbotIconsColor: agent.styleSettings?.chatbotIconsColor || '#ffffff',
        chatbotIconsTextColor: agent.styleSettings?.chatbotIconsTextColor || '#000000',
        logoUrl: agent.styleSettings?.logoUrl || '',
        agentIds: agent.agentIds || [],
        allowedHelpCenterIds: agent.allowedHelpCenterIds || [],
        identityCaptureEnabled: agent.identityCapture?.enabled ?? true,
        identityCaptureRequired: agent.identityCapture?.required ?? false,
        identityCaptureMessage: agent.identityCapture?.captureMessage || 'Before we start, could I get your name and email?',
      });
    } else {
        form.reset({
            name: 'New AI Agent',
            welcomeMessage: 'Hi there! How can we help you today?',
            primaryColor: '#3b82f6',
            backgroundColor: '#111827',
            headerTextColor: '#ffffff',
            customerTextColor: '#ffffff',
            chatbotIconsColor: '#ffffff',
            chatbotIconsTextColor: '#000000',
            logoUrl: '',
            agentIds: [],
            allowedHelpCenterIds: [],
            identityCaptureEnabled: true,
            identityCaptureRequired: false,
            identityCaptureMessage: 'Before we start, could I get your name and email?',
        });
    }
  }, [agent, form]);
  
  useEffect(() => {
      if (!isOpen) {
          setPreviewMessage('');
          setPreviewMessages([]);
          setIsPreviewMinimized(false);
          setPreviewConversation(null);
      } else {
        // Initialize preview conversation
        if (activeHub) {
            setPreviewConversation({
                id: 'preview-convo-1',
                hubId: activeHub.id,
                state: 'ai_active',
                escalated: false,
                visitorName: appUser?.name,
                visitorEmail: appUser?.email,
                userId: appUser?.id,
            });
        }
      }
  }, [isOpen, activeHub, appUser]);

  const onSubmit = (values: AgentSettingsFormValues) => {
    const commonData = {
        name: values.name,
        welcomeMessage: values.welcomeMessage,
        layout: 'default' as const,
        styleSettings: {
            primaryColor: values.primaryColor,
            backgroundColor: values.backgroundColor,
            headerTextColor: values.headerTextColor || '#ffffff',
            customerTextColor: values.customerTextColor || '#ffffff',
            chatbotIconsTextColor: values.chatbotIconsTextColor || '#000000',
            chatbotIconsColor: values.chatbotIconsColor || '#ffffff',
            logoUrl: values.logoUrl || '',
        },
        agentIds: values.agentIds,
        allowedHelpCenterIds: values.allowedHelpCenterIds || [],
        identityCapture: {
            enabled: values.identityCaptureEnabled,
            required: values.identityCaptureRequired,
            captureMessage: values.identityCaptureMessage,
        },
        escalationTriggers: {
            billingKeywords: [
                'refund', 'charge', 'charged', 'billing', 'invoice', 
                'payment', 'credit card', 'overcharged', 'subscription', 'pricing error'
            ],
            sentimentThreshold: -0.5,
        }
    };

    if (agent) {
        onSave({ ...agent, ...commonData });
    } else {
        onSave(commonData);
    }
    onOpenChange(false);
  };
  
    const handlePreviewSend = async () => {
        if (!previewMessage.trim() || !appUser || !activeHub || !previewConversation) return;

        const userMessage: ChatMessage = {
            id: `user-msg-${Date.now()}`,
            conversationId: 'preview-convo',
            authorId: appUser.id,
            type: 'message',
            senderType: 'contact',
            content: previewMessage,
            timestamp: new Date().toISOString(),
        };
        setPreviewMessages(prev => [...prev, userMessage]);
        
        const incomingMessage: IncomingMessage = {
            id: userMessage.id,
            role: 'user',
            text: previewMessage,
            createdAt: userMessage.timestamp,
        }

        setPreviewMessage('');
        setIsAiThinking(true);

        const botConfig: AgentConfig = {
            id: agent?.id || 'preview-bot',
            hubId: activeHub.id,
            name: watchedValues.name || 'Support Agent',
            allowedHelpCenterIds: watchedValues.allowedHelpCenterIds || [],
        };
        
        const mockAdapters: AgentAdapters = {
            searchHelpCenter: searchHelpCenterAction,
            searchSupport: searchSupportAction,
            escalateToHuman: async (args) => {
                setPreviewConversation(prev => prev ? { ...prev, state: 'human_assigned', escalated: true, escalationReason: args.reason } : prev);
            },
            persistAssistantMessage: async (args) => {
                const aiMessage: ChatMessage = {
                    id: `ai-msg-${Date.now()}`,
                    conversationId: 'preview-convo',
                    authorId: 'ai_agent',
                    type: 'message',
                    senderType: 'agent',
                    content: args.text,
                    timestamp: new Date().toISOString(),
                };
                setPreviewMessages(prev => [...prev, aiMessage]);
            },
            updateConversation: async (args) => {
                 setPreviewConversation(prev => prev ? { ...prev, ...args.patch } : prev);
            },
        };

        try {
            await handleIncomingMessage({
                bot: botConfig,
                conversation: previewConversation,
                message: incomingMessage,
                adapters: mockAdapters,
            });
        } catch (e) {
            console.error("Agent Handler failed:", e);
             const errorMessage: ChatMessage = {
                 id: `err-msg-${Date.now()}`,
                conversationId: 'preview-convo',
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: "Sorry, I encountered an error during this preview. Check the console for details.",
                timestamp: new Date().toISOString(),
            };
            setPreviewMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAiThinking(false);
        }
    };
  
  const embedScript = agent ? `
  <script
  src="https://studio--timeflow-6i3eo.us-central1.hosted.app/chatbot-loader.js"
  data-bot-id="${agent.id}"
  data-hub-id="${agent.hubId}"
  async
></script>
  `.trim() : '';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] grid-cols-1 md:grid-cols-2 p-0">
        {/* Form Section */}
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>{agent ? `Agent Settings: ${agent.name}` : 'Create New Agent'}</DialogTitle>
            <DialogDescription>
                {agent ? 'Customize the appearance and behavior of your AI agent.' : 'Create a new AI agent to embed on your website.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="agent-settings-form" className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-6">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Agent Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Support Agent" {...field} />
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
                    
                    <Tabs defaultValue="behavior" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="behavior">Behavior</TabsTrigger>
                        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
                        <TabsTrigger value="branding">Branding</TabsTrigger>
                        <TabsTrigger value="installation">Install</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="behavior" className="pt-6 space-y-6">
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
                      </TabsContent>

                      <TabsContent value="knowledge" className="pt-6">
                          <FormField
                            control={form.control}
                            name="allowedHelpCenterIds"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Knowledge Sources</FormLabel>
                                <p className="text-sm text-muted-foreground">Select which knowledge bases this agent can use to answer questions.</p>
                                <MultiSelectPopover 
                                    title="Knowledge Bases"
                                    options={helpCenters.map(hc => ({ value: hc.id, label: hc.name }))}
                                    selected={field.value || []}
                                    onChange={field.onChange}
                                />
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                      </TabsContent>

                      <TabsContent value="branding" className="pt-6 space-y-4">
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
                      </TabsContent>
                      
                      <TabsContent value="installation" className="pt-6">
                        {agent ? (
                            <>
                                <div>
                                    <Label className="font-semibold">Embeddable Script</Label>
                                    <p className="text-sm text-muted-foreground mt-1 mb-2">To add this agent to your website, paste this code snippet before the closing <code>&lt;/body&gt;</code> tag of your HTML file.</p>
                                    <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto font-mono text-foreground">
                                        <code>{embedScript}</code>
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-sm text-muted-foreground p-4">
                                Save the agent to get the installation script.
                            </div>
                        )}
                      </TabsContent>

                    </Tabs>
                  </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-background shrink-0">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" form="agent-settings-form">Save Changes</Button>
                </DialogFooter>
            </form>
          </Form>

        </div>

        {/* Preview Section */}
        <div className="bg-muted/50 p-6 flex flex-col items-center justify-center rounded-r-lg relative overflow-hidden">
            {isPreviewMinimized ? (
                <div 
                    className="absolute bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                    style={{ backgroundColor: watchedValues.chatbotIconsColor, color: watchedValues.chatbotIconsTextColor }}
                    onClick={() => setIsPreviewMinimized(false)}
                >
                    <MessageSquare className="h-7 w-7" />
                </div>
            ) : (
             <>
                <div className="w-80 h-[450px] text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4" style={{ backgroundColor: watchedValues.backgroundColor }}>
                    {/* Header */}
                    <div className="p-3 border-b flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <div className="flex items-center gap-3">
                        {watchedValues.logoUrl && (
                          <img src={watchedValues.logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded-full" />
                        )}
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold truncate text-base" style={{ color: watchedValues.headerTextColor || '#ffffff' }}>{watchedValues.name}</h3>
                            {selectedLiveAgents.length > 0 && (
                                <div className="flex -space-x-2 overflow-hidden ml-2">
                                {selectedLiveAgents.map(liveAgent => (
                                    <Avatar key={liveAgent.id} className="h-5 w-5 border-2" style={{ borderColor: watchedValues.backgroundColor }}>
                                        <AvatarImage src={liveAgent.avatarUrl} alt={liveAgent.name} />
                                        <AvatarFallback>{getInitials(liveAgent.name)}</AvatarFallback>
                                    </Avatar>
                                ))}
                                </div>
                            )}
                        </div>
                      </div>
                       <div className="flex items-center">
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700"
                         style={{color: watchedValues.chatbotIconsTextColor }}
                         onClick={() => onOpenChange(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                       </div>
                    </div>
                    
                    {/* Body */}
                    <ScrollArea className="flex-1" ref={scrollAreaRef}>
                        <div className="p-4 space-y-4 max-w-full text-wrap">
                             <div className="flex items-end gap-2">
                                <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs break-words">
                                    <p className="text-sm whitespace-pre-wrap">{watchedValues.welcomeMessage}</p>
                                </div>
                            </div>
                             <p className="text-xs text-zinc-500">AI Agent • Just now</p>

                            {previewMessages.map(msg => {
                                const isAgent = msg.senderType === 'agent';
                                const contentHtml = isAgent ? marked(msg.content) : msg.content;
                                
                                return (
                                <div
                                    key={msg.id}
                                    className={cn('flex items-end gap-2', isAgent ? 'justify-start' : 'justify-end')}
                                >
                                    {isAgent ? (
                                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs break-words">
                                        {msg.content && <div className="text-sm prose prose-sm prose-invert break-words" dangerouslySetInnerHTML={{ __html: contentHtml as string }} />}
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
                <div className="absolute bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer" style={{ backgroundColor: watchedValues.chatbotIconsColor, color: watchedValues.chatbotIconsTextColor }}
 onClick={() => setIsPreviewMinimized(true)}>
                    <ChevronDown className="h-7 w-7" />
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
