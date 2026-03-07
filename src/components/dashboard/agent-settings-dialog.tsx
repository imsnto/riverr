// src/components/dashboard/agent-settings-dialog.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button, buttonVariants } from '@/components/ui/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ChevronDown, 
  Copy, 
  Terminal, 
  ShieldCheck, 
  Smartphone, 
  Info, 
  Globe, 
  Code,
  Wand2,
  Zap,
  Split,
  ChevronRight,
  Edit,
  MoreHorizontal,
  Trash2,
  Palette,
  Layout
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AutomationFlowBuilder from './automation-flow-builder';
import { Separator } from '../ui/separator';

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
              className="w-full justify-between h-auto min-h-10 text-left"
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

function MultiSelectPopover({ title, options, selected, onChange }: { title: string, options: { value: string, label: string }[], selected: string[], onChange: (selected: string[]) => void }) {
    const [open, setOpen] = useState(false);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value];
        onChange(newSelected);
    }
    
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto text-left">
                    <div className="flex flex-wrap gap-1">
                        {selected.length > 0 ? selected.map(value => {
                            const option = options.find(o => o.value === value);
                            return <Badge variant="secondary" key={value}>{option?.label || 'Unknown'}</Badge>;
                        }) : `Select ${title}...`}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
  identityCaptureEnabled: z.boolean().default(true),
  identityCaptureRequired: z.boolean().default(false),
  identityCaptureMessage: z.string().optional(),
  handoffKeywords: z.string().optional(),
  quickReplies: z.string().optional(),
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
  const [isFlowBuilderOpen, setIsFlowBuilderOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: '',
      isEnabled: true,
      aiEnabled: true,
      welcomeMessage: 'Hi there',
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      headerTextColor: '#ffffff',
      agentMessageBackgroundColor: '#374151',
      agentMessageTextColor: '#ffffff',
      customerTextColor: '#ffffff',
      chatbotIconsColor: '#ffffff',
      chatbotIconsTextColor: '#000000',
      logoUrl: '',
      agentIds: [],
      allowedHelpCenterIds: [],
      identityCaptureEnabled: true,
      identityCaptureRequired: false,
      identityCaptureMessage: 'Before we start, could I get your name and email?',
      handoffKeywords: 'agent, human, help, speak to person',
      quickReplies: '',
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
        welcomeMessage: agent.welcomeMessage || 'Hi there',
        primaryColor: agent.styleSettings?.primaryColor || '#3b82f6',
        backgroundColor: agent.styleSettings?.backgroundColor || '#111827',
        headerTextColor: agent.styleSettings?.headerTextColor || '#ffffff',
        agentMessageBackgroundColor: agent.styleSettings?.agentMessageBackgroundColor || '#374151',
        agentMessageTextColor: agent.styleSettings?.agentMessageTextColor || '#ffffff',
        customerTextColor: agent.styleSettings?.customerTextColor || '#ffffff',
        chatbotIconsColor: agent.styleSettings?.chatbotIconsColor || '#ffffff',
        chatbotIconsTextColor: agent.styleSettings?.chatbotIconsTextColor || '#000000',
        logoUrl: agent.styleSettings?.logoUrl || '',
        agentIds: agent.agentIds || [],
        allowedHelpCenterIds: agent.allowedHelpCenterIds || [],
        identityCaptureEnabled: agent.identityCapture?.enabled ?? true,
        identityCaptureRequired: agent.identityCapture?.required ?? false,
        identityCaptureMessage: agent.identityCapture?.captureMessage || 'Before we start, could I get your name and email?',
        handoffKeywords: agent.automations?.handoffKeywords?.join(', ') || 'agent, human, help, speak to person',
        quickReplies: agent.automations?.quickReplies?.join(', ') || '',
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
        automations: {
            handoffKeywords: values.handoffKeywords?.split(',').map(k => k.trim()).filter(Boolean) || [],
            quickReplies: values.quickReplies?.split(',').map(k => k.trim()).filter(Boolean) || [],
        },
        flow: values.flow,
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
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const basicSnippet = agent ? `<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${agent.id}" data-hub-id="${agent.hubId}" async></script>`.trim() : '';

  const identifiedSnippet = agent ? `<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${agent.id}" data-hub-id="${agent.hubId}" data-provider-id="YOUR_PROVIDER_ID" async></script>`.trim() : '';

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
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
                      name="isEnabled"
                      render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                  <FormLabel>Agent Enabled</FormLabel>
                                  <FormDescription>If disabled, this agent will not respond.</FormDescription>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                      )}
                  />
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
                  
                  <Tabs defaultValue="workflow" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="workflow">Workflow</TabsTrigger>
                      <TabsTrigger value="identity">Identity</TabsTrigger>
                      <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
                      <TabsTrigger value="branding">Branding</TabsTrigger>
                      <TabsTrigger value="installation">Install</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="workflow" className="pt-6 space-y-6">
                       <FormField
                          control={form.control}
                          name="welcomeMessage"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Greeting Message</FormLabel>
                              <FormControl>
                                  <Textarea placeholder="Hi there! How can we help you today?" {...field} />
                              </FormControl>
                              <FormDescription>This message is shown as soon as a visitor opens the chat.</FormDescription>
                              <FormMessage />
                              </FormItem>
                          )}
                      />

                      <FormField
                          control={form.control}
                          name="aiEnabled"
                          render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-indigo-500/5 border-indigo-500/20">
                                  <div className="space-y-0.5">
                                      <FormLabel className="flex items-center gap-2">
                                          <BotIcon className="h-4 w-4 text-indigo-400" />
                                          AI Classification & Reasoning
                                      </FormLabel>
                                      <FormDescription className="text-xs">Allow AI to identify intent and answer questions automatically.</FormDescription>
                                  </div>
                                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                          )}
                      />

                      <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                              <Label className="font-bold flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-amber-400" /> 
                                  Automation Map
                              </Label>
                              <Button type="button" variant="outline" size="sm" onClick={() => setIsFlowBuilderOpen(true)}>
                                  <Edit className="h-3 w-3 mr-2" />
                                  Edit Flow
                              </Button>
                          </div>
                          
                          <Card className="bg-muted/30 border-dashed">
                              <CardContent className="p-6 text-center text-xs text-muted-foreground">
                                  <p className="mb-3 font-semibold text-foreground uppercase tracking-wider">Visual Flow Summary</p>
                                  <div className="flex items-center justify-center gap-2 italic">
                                      Start <ChevronRight className="h-3 w-3" /> 
                                      Greeting <ChevronRight className="h-3 w-3" /> 
                                      AI Classifier <ChevronRight className="h-3 w-3" /> 
                                      (Branching paths)
                                  </div>
                                  <p className="mt-4 opacity-70">
                                      Configure complex branching, lead capture, and escalation rules in the visual builder.
                                  </p>
                              </CardContent>
                          </Card>
                          
                          <FormField
                              control={form.control}
                              name="handoffKeywords"
                              render={({ field }) => (
                                  <FormItem>
                                  <FormLabel>Global Handoff Keywords</FormLabel>
                                  <FormControl>
                                      <Input placeholder="agent, help, human, speak to person" {...field} />
                                  </FormControl>
                                  <FormDescription className="text-xs">Keywords that immediately request a human, bypassing automation.</FormDescription>
                                  <FormMessage />
                                  </FormItem>
                              )}
                          />
                      </div>
                    </TabsContent>

                    <TabsContent value="identity" className="pt-6 space-y-6">
                       <FormField
                          control={form.control}
                          name="identityCaptureEnabled"
                          render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                      <FormLabel>Lead Capture Automation</FormLabel>
                                      <FormDescription>Ask for name and email from unknown visitors.</FormDescription>
                                  </div>
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
                                      <FormLabel>Capture Prompt</FormLabel>
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
                                          <FormLabel className="text-sm">Require email before starting conversation</FormLabel>
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
                              <p className="text-sm text-muted-foreground mb-4">Select which libraries this agent can use to answer questions.</p>
                              <MultiSelectPopover 
                                  title="Libraries"
                                  options={helpCenters.map(hc => ({ value: hc.id, label: hc.name }))}
                                  selected={field.value || []}
                                  onChange={field.onChange}
                              />
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                    </TabsContent>

                    <TabsContent value="branding" className="pt-6 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Branding Options */}
                        <div className="space-y-6">
                          <FormField
                              control={form.control}
                              name="logoUrl"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="flex items-center gap-2">
                                          <Layout className="h-4 w-4" /> Logo
                                      </FormLabel>
                                      <FormControl>
                                          <div className="flex items-center gap-4">
                                              <Avatar className="h-16 w-16 rounded-md">
                                                  <AvatarImage src={field.value || undefined} alt="Logo preview" className="object-contain" />
                                                  <AvatarFallback className="rounded-md bg-muted">
                                                      <BotIcon className="h-8 w-8 text-muted-foreground" />
                                                  </AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col gap-2">
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
                                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Upload
                                                </Button>
                                                {field.value && (
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange('')}>
                                                        Remove
                                                    </Button>
                                                )}
                                              </div>
                                          </div>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />

                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Colors</Label>
                            
                            <div className="grid grid-cols-1 gap-4">
                              <FormField
                                control={form.control}
                                name="primaryColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Primary Brand Color</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#3b82f6" {...field} className="h-8 text-xs font-mono" />
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                            <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                            <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                    </div>
                                    </FormControl>
                                </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="backgroundColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Widget Background</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#111827" {...field} className="h-8 text-xs font-mono" />
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                            <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                            <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                    </div>
                                    </FormControl>
                                </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="headerTextColor"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Header Text Color</FormLabel>
                                    <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input placeholder="#ffffff" {...field} className="h-8 text-xs font-mono" />
                                        <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                            <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                            <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        </div>
                                    </div>
                                    </FormControl>
                                </FormItem>
                                )}
                              />

                              <div className="pt-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bubbles</Label>
                                <div className="grid grid-cols-1 gap-4 mt-4">
                                  <FormField
                                    control={form.control}
                                    name="agentMessageBackgroundColor"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Bot Bubble BG</FormLabel>
                                        <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input placeholder="#374151" {...field} className="h-8 text-xs font-mono" />
                                            <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                                <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                                <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="agentMessageTextColor"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Bot Bubble Text</FormLabel>
                                        <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input placeholder="#ffffff" {...field} className="h-8 text-xs font-mono" />
                                            <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                                <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                                <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="customerTextColor"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Visitor Bubble Text</FormLabel>
                                        <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input placeholder="#ffffff" {...field} className="h-8 text-xs font-mono" />
                                            <div className="relative h-8 w-8 rounded-md border overflow-hidden cursor-pointer shadow-inner">
                                                <div className="w-full h-full" style={{ backgroundColor: field.value }} />
                                                <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            </div>
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Live Branding Preview */}
                        <div className="space-y-4 sticky top-0">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Palette className="h-3 w-3" /> Live Branding Preview
                          </Label>
                          
                          <div 
                            className="w-full h-[540px] rounded-3xl shadow-2xl border-8 border-muted overflow-hidden flex flex-col transition-all duration-500"
                            style={{ backgroundColor: watchedValues.backgroundColor }}
                          >
                            {/* Mock Header */}
                            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 rounded-full shadow-md bg-white/10">
                                  <AvatarImage src={watchedValues.logoUrl} className="object-contain" />
                                  <AvatarFallback className="bg-transparent"><BotIcon className="h-4 w-4 text-white/50" /></AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-sm" style={{ color: watchedValues.headerTextColor }}>{watchedValues.name || 'AI Assistant'}</span>
                              </div>
                              <X className="h-4 w-4 opacity-50" style={{ color: watchedValues.headerTextColor }} />
                            </div>

                            {/* Mock Chat Area */}
                            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                              {/* Bot Welcome */}
                              <div className="flex flex-col gap-1.5 items-start">
                                <div 
                                  className="max-w-[85%] p-3 rounded-2xl rounded-bl-none text-sm shadow-sm"
                                  style={{ 
                                    backgroundColor: watchedValues.agentMessageBackgroundColor,
                                    color: watchedValues.agentMessageTextColor 
                                  }}
                                >
                                  {watchedValues.welcomeMessage || 'Hi there! How can I help you?'}
                                </div>
                                <span className="text-[10px] uppercase font-bold opacity-40 ml-1" style={{ color: watchedValues.agentMessageTextColor }}>Bot</span>
                              </div>

                              {/* User Message */}
                              <div className="flex flex-col gap-1.5 items-end">
                                <div 
                                  className="max-w-[85%] p-3 rounded-2xl rounded-br-none text-sm shadow-md"
                                  style={{ 
                                    backgroundColor: watchedValues.primaryColor,
                                    color: watchedValues.customerTextColor 
                                  }}
                                >
                                  I have a question about pricing.
                                </div>
                                <span className="text-[10px] uppercase font-bold opacity-40 mr-1" style={{ color: watchedValues.customerTextColor || '#fff' }}>Visitor</span>
                              </div>

                              {/* AI Response */}
                              <div className="flex flex-col gap-1.5 items-start">
                                <div 
                                  className="max-w-[85%] p-3 rounded-2xl rounded-bl-none text-sm border-2 shadow-sm"
                                  style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    borderColor: watchedValues.primaryColor + '33',
                                    color: watchedValues.agentMessageTextColor 
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <BotIcon className="h-3 w-3" style={{ color: watchedValues.primaryColor }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: watchedValues.primaryColor }}>AI Knowledge</span>
                                  </div>
                                  I can certainly help with that! We have several plans available...
                                </div>
                              </div>
                            </div>

                            {/* Mock Footer */}
                            <div className="p-4 border-t flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                              <div className="h-10 flex-1 rounded-full bg-white/5 border border-white/10 flex items-center px-4">
                                <span className="text-xs text-white/30 italic">Type a message...</span>
                              </div>
                              <div className="h-10 w-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: watchedValues.primaryColor }}>
                                <Send className="h-4 w-4" style={{ color: watchedValues.customerTextColor }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="installation" className="pt-6">
                      {agent ? (
                          <Tabs defaultValue="basic" className="w-full">
                              <TabsList className="grid w-full grid-cols-2 mb-6">
                                  <TabsTrigger value="basic">Basic Install</TabsTrigger>
                                  <TabsTrigger value="identify">Identify Users</TabsTrigger>
                              </TabsList>
                              
                              <ScrollArea className="h-[400px] pr-4">
                                  <TabsContent value="basic" className="mt-0 space-y-6">
                                      <div>
                                          <h4 className="font-bold flex items-center gap-2 mb-2"><Globe className="h-4 w-4"/> Web Install</h4>
                                          <p className="text-xs text-muted-foreground mb-4">
                                              Best for simple websites. Copy this script into your HTML `head` or `body`.
                                          </p>
                                          <div className="relative">
                                              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto font-mono text-foreground border">
                                                  <code>{basicSnippet}</code>
                                              </pre>
                                              <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleCopy(basicSnippet)}>
                                                  <Copy className="h-4 w-4" />
                                              </Button>
                                          </div>
                                      </div>
                                  </TabsContent>

                                  <TabsContent value="identify" className="mt-0 space-y-8 pb-10">
                                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex items-start gap-3">
                                          <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                                          <div className="space-y-1">
                                              <p className="text-sm font-bold text-indigo-300">Secure Identity Linking</p>
                                              <p className="text-xs text-indigo-300/70">
                                                  Link chat sessions to your app's logged-in users using a secure HMAC hash.
                                              </p>
                                          </div>
                                      </div>

                                      <div className="space-y-4">
                                          <h5 className="text-sm font-bold flex items-center gap-2"><Terminal className="h-4 w-4"/> identified script</h5>
                                          <div className="relative">
                                              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto font-mono text-foreground border">
                                                  <code>{identifiedSnippet}</code>
                                              </pre>
                                              <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleCopy(identifiedSnippet)}>
                                                  <Copy className="h-4 w-4" />
                                              </Button>
                                          </div>
                                      </div>
                                  </TabsContent>
                              </ScrollArea>
                          </Tabs>
                      ) : (
                          <div className="text-center py-12 border-2 border-dashed rounded-lg">
                              <Smartphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-semibold text-foreground">Save Agent to Install</h3>
                              <p className="text-sm text-muted-foreground px-10">
                                  Once you save this agent, you will get the installation code snippets.
                              </p>
                          </div>
                      )}
                    </TabsContent>

                  </Tabs>
                </div>
              </div>

              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" form="agent-settings-form">Save Changes</Button>
              </DialogFooter>
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
    />
    </>
  );
}
