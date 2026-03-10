
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, HelpCenter, PhoneChannelLookup, EmailConfig } from '@/lib/data';
import { 
  Bot as BotIcon, 
  X, 
  Check, 
  ChevronsUpDown, 
  Upload, 
  Loader2, 
  Send, 
  MessageSquare, 
  Copy, 
  Terminal, 
  ShieldCheck, 
  Smartphone, 
  Globe, 
  Wand2, 
  Zap, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Palette, 
  Layout, 
  Settings, 
  Plug,
  BookOpen,
  Eye,
  MessageCircle,
  Phone,
  Mic,
  Clock,
  ShieldAlert,
  ChevronDown,
  Mail,
  Sparkles,
  User as UserIcon,
  Forward,
  Plus
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AutomationFlowBuilder from './automation-flow-builder';
import { Separator } from '../ui/separator';
import Link from 'next/link';
import ChatbotSimulator from './chatbot-simulator';
import * as db from '@/lib/db';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import ConnectEmailDialog from './connect-email-dialog';

function MemberSelect({ allUsers, selectedUsers, onChange }: { allUsers: User[], selectedUsers: string[], onChange: (users: string[]) => void }) {
    const [open, setOpen] = useState(false);
  
    const handleSelect = (userId: string) => {
        const newSelected = selectedUsers.includes(userId)
            ? selectedUsers.filter(id => id !== userId)
            : [...selectedUsers, userId];
        onChange(newSelected);
    };

    return (
      <div className="w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto min-h-10 text-left bg-muted/20 border-white/10"
            >
             <div className="flex flex-wrap gap-1">
                 {selectedUsers.length > 0 ? selectedUsers.length + " agents selected" : "Select agents..."}
             </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search users..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {allUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
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
  isEnabled: z.boolean().default(true),
  aiEnabled: z.boolean().default(true),
  welcomeMessage: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.'),
  headerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  customerTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  agentMessageBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  agentMessageTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  chatbotIconsTextColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  chatbotIconsColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color.').optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  agentIds: z.array(z.string()).optional(),
  escalateToTeamInbox: z.boolean().optional(),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  handoffKeywords: z.array(z.string()).default([]),
  flow: z.any().optional(),
  channelConfig: z.object({
    web: z.object({ enabled: z.boolean() }),
    sms: z.object({ 
      enabled: z.boolean(), 
      numberConfigs: z.record(z.object({ aiMode: z.enum(['off', 'draft', 'auto']) })) 
    }),
    email: z.object({ 
      enabled: z.boolean(), 
      emailConfigs: z.record(z.object({ aiMode: z.enum(['off', 'draft', 'auto']), aiGreetingScript: z.string() })) 
    }),
    voice: z.object({ 
      enabled: z.boolean(), 
      numberConfigs: z.record(z.object({ 
        aiCallMode: z.enum(['agent_only', 'warm_handoff', 'full_ai']),
        handoffRouteTo: z.enum(['any', 'assigned', 'team']),
        handoffTimeoutSeconds: z.number(),
        handoffFallback: z.enum(['voicemail', 'ai_resolve', 'callback']),
        aiGreeting: z.boolean(),
        transcribe: z.boolean(),
        afterHoursAiOnly: z.boolean(),
        voicemailFallback: z.boolean(),
        greetingScript: z.string()
      })) 
    })
  }).optional(),
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

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot: agent,
  onSave,
  appUser,
  allUsers,
  helpCenters,
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [isFlowBuilderOpen, setIsFlowBuilderOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConnectEmailOpen, setIsConnectEmailOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneChannelLookup[]>([]);
  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isPersonal = agent?.ownerType === 'user';
  const MAX_CHANNELS = 2;

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: '',
      isEnabled: true,
      aiEnabled: true,
      welcomeMessage: 'Hi there! How can we help you today?',
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      headerTextColor: '#ffffff',
      agentMessageBackgroundColor: '#374151',
      agentMessageTextColor: '#ffffff',
      customerTextColor: '#ffffff',
      chatbotIconsColor: '#3b82f6',
      chatbotIconsTextColor: '#ffffff',
      logoUrl: '',
      agentIds: [],
      escalateToTeamInbox: true,
      allowedHelpCenterIds: [],
      handoffKeywords: ['agent', 'human', 'speak to person'],
      flow: { nodes: [], edges: [] },
      channelConfig: {
        web: { enabled: true },
        sms: { enabled: true, numberConfigs: {} },
        email: { enabled: true, emailConfigs: {} },
        voice: { enabled: true, numberConfigs: {} }
      }
    },
  });
  
  const watchedValues = form.watch();

  useEffect(() => {
    if (isOpen && agent) {
      if (isPersonal) {
        db.getAgentEmailConfigs(agent.ownerId).then(setEmailConfigs);
      } else {
        db.getPhoneLookupsForHub(agent.hubId).then(setPhoneNumbers);
        db.getEmailConfigs(agent.spaceId, agent.hubId).then(setEmailConfigs);
      }
    }
  }, [isOpen, agent, isPersonal]);

  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        isEnabled: agent.isEnabled ?? true,
        aiEnabled: agent.aiEnabled ?? true,
        welcomeMessage: agent.welcomeMessage || 'Hi there! How can we help you today?',
        primaryColor: agent.styleSettings?.primaryColor || '#3b82f6',
        backgroundColor: agent.styleSettings?.backgroundColor || '#111827',
        headerTextColor: agent.styleSettings?.headerTextColor || '#ffffff',
        agentMessageBackgroundColor: agent.styleSettings?.agentMessageBackgroundColor || '#374151',
        agentMessageTextColor: agent.styleSettings?.agentMessageTextColor || '#ffffff',
        customerTextColor: agent.styleSettings?.customerTextColor || '#ffffff',
        chatbotIconsColor: agent.styleSettings?.chatbotIconsColor || '#3b82f6',
        chatbotIconsTextColor: agent.styleSettings?.chatbotIconsTextColor || '#ffffff',
        logoUrl: agent.styleSettings?.logoUrl || '',
        agentIds: agent.agentIds || [],
        escalateToTeamInbox: agent.escalateToTeamInbox ?? true,
        allowedHelpCenterIds: agent.allowedHelpCenterIds || [],
        handoffKeywords: agent.automations?.handoffKeywords || ['agent', 'human', 'speak to person'],
        flow: agent.flow || { nodes: [], edges: [] },
        channelConfig: agent.channelConfig || {
          web: { enabled: true },
          sms: { enabled: false, numberConfigs: {} },
          email: { enabled: false, emailConfigs: {} },
          voice: { enabled: false, numberConfigs: {} }
        }
      });
    }
  }, [agent, form]);

  const onSubmit = (values: AgentSettingsFormValues) => {
    const commonData = {
        name: values.name,
        isEnabled: values.isEnabled,
        aiEnabled: values.aiEnabled,
        welcomeMessage: values.welcomeMessage,
        layout: 'default' as const,
        styleSettings: {
            primaryColor: values.primaryColor,
            backgroundColor: values.backgroundColor,
            headerTextColor: values.headerTextColor || '#ffffff',
            agentMessageBackgroundColor: values.agentMessageBackgroundColor || '#374151',
            agentMessageTextColor: values.agentMessageTextColor || '#ffffff',
            customerTextColor: values.customerTextColor || '#ffffff',
            chatbotIconsTextColor: values.chatbotIconsTextColor || '#ffffff',
            chatbotIconsColor: values.chatbotIconsColor || '#3b82f6',
            logoUrl: values.logoUrl || '',
        },
        agentIds: values.agentIds || [],
        escalateToTeamInbox: values.escalateToTeamInbox,
        allowedHelpCenterIds: values.allowedHelpCenterIds || [],
        identityCapture: { enabled: false, required: false }, 
        automations: {
            handoffKeywords: values.handoffKeywords,
            quickReplies: [],
        },
        flow: values.flow,
        channelConfig: values.channelConfig,
        escalationTriggers: {
            billingKeywords: ['refund', 'charge', 'invoice'],
            sentimentThreshold: -0.5,
        }
    };

    if (agent) {
        onSave({ ...agent, ...commonData });
    } else {
        // @ts-ignore
        onSave(commonData);
    }
    onOpenChange(false);
  };
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !watchedValues.handoffKeywords.includes(kw)) {
        form.setValue('handoffKeywords', [...watchedValues.handoffKeywords, kw]);
        setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    form.setValue('handoffKeywords', watchedValues.handoffKeywords.filter(k => k !== kw));
  };

  const handleToggleChannel = (path: any, checked: boolean) => {
    if (checked) {
      const enabledCount = [
        watchedValues.channelConfig?.web?.enabled,
        watchedValues.channelConfig?.sms?.enabled,
        watchedValues.channelConfig?.email?.enabled,
        watchedValues.channelConfig?.voice?.enabled
      ].filter(Boolean).length;

      if (enabledCount >= MAX_CHANNELS) {
        toast({
          variant: "destructive",
          title: "Channel limit reached",
          description: `You can only enable a maximum of ${MAX_CHANNELS} channels per agent.`
        });
        return;
      }
    }
    form.setValue(path, checked);
  };

  const basicSnippet = agent ? `<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${agent.id}" data-hub-id="${agent.hubId}" async></script>`.trim() : '';

  const userAwareSnippet = agent ? `
<script>
  window.Manowar = window.Manowar || function() { (window.Manowar.q = window.Manowar.q || []).push(arguments) };
  Manowar('update', {
    user_id: 'REPLACE_WITH_USER_ID',
    email: 'REPLACE_WITH_USER_EMAIL',
    name: 'REPLACE_WITH_USER_NAME'
  });
</script>
<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${agent.id}" data-hub-id="${agent.hubId}" async></script>
`.trim() : '';

  const navItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'workflow', label: 'Workflow', icon: Zap },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'channels', label: 'Channels', icon: Globe },
    { id: 'installation', label: 'Install', icon: Plug, hidden: isPersonal },
  ];

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full overflow-hidden">
            <aside className="w-64 border-r border-white/10 flex flex-col bg-[#090c10] shrink-0">
                <div className="p-6 pb-4">
                    <DialogHeader className="text-left space-y-0">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-2 w-2 rounded-full", watchedValues.isEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600")} />
                            <div>
                                <DialogTitle className="text-base font-bold text-white leading-tight">
                                    {watchedValues.name || 'New Agent'}
                                </DialogTitle>
                                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                    {isPersonal ? 'Personal Assistant' : 'AI Agent Configuration'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <nav className="flex-1 p-2 space-y-1">
                    {navItems.filter(i => !i.hidden).map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                                activeTab === item.id 
                                    ? "bg-white/5 text-white border-l-2 border-primary" 
                                    : "text-muted-foreground hover:bg-white/[0.02] hover:text-white"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", activeTab === item.id ? "text-primary" : "text-muted-foreground group-hover:text-white")} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <FormField
                        control={form.control}
                        name="isEnabled"
                        render={({ field }) => (
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Status</span>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </div>
                        )}
                    />
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 relative">
                <ScrollArea className="flex-1">
                    <div className="p-8 max-w-full mx-auto space-y-10">
                        {activeTab === 'general' && (
                            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">General</h2>
                                    <p className="text-muted-foreground text-sm">Identity and access settings for your agent.</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Agent Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="My Assistant" {...field} className="bg-muted/20 border-white/10 h-11" />
                                            </FormControl>
                                            <FormDescription className="text-xs">The display name for this assistant.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {!isPersonal ? (
                                    <FormField
                                        control={form.control}
                                        name="agentIds"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Live Agents</FormLabel>
                                                <FormControl>
                                                    <MemberSelect 
                                                        allUsers={allUsers} 
                                                        selectedUsers={field.value || []} 
                                                        onChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">Teammates who can jump in to help when AI escalates.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <FormField
                                        control={form.control}
                                        name="escalateToTeamInbox"
                                        render={({ field }) => (
                                            <div className="rounded-2xl border border-white/10 bg-[#161b22] p-6 flex items-center justify-between shadow-sm">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-white flex items-center gap-2">
                                                        <Forward className="h-4 w-4 text-primary" />
                                                        Escalate to Team Inbox
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">When you can't be reached or the AI gets stuck, move conversations to the shared Team Inbox.</p>
                                                </div>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </div>
                                        )}
                                    />
                                )}
                            </div>
                        )}

                        {activeTab === 'workflow' && (
                            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Workflow</h2>
                                    <p className="text-muted-foreground text-sm">Configure how your agent greets and routes visitors.</p>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="welcomeMessage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Greeting Message</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Hi there! How can we help you today?" 
                                                    {...field} 
                                                    className="bg-[#161b22] border-white/10 min-h-[120px] text-base leading-relaxed"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs">Shown immediately when a conversation begins.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="aiEnabled"
                                    render={({ field }) => (
                                        <div className="rounded-2xl border border-white/10 bg-[#161b22] p-6 flex items-center justify-between shadow-sm">
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-white flex items-center gap-2">
                                                    AI Classification & Reasoning
                                                </h4>
                                                <p className="text-xs text-muted-foreground">Allow AI to identify visitor intent and answer questions automatically.</p>
                                            </div>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </div>
                                    )}
                                />

                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Automation Flow</Label>
                                    <div className="p-6 rounded-2xl border-2 border-dashed border-white/5 bg-[#0d1117] flex flex-col items-center gap-6">
                                        <div className="flex items-center gap-2 flex-wrap justify-center">
                                            <Badge variant="outline" className="bg-white/5 border-white/10 h-8 px-3 font-medium">Start</Badge>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-30" />
                                            <Badge variant="outline" className="bg-white/5 border-white/10 h-8 px-3 font-medium">Greeting</Badge>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-30" />
                                            <Badge variant="outline" className="bg-white/5 border-white/10 h-8 px-3 font-medium">AI Classifier</Badge>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-30" />
                                            <span className="text-xs text-muted-foreground italic">(Branching paths)</span>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsFlowBuilderOpen(true)} className="rounded-lg h-9 bg-white/5 hover:bg-white/10 border-white/10 text-xs font-bold gap-2">
                                            <Edit className="h-3.5 w-3.5" />
                                            Edit Flow
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Global Handoff Keywords</Label>
                                    <div className="rounded-2xl border border-white/10 bg-[#161b22] p-4 space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {watchedValues.handoffKeywords.map((kw) => (
                                                <Badge key={kw} variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-white/10 h-8 px-3 rounded-lg gap-2 text-xs">
                                                    {kw}
                                                    <button type="button" onClick={() => removeKeyword(kw)} className="text-muted-foreground hover:text-white">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <Input 
                                                value={newKeyword} 
                                                onChange={(e) => setNewKeyword(e.target.value)} 
                                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                                                placeholder="Add keyword..." 
                                                className="bg-[#0d1117] border-white/10 h-10"
                                            />
                                            <Button type="button" variant="secondary" size="sm" onClick={addKeyword} className="h-10 px-4">Add</Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">When visitors send these words, they’re immediately routed to {isPersonal ? 'the shared Team Inbox' : 'a human agent'}.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'channels' && (
                            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Channels</h2>
                                    <p className="text-muted-foreground text-sm">Configure how this agent handles intelligence across different platforms. <span className="font-bold text-primary">(Max {MAX_CHANNELS} active)</span></p>
                                </div>

                                {/* WEB CHAT - Hidden for Personal for now per directive */}
                                {!isPersonal && (
                                    <section className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                    <MessageSquare className="h-4 w-4" />
                                                </div>
                                                <h3 className="font-bold text-white">Web Chat</h3>
                                            </div>
                                        </div>
                                        <Card className="bg-[#161b22] border-white/10">
                                            <CardContent className="p-6 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-white">Standard Widget</p>
                                                    <p className="text-xs text-muted-foreground">The AI assistant will handle traffic from your embedded web widget.</p>
                                                </div>
                                                <Switch checked={watchedValues.channelConfig?.web?.enabled ?? true} onCheckedChange={(val) => handleToggleChannel('channelConfig.web.enabled', val)} />
                                            </CardContent>
                                        </Card>
                                    </section>
                                )}

                                {/* SMS */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                <Smartphone className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-bold text-white">SMS</h3>
                                        </div>
                                        <Switch checked={watchedValues.channelConfig?.sms?.enabled ?? false} onCheckedChange={(val) => handleToggleChannel('channelConfig.sms.enabled', val)} />
                                    </div>
                                    <div className="grid gap-3">
                                        {phoneNumbers.map(num => (
                                            <Card key={num.id} className="bg-[#161b22] border-white/10">
                                                <CardContent className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground">
                                                            <Smartphone className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{num.channelAddress}</p>
                                                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">{num.label || 'Support Line'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mr-2">AI Mode</p>
                                                        <Tabs 
                                                            defaultValue={watchedValues.channelConfig?.sms?.numberConfigs?.[num.id]?.aiMode || 'off'} 
                                                            onValueChange={(val) => form.setValue(`channelConfig.sms.numberConfigs.${num.id}.aiMode`, val as any)}
                                                            className="h-8"
                                                        >
                                                            <TabsList className="bg-black/20 h-8 p-0.5">
                                                                <TabsTrigger value="off" className="h-7 text-[10px] px-3">Off</TabsTrigger>
                                                                <TabsTrigger value="draft" className="h-7 text-[10px] px-3">Drafts</TabsTrigger>
                                                                <TabsTrigger value="auto" className="h-7 text-[10px] px-3">Auto</TabsTrigger>
                                                            </TabsList>
                                                        </Tabs>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {phoneNumbers.length === 0 && (
                                            <p className="text-xs text-center text-muted-foreground italic py-4">
                                                {isPersonal ? 'Direct SMS number assignment is managed by the hub admin.' : 'No phone numbers assigned to this Hub.'}
                                            </p>
                                        )}
                                    </div>
                                </section>

                                {/* EMAIL */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-bold text-white">Email</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isPersonal && (
                                                <Button type="button" variant="outline" size="sm" onClick={() => setIsConnectEmailOpen(true)} className="h-8 rounded-lg bg-white/5 border-white/10 text-[10px] font-bold uppercase">
                                                    <Plus className="h-3 w-3 mr-1" /> Connect My Email
                                                </Button>
                                            )}
                                            <Switch checked={watchedValues.channelConfig?.email?.enabled ?? false} onCheckedChange={(val) => handleToggleChannel('channelConfig.email.enabled', val)} />
                                        </div>
                                    </div>
                                    <div className="grid gap-3">
                                        {emailConfigs.map(config => (
                                            <Card key={config.id} className="bg-[#161b22] border-white/10 overflow-hidden">
                                                <CardContent className="p-0">
                                                    <div className="p-4 flex items-center justify-between border-b border-white/5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground">
                                                                <Mail className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{config.emailAddress}</p>
                                                                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">{config.label}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mr-2">AI Mode</p>
                                                            <Tabs 
                                                                defaultValue={watchedValues.channelConfig?.email?.emailConfigs?.[config.id]?.aiMode || 'off'} 
                                                                onValueChange={(val) => form.setValue(`channelConfig.email.emailConfigs.${config.id}.aiMode`, val as any)}
                                                                className="h-8"
                                                            >
                                                                <TabsList className="bg-black/20 h-8 p-0.5">
                                                                    <TabsTrigger value="off" className="h-7 text-[10px] px-3">Off</TabsTrigger>
                                                                    <TabsTrigger value="draft" className="h-7 text-[10px] px-3">Drafts</TabsTrigger>
                                                                    <TabsTrigger value="auto" className="h-7 text-[10px] px-3">Auto</TabsTrigger>
                                                                </TabsList>
                                                            </Tabs>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 bg-black/10">
                                                        <Label className="text-[9px] uppercase font-black text-muted-foreground mb-2 block">Address-Specific AI Greeting</Label>
                                                        <Textarea 
                                                            placeholder="e.g. Always mention our holiday return policy for this mailbox..."
                                                            value={watchedValues.channelConfig?.email?.emailConfigs?.[config.id]?.aiGreetingScript || ''}
                                                            onChange={(e) => form.setValue(`channelConfig.email.emailConfigs.${config.id}.aiGreetingScript`, e.target.value)}
                                                            className="bg-transparent border-white/5 text-xs min-h-[60px]"
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {emailConfigs.length === 0 && (
                                            <p className="text-xs text-center text-muted-foreground italic py-4">No email addresses connected.</p>
                                        )}
                                    </div>
                                </section>

                                {/* VOICE */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-bold text-white">Phone</h3>
                                        </div>
                                        <Switch checked={watchedValues.channelConfig?.voice?.enabled ?? false} onCheckedChange={(val) => handleToggleChannel('channelConfig.voice.enabled', val)} />
                                    </div>
                                    <div className="grid gap-4">
                                        {phoneNumbers.map(num => {
                                            const config = watchedValues.channelConfig?.voice?.numberConfigs?.[num.id] || {
                                                aiCallMode: 'agent_only',
                                                handoffRouteTo: 'any',
                                                handoffTimeoutSeconds: 30,
                                                handoffFallback: 'voicemail',
                                                aiGreeting: true,
                                                transcribe: true,
                                                afterHoursAiOnly: false,
                                                voicemailFallback: true,
                                                greetingScript: 'Hi! Thank you for calling. How can I help you today?'
                                            };

                                            const updateVoice = (patch: any) => {
                                                form.setValue(`channelConfig.voice.numberConfigs.${num.id}`, { ...config, ...patch });
                                            };

                                            return (
                                                <Card key={num.id} className="bg-[#161b22] border-white/10 overflow-hidden">
                                                    <CardHeader className="p-4 border-b border-white/5 bg-white/[0.02]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm font-bold text-white">{num.channelAddress}</p>
                                                                <Badge variant="secondary" className="h-4 px-1.5 text-[8px] uppercase tracking-tighter">{num.label || 'Support Line'}</Badge>
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 space-y-8">
                                                        {/* AI Mode Selector */}
                                                        <div className="space-y-3">
                                                            <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Call Handling Mode</Label>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <ModeCard 
                                                                    id={`v-agent-${num.id}`}
                                                                    title="Agent Only"
                                                                    desc="Direct routing."
                                                                    icon={UserIcon}
                                                                    active={config.aiCallMode === 'agent_only'}
                                                                    onClick={() => updateVoice({ aiCallMode: 'agent_only' })}
                                                                />
                                                                <ModeCard 
                                                                    id={`v-triage-${num.id}`}
                                                                    title="AI Triage"
                                                                    desc="Warm handoff."
                                                                    icon={Zap}
                                                                    active={config.aiCallMode === 'warm_handoff'}
                                                                    onClick={() => updateVoice({ aiCallMode: 'warm_handoff' })}
                                                                />
                                                                <ModeCard 
                                                                    id={`v-ai-${num.id}`}
                                                                    title="Full AI"
                                                                    desc="Full resolution."
                                                                    icon={BotIcon}
                                                                    active={config.aiCallMode === 'full_ai'}
                                                                    onClick={() => updateVoice({ aiCallMode: 'full_ai' })}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Warm Handoff Settings */}
                                                        {config.aiCallMode === 'warm_handoff' && (
                                                            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-6 animate-in slide-in-from-top-2 duration-300">
                                                                <div className="flex items-center gap-2 text-indigo-400">
                                                                    <Zap className="h-4 w-4" />
                                                                    <h4 className="text-xs font-black uppercase tracking-widest">Warm Handoff Config</h4>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Route to</Label>
                                                                        <Select value={config.handoffRouteTo} onValueChange={(val) => updateVoice({ handoffRouteTo: val })}>
                                                                            <SelectTrigger className="bg-black/20 border-white/10 h-10"><SelectValue /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="any">Any Available Agent</SelectItem>
                                                                                <SelectItem value="assigned">Account Owner</SelectItem>
                                                                                <SelectItem value="team">Customer Success Team</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center">
                                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Timeout</Label>
                                                                            <span className="text-[10px] font-mono text-indigo-400 font-bold">{config.handoffTimeoutSeconds}s</span>
                                                                        </div>
                                                                        <Slider 
                                                                            value={[config.handoffTimeoutSeconds]} 
                                                                            max={120} min={10} step={5}
                                                                            onValueChange={(val) => updateVoice({ handoffTimeoutSeconds: val[0] })}
                                                                            className="py-4"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Behavioral Toggles */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <ToggleOption 
                                                                icon={MessageSquare} 
                                                                label="AI Greeting" 
                                                                checked={config.aiGreeting} 
                                                                onChange={(val) => updateVoice({ aiGreeting: val })}
                                                            />
                                                            <ToggleOption 
                                                                icon={Mic} 
                                                                label="Transcribe Calls" 
                                                                checked={config.transcribe} 
                                                                onChange={(val) => updateVoice({ transcribe: val })}
                                                            />
                                                            <ToggleOption 
                                                                icon={Clock} 
                                                                label="After-Hours AI" 
                                                                checked={config.afterHoursAiOnly} 
                                                                onChange={(val) => updateVoice({ afterHoursAiOnly: val })}
                                                            />
                                                            <ToggleOption 
                                                                icon={ShieldAlert} 
                                                                label="Voicemail Logic" 
                                                                checked={config.voicemailFallback} 
                                                                onChange={(val) => updateVoice({ voicemailFallback: val })}
                                                            />
                                                        </div>

                                                        {/* Script */}
                                                        <div className="space-y-3">
                                                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Greeting Script</Label>
                                                            <Textarea 
                                                                value={config.greetingScript}
                                                                onChange={(e) => updateVoice({ greetingScript: e.target.value })}
                                                                placeholder="Enter the script the AI should read..."
                                                                className="bg-black/20 border-white/10 min-h-[80px] text-xs leading-relaxed"
                                                            />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                        {phoneNumbers.length === 0 && (
                                            <p className="text-xs text-center text-muted-foreground italic py-4">
                                                {isPersonal ? 'Direct phone number assignment is managed by the hub admin.' : 'No phone numbers assigned to this Hub.'}
                                            </p>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'branding' && (
                            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Branding</h2>
                                    <p className="text-muted-foreground text-sm">Customize your agent's look and feel.</p>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="logoUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Bot Avatar</FormLabel>
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-16 w-16 border border-white/10 bg-white/5 rounded-2xl">
                                                    <AvatarImage src={field.value} className="object-contain" />
                                                    <AvatarFallback className="bg-transparent"><BotIcon className="h-8 w-8 opacity-20" /></AvatarFallback>
                                                </Avatar>
                                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => field.onChange(reader.result as string);
                                                        reader.readAsDataURL(e.target.files[0]);
                                                    }
                                                }} />
                                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="border-white/10 bg-white/5">Upload Image</Button>
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Theme Colors</Label>
                                        <div className="space-y-4">
                                            <ColorField name="primaryColor" label="Primary Action" form={form} />
                                            <ColorField name="backgroundColor" label="Window Background" form={form} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Header</Label>
                                        <div className="space-y-4">
                                            <ColorField name="headerTextColor" label="Header Text" form={form} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Messages</Label>
                                        <div className="space-y-4">
                                            <ColorField name="agentMessageBackgroundColor" label="Agent Bubble" form={form} />
                                            <ColorField name="agentMessageTextColor" label="Agent Text" form={form} />
                                            <ColorField name="customerTextColor" label="Visitor Text" form={form} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Interface</Label>
                                        <div className="space-y-4">
                                            <ColorField name="chatbotIconsColor" label="Launcher Background" form={form} />
                                            <ColorField name="chatbotIconsTextColor" label="Launcher Icon" form={form} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'knowledge' && (
                            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Knowledge</h2>
                                    <p className="text-muted-foreground text-sm">Select libraries this agent uses to find answers.</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="allowedHelpCenterIds"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Sources</FormLabel>
                                            <div className="space-y-4">
                                                {helpCenters && helpCenters.length > 0 ? helpCenters.map(hc => (
                                                    <div key={hc.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                                <BookOpen className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <span className="font-semibold text-white">{hc.name}</span>
                                                        </div>
                                                        <Switch 
                                                            checked={field.value?.includes(hc.id)} 
                                                            onCheckedChange={(checked) => {
                                                                const newVal = checked 
                                                                    ? [...(field.value || []), hc.id]
                                                                    : (field.value || []).filter(id => id !== hc.id);
                                                                field.onChange(newVal);
                                                            }}
                                                        />
                                                    </div>
                                                )) : (
                                                    <div className="p-12 border-2 border-dashed border-white/5 rounded-2xl text-center">
                                                        <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                                                        <p className="text-sm font-semibold text-white">No libraries available</p>
                                                        <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">Create a library in the Knowledge tab to use it as a source for your AI agent.</p>
                                                    </div>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {activeTab === 'installation' && (
                            <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Install</h2>
                                    <p className="text-muted-foreground text-sm">Add the chatbot to your website with a single line of code.</p>
                                </div>
                                
                                <div className="rounded-2xl border border-white/10 bg-[#161b22] p-6 space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Globe className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-white">Standard Embed Script</h4>
                                            <p className="text-xs text-muted-foreground">Copy and paste this script into your HTML's `head` or `body` tag.</p>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-xs font-mono text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{basicSnippet}</code>
                                        </pre>
                                        <Button 
                                            type="button" 
                                            size="icon" 
                                            variant="secondary" 
                                            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                                            onClick={() => handleCopy(basicSnippet)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-[#161b22] p-6 space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-white">Identity-Aware Script</h4>
                                            <p className="text-xs text-muted-foreground">Use this version if your website already has authenticated users to track them across sessions.</p>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-xs font-mono text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                                            <code>{userAwareSnippet}</code>
                                        </pre>
                                        <Button 
                                            type="button" 
                                            size="icon" 
                                            variant="secondary" 
                                            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                                            onClick={() => handleCopy(userAwareSnippet)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-white/10 bg-[#090c10] shrink-0 flex justify-between items-center gap-3">
                    <div className="flex-1">
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                            className="h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                            style={{ 
                                backgroundColor: watchedValues.chatbotIconsColor || '#3b82f6',
                                color: watchedValues.chatbotIconsTextColor || '#ffffff'
                            }}
                            title="Preview Chatbot"
                        >
                            <MessageCircle className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">Cancel</Button>
                        <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-primary/20">Save Changes</Button>
                    </div>
                </div>

                <ChatbotSimulator 
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    botData={watchedValues}
                    flow={watchedValues.flow || { nodes: [], edges: [] }}
                    agents={isPersonal && appUser ? [appUser] : allUsers.filter(u => watchedValues.agentIds?.includes(u.id))}
                />
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AutomationFlowBuilder 
        isOpen={isFlowBuilderOpen}
        onOpenChange={setIsFlowBuilderOpen}
        flow={watchedValues.flow || { nodes: [], edges: [] }}
        onSave={(newFlow) => form.setValue('flow', newFlow)}
        aiEnabled={watchedValues.aiEnabled}
        botData={watchedValues}
        allUsers={isPersonal && appUser ? [appUser] : allUsers}
    />

    {isPersonal && appUser && (
        <ConnectEmailDialog
            isOpen={isConnectEmailOpen}
            onOpenChange={setIsConnectEmailOpen}
            userId={appUser.id}
            hubId="agent"
            spaceId={agent?.spaceId || 'default'}
        />
    )}
    </>
  );
}

function ColorField({ name, label, form }: { name: string, label: string, form: any }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-bold text-muted-foreground/70">{label}</FormLabel>
                    <div className="flex items-center gap-2">
                        <Input {...field} className="bg-muted/20 border-white/10 h-9 font-mono text-[10px] uppercase" />
                        <div className="relative h-9 w-9 shrink-0 rounded-md border border-white/10 overflow-hidden">
                            <input 
                                type="color" 
                                value={field.value} 
                                onChange={field.onChange} 
                                className="absolute inset-[-5px] h-[calc(100%+10px)] w-[calc(100%+10px)] cursor-pointer" 
                            />
                        </div>
                    </div>
                </FormItem>
            )}
        />
    );
}

function ModeCard({ id, title, desc, icon: Icon, active, onClick }: { id: string, title: string, desc: string, icon: any, active: boolean, onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left",
                active ? "bg-primary/10 border-primary ring-4 ring-primary/5 shadow-md" : "bg-[#0d1117] border-white/5 hover:border-white/10"
            )}
        >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", active ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground")}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className={cn("font-bold text-xs", active ? "text-primary" : "text-white")}>{title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
            </div>
        </button>
    );
}

function ToggleOption({ icon: Icon, label, checked, onChange }: { icon: any, label: string, checked: boolean, onChange: (val: boolean) => void }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-white">{label}</span>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}
