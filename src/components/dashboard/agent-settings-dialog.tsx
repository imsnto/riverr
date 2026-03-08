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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
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
  Eye
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  agentIds: z.array(z.string()).min(1, 'Please select at least one agent.'),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  handoffKeywords: z.array(z.string()).default([]),
  flow: z.any().optional(),
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
  allUsers,
  helpCenters,
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('workflow');
  const [isFlowBuilderOpen, setIsFlowBuilderOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      allowedHelpCenterIds: [],
      handoffKeywords: ['agent', 'human', 'help', 'speak to person'],
      flow: { nodes: [], edges: [] },
    },
  });
  
  const watchedValues = form.watch();

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
        allowedHelpCenterIds: agent.allowedHelpCenterIds || [],
        handoffKeywords: agent.automations?.handoffKeywords || ['agent', 'human', 'help', 'speak to person'],
        flow: agent.flow || { nodes: [], edges: [] },
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
        agentIds: values.agentIds,
        allowedHelpCenterIds: values.allowedHelpCenterIds || [],
        identityCapture: { enabled: false, required: false }, // Handled in flow
        automations: {
            handoffKeywords: values.handoffKeywords,
            quickReplies: [],
        },
        flow: values.flow,
        escalationTriggers: {
            billingKeywords: ['refund', 'charge', 'invoice'],
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

  const basicSnippet = agent ? `<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${agent.id}" data-hub-id="${agent.hubId}" async></script>`.trim() : '';

  const navItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'workflow', label: 'Workflow', icon: Zap },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'installation', label: 'Install', icon: Plug },
  ];

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full overflow-hidden">
            {/* Sidebar Navigation */}
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
                                    AI Agent Configuration
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <nav className="flex-1 p-2 space-y-1">
                    {navItems.map((item) => (
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

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Global Preview Button */}
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    <Button 
                        type="button" 
                        variant={isPreviewOpen ? "secondary" : "outline"} 
                        size="sm" 
                        onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                        className="rounded-full bg-white/5 border-white/10 h-9 px-4 text-xs font-bold gap-2"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        {isPreviewOpen ? "Hide Preview" : "Preview Agent"}
                    </Button>
                </div>

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
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Internal Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Support Agent" {...field} className="bg-muted/20 border-white/10 h-11" />
                                            </FormControl>
                                            <FormDescription className="text-xs">Only visible to your team.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                            <FormDescription className="text-xs">Shown immediately when a visitor opens the chat.</FormDescription>
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
                                        <p className="text-[10px] text-muted-foreground italic">When visitors send these words, they’re immediately routed to a human agent.</p>
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

                        {activeTab === 'installation' && (
                            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                            <h4 className="font-bold text-white">Embed Script</h4>
                                            <p className="text-xs text-muted-foreground">Copy and paste this script into your HTML's `head` or `body` tag.</p>
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-xs font-mono text-primary leading-relaxed overflow-x-auto">
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
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-white/10 bg-[#090c10] shrink-0 flex justify-end items-center gap-3">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">Cancel</Button>
                    <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-primary/20">Save Changes</Button>
                </div>

                <ChatbotSimulator 
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    botData={watchedValues}
                    flow={watchedValues.flow || { nodes: [], edges: [] }}
                    agents={allUsers.filter(u => watchedValues.agentIds?.includes(u.id))}
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
        allUsers={allUsers}
    />
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
