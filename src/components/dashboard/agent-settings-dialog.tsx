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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
import { 
  Bot as BotIcon, 
  X, 
  Check, 
  ChevronsUpDown, 
  Loader2, 
  MessageSquare, 
  Copy, 
  Globe, 
  Smartphone, 
  Phone, 
  Mail, 
  Settings, 
  Palette, 
  Plug, 
  BookOpen, 
  Zap, 
  UserCheck, 
  Clock, 
  Mic, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowRight, 
  Info,
  Trash2,
  Target
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const agentSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  isEnabled: z.boolean().default(true),
  aiEnabled: z.boolean().default(true),
  welcomeMessage: z.string().optional(),
  noAgentFallbackMessage: z.string().optional(),
  assignedAgentId: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  logoUrl: z.string().optional(),
  chatbotIconsColor: z.string().optional(),
  chatbotIconsTextColor: z.string().optional(),
  agentIds: z.array(z.string()).optional(),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  channelConfig: z.any().optional(),
  workflowConfig: z.any().optional(),
});

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>;

interface AgentSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (data: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  allUsers: User[];
  helpCenters: HelpCenter[];
  mode: 'agent' | 'widget';
  hubWidgets?: BotData[];
}

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  appUser,
  allUsers,
  helpCenters,
  mode,
  hubWidgets = [],
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [activeConfigPath, setActiveConfigPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isPersonalAgent = bot?.ownerType === 'user';

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: '',
      isEnabled: true,
      aiEnabled: true,
      welcomeMessage: 'Hi there! How can we help you today?',
      noAgentFallbackMessage: 'Our team will be with you shortly.',
      assignedAgentId: null,
      primaryColor: '#3b82f6',
      backgroundColor: '#111827',
      logoUrl: '',
      chatbotIconsColor: '#3b82f6',
      chatbotIconsTextColor: '#ffffff',
      agentIds: [],
      allowedHelpCenterIds: [],
      channelConfig: {
        web: { enabled: mode === 'widget' },
        sms: { enabled: false },
        email: { enabled: false },
        voice: { enabled: false }
      },
      workflowConfig: {
        web: {
          webAgentName: 'AI Assistant',
          handoffKeywords: ['agent', 'human', 'person'],
          conversationGoal: 'Resolve the customer\'s issue efficiently and collect contact details.',
          identityCapture: { timing: 'after', fields: { name: true, email: true, phone: false } },
          afterHoursBehavior: 'ai_full'
        },
        supportEmail: { 
          tone: 'professional', 
          signOff: 'Best regards, The Support Team', 
          alwaysAddress: '', 
          escalationTriggers: [],
          escalateOnSentiment: true 
        },
        sms: { 
          responseStyle: 'concise', 
          openingMessage: "Hi! You've reached support. How can I help?", 
          afterHoursBehavior: 'ai_full', 
          handoffKeywords: ['agent', 'human'], 
          sentimentEscalation: true 
        },
        voice: { 
          greetingScript: 'Hi! Thank you for calling. How can I help?', 
          callHandlingMode: 'full_ai', 
          handoffTarget: 'any', 
          handoffTimeoutSeconds: 60, 
          handoffFallback: 'voicemail', 
          voicemailEnabled: true, 
          transcriptionEnabled: true, 
          afterHoursBehavior: 'ai_full',
          aiGreetingEnabled: true
        }
      }
    },
  });

  useEffect(() => {
    if (bot) {
      form.reset({
        name: bot.name,
        isEnabled: bot.isEnabled ?? true,
        aiEnabled: bot.aiEnabled ?? true,
        welcomeMessage: bot.welcomeMessage || 'Hi! How can I help?',
        noAgentFallbackMessage: bot.noAgentFallbackMessage || 'Our team will be with you shortly.',
        assignedAgentId: bot.assignedAgentId || null,
        primaryColor: bot.styleSettings?.primaryColor || '#3b82f6',
        backgroundColor: bot.styleSettings?.backgroundColor || '#111827',
        logoUrl: bot.styleSettings?.logoUrl || '',
        chatbotIconsColor: bot.styleSettings?.chatbotIconsColor || '#3b82f6',
        chatbotIconsTextColor: bot.styleSettings?.chatbotIconsTextColor || '#ffffff',
        agentIds: bot.agentIds || [],
        allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
        channelConfig: bot.channelConfig || {},
        workflowConfig: bot.workflowConfig || {}
      });
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const widgetsUsingThisAgent = useMemo(() => {
    if (mode !== 'agent' || !bot) return [];
    return hubWidgets.filter(w => w.assignedAgentId === bot.id);
  }, [mode, bot, hubWidgets]);

  const navItems = useMemo(() => {
    if (mode === 'widget') {
      return [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'installation', label: 'Install', icon: Plug },
      ];
    } else {
      return [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'channels', label: 'Channels', icon: Globe },
        { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
      ];
    }
  }, [mode]);

  const onSubmit = (values: AgentSettingsFormValues) => {
    const commonData = {
        ...values,
        styleSettings: mode === 'widget' ? {
            primaryColor: values.primaryColor,
            backgroundColor: values.backgroundColor,
            logoUrl: values.logoUrl,
            chatbotIconsColor: values.chatbotIconsColor,
            chatbotIconsTextColor: values.chatbotIconsTextColor,
        } : bot?.styleSettings
    };
    onSave(commonData as any);
    onOpenChange(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const renderChannelConfig = (channelId: string) => {
    switch (channelId) {
      case 'web':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Widget installation and appearance is managed in <Link href={`/space/${bot?.spaceId}/hub/${bot?.hubId}/settings?view=web-chat`} className="text-primary font-bold hover:underline">Web Chat settings</Link>.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="workflowConfig.web.webAgentName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Agent Name</FormLabel>
                            <FormControl><Input placeholder="e.g. Finn" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                            <FormDescription className="text-[10px]">What the AI calls itself during chat.</FormDescription>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workflowConfig.web.welcomeMessage"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Greeting Message</FormLabel>
                            <FormControl><Input placeholder="Hi! How can I help?" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Conversation Goal</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.web.conversationGoal"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea 
                                    placeholder="Resolve the customer's issue in as few messages as possible and always collect their contact details before the conversation ends." 
                                    {...field} 
                                    className="bg-muted/20 border-white/10 min-h-[100px] text-sm italic"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Handoff Keywords</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.web.handoffKeywords"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input 
                                    placeholder="Comma separated: agent, human, representative" 
                                    value={Array.isArray(field.value) ? field.value.join(', ') : field.value} 
                                    onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                                    className="bg-muted/20 border-white/10"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <Separator className="bg-white/5" />

            <div className="space-y-6">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Identity Capture</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="workflowConfig.web.identityCapture.timing"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-xs text-muted-foreground">Timing</FormLabel>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="before" id="before" /><Label htmlFor="before" className="text-xs">Before first response</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="after" id="after" /><Label htmlFor="after" className="text-xs">After first response</Label></div>
                                </RadioGroup>
                            </FormItem>
                        )}
                    />
                    <div className="space-y-3">
                        <FormLabel className="text-xs text-muted-foreground">Fields</FormLabel>
                        <div className="flex flex-col gap-2">
                            {['name', 'email', 'phone'].map(f => (
                                <FormField
                                    key={f}
                                    control={form.control}
                                    name={`workflowConfig.web.identityCapture.fields.${f}`}
                                    render={({ field }) => (
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id={`f-${f}`} checked={field.value} onCheckedChange={field.onChange} />
                                            <Label htmlFor={`f-${f}`} className="text-xs capitalize">{f}</Label>
                                        </div>
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">After Hours Behavior</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.web.afterHoursBehavior"
                    render={({ field }) => (
                        <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-muted/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="ai_full">AI handles everything</SelectItem>
                                    <SelectItem value="take_message">AI takes a message</SelectItem>
                                    <SelectItem value="disabled">Widget disabled</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
            </div>

            <div className="pt-6 border-t border-white/5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Active on Widgets</Label>
                <div className="mt-4 space-y-2">
                    {widgetsUsingThisAgent.length > 0 ? widgetsUsingThisAgent.map(w => (
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                <span className="text-sm font-medium text-white">{w.name}</span>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] uppercase font-bold text-primary hover:text-primary hover:bg-primary/10">
                                <Link href={`/space/${bot?.spaceId}/hub/${bot?.hubId}/settings?view=web-chat`}>
                                    Go to Widget <ArrowRight className="ml-1.5 h-3 w-3" />
                                </Link>
                            </Button>
                        </div>
                    )) : (
                        <div className="p-6 border border-dashed border-white/10 rounded-xl text-center">
                            <p className="text-xs text-muted-foreground">No widgets are currently using this agent.</p>
                            <Link href={`/space/${bot?.spaceId}/hub/${bot?.hubId}/settings?view=web-chat`} className="text-[10px] uppercase font-black text-primary hover:underline mt-2 inline-block">Assign from Web Chat Settings →</Link>
                        </div>
                    )}
                </div>
            </div>
          </div>
        );
      case 'sms':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <FormField
                control={form.control}
                name="workflowConfig.sms.openingMessage"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Opening Message</FormLabel>
                        <FormControl><Input placeholder="Hi! You've reached support. How can I help?" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                        <FormDescription className="text-[10px]">Fires on the first inbound from a new contact.</FormDescription>
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="workflowConfig.sms.responseStyle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Response Style</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="bg-muted/20 border-white/10"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="concise">Concise</SelectItem>
                                    <SelectItem value="conversational">Conversational</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workflowConfig.sms.afterHoursBehavior"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">After Hours</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="bg-muted/20 border-white/10"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="ai_full">AI handles everything</SelectItem>
                                    <SelectItem value="notify_ticket">Notify customer & create ticket</SelectItem>
                                    <SelectItem value="off">AI off</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-white leading-tight">Opt-Out Compliance</p>
                        <p className="text-xs text-muted-foreground mt-1">STOP instructions are automatically appended to the first outbound message to each contact as required by law.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-white/5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Escalation Triggers</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.sms.handoffKeywords"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Keywords</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="agent, human, person" 
                                    value={Array.isArray(field.value) ? field.value.join(', ') : field.value} 
                                    onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                                    className="bg-muted/20 border-white/10"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workflowConfig.sms.sentimentEscalation"
                    render={({ field }) => (
                        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-white">Escalate on negative sentiment</p>
                                <p className="text-xs text-muted-foreground">Route to human if customer is frustrated.</p>
                            </div>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                    )}
                />
            </div>
          </div>
        );
      case 'voice':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <FormField
                control={form.control}
                name="workflowConfig.voice.greetingScript"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Greeting Script</FormLabel>
                        <FormControl><Textarea placeholder="Hi! You've reached support. How can I help?" {...field} className="bg-muted/20 border-white/10 min-h-[100px]" /></FormControl>
                        <FormDescription className="text-[10px]">What the AI says when the call connects. Use {"{hub_name}"} for dynamic insertion.</FormDescription>
                    </FormItem>
                )}
            />

            <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Call Handling Mode</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.voice.callHandlingMode"
                    render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-3">
                            <label htmlFor="mode-full" className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer", field.value === 'full_ai' ? "bg-primary/10 border-primary shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10")}>
                                <RadioGroupItem value="full_ai" id="mode-full" className="sr-only" />
                                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", field.value === 'full_ai' ? "bg-primary text-primary-foreground" : "bg-card border")}><BotIcon className="h-5 w-5" /></div>
                                <div className="flex-1">
                                    <p className={cn("font-bold text-sm", field.value === 'full_ai' ? "text-primary" : "text-foreground")}>Full AI Resolution</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">AI owns the entire call, only escalates if stuck.</p>
                                </div>
                            </label>
                            <label htmlFor="mode-triage" className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer", field.value === 'warm_handoff' ? "bg-primary/10 border-primary shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10")}>
                                <RadioGroupItem value="warm_handoff" id="mode-triage" className="sr-only" />
                                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", field.value === 'warm_handoff' ? "bg-primary text-primary-foreground" : "bg-card border")}><Zap className="h-5 w-5" /></div>
                                <div className="flex-1">
                                    <p className={cn("font-bold text-sm", field.value === 'warm_handoff' ? "text-primary" : "text-foreground")}>AI Triage + Warm Handoff</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">AI collects context then transfers to an agent with a summary.</p>
                                </div>
                            </label>
                            <label htmlFor="mode-receptionist" className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer", field.value === 'receptionist_only' ? "bg-primary/10 border-primary shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10")}>
                                <RadioGroupItem value="receptionist_only" id="mode-receptionist" className="sr-only" />
                                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", field.value === 'receptionist_only' ? "bg-primary text-primary-foreground" : "bg-card border")}><UserCheck className="h-5 w-5" /></div>
                                <div className="flex-1">
                                    <p className={cn("font-bold text-sm", field.value === 'receptionist_only' ? "text-primary" : "text-foreground")}>Receptionist Only</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">AI greets, takes a message, and ends the call.</p>
                                </div>
                            </label>
                        </RadioGroup>
                    )}
                />
            </div>

            {watchedValues.workflowConfig?.voice?.callHandlingMode === 'warm_handoff' && (
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-primary">
                        <Zap className="h-4 w-4" />
                        <h4 className="text-sm font-bold uppercase tracking-tight">Warm Handoff Settings</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="workflowConfig.voice.handoffTarget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Route to...</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="any">Any available agent</SelectItem>
                                            <SelectItem value="assigned">Assigned agent</SelectItem>
                                            <SelectItem value="team">Specific team</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="workflowConfig.voice.handoffFallback"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">If no agent answers...</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="voicemail">Take voicemail</SelectItem>
                                            <SelectItem value="ai_resolve">AI attempts resolution</SelectItem>
                                            <SelectItem value="callback">Offer callback</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="workflowConfig.voice.handoffTimeoutSeconds"
                        render={({ field }) => (
                            <FormItem className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <FormLabel className="text-xs">Agent answer timeout</FormLabel>
                                    <Badge variant="secondary" className="font-mono">{field.value}s</Badge>
                                </div>
                                <FormControl>
                                    <Slider value={[field.value]} min={30} max={180} step={5} onValueChange={(vals) => field.onChange(vals[0])} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            )}

            <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Behavior Toggles</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { key: 'transcriptionEnabled', label: 'Transcribe all calls', icon: Mic, def: true },
                        { key: 'afterHoursAiOnly', label: 'After-hours AI only', icon: Clock, def: false },
                        { key: 'voicemailEnabled', label: 'Voicemail fallback', icon: ShieldAlert, def: true },
                        { key: 'aiGreetingEnabled', label: 'AI Greeting', icon: MessageSquare, def: true },
                    ].map(t => (
                        <FormField
                            key={t.key}
                            control={form.control}
                            name={`workflowConfig.voice.${t.key}`}
                            render={({ field }) => (
                                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <t.icon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs font-bold">{t.label}</span>
                                    </div>
                                    <Switch checked={field.value ?? t.def} onCheckedChange={field.onChange} />
                                </div>
                            )}
                        />
                    ))}
                </div>
            </div>

            <FormField
                control={form.control}
                name="workflowConfig.voice.afterHoursBehavior"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">After Hours Behavior</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-muted/20 border-white/10"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="ai_full">Full AI handles everything</SelectItem>
                                <SelectItem value="receptionist_only">Receptionist only</SelectItem>
                                <SelectItem value="voicemail_only">Voicemail only</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />
          </div>
        );
      case 'email':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="workflowConfig.supportEmail.tone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Response Tone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="bg-muted/20 border-white/10"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="formal">Formal</SelectItem>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workflowConfig.supportEmail.signOff"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Default Sign-off</FormLabel>
                            <FormControl><Input placeholder="Best regards, The Support Team" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="workflowConfig.supportEmail.alwaysAddress"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Always Include</FormLabel>
                        <FormControl><Textarea placeholder="e.g. ticket numbers, help center links, or survey links." {...field} className="bg-muted/20 border-white/10 min-h-[80px]" /></FormControl>
                        <FormDescription className="text-[10px]">Key info the AI should reference in every reply.</FormDescription>
                    </FormItem>
                )}
            />

            <div className="space-y-6 pt-4 border-t border-white/5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Escalation Triggers</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.supportEmail.escalationTriggers"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Keywords</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="agent, human, manager" 
                                    value={Array.isArray(field.value) ? field.value.join(', ') : field.value} 
                                    onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                                    className="bg-muted/20 border-white/10"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workflowConfig.supportEmail.escalateOnSentiment"
                    render={({ field }) => (
                        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-white">Escalate emails showing negative sentiment</p>
                                <p className="text-xs text-muted-foreground">Flags frustrated customers for human review.</p>
                            </div>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                    )}
                />
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
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
                                    {watchedValues.name || (mode === 'widget' ? 'New Widget' : 'New Agent')}
                                </DialogTitle>
                                <DialogDescription className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                    {mode === 'widget' ? 'Widget Setup' : 'AI Intelligence'}
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

            <div className="flex-1 flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                    <div className="p-8 max-w-4xl mx-auto space-y-10">
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">General</h2>
                                    <p className="text-muted-foreground text-sm">Identity and status settings.</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Internal Name</FormLabel>
                                            <FormControl><Input {...field} className="bg-muted/20 border-white/10 h-11" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {mode === 'widget' && (
                                    <div className="space-y-6 pt-4 border-t border-white/5">
                                        <FormField
                                            control={form.control}
                                            name="welcomeMessage"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Greeting Message</FormLabel>
                                                    <FormControl><Textarea placeholder="Hi! How can we help you today?" {...field} className="bg-muted/20 border-white/10 min-h-[100px]" /></FormControl>
                                                    <FormDescription className="text-xs">Shown to every visitor when the widget opens.</FormDescription>
                                                </FormItem>
                                            )}
                                        />
                                        {!watchedValues.assignedAgentId && (
                                            <FormField
                                                control={form.control}
                                                name="noAgentFallbackMessage"
                                                render={({ field }) => (
                                                    <FormItem className="animate-in fade-in duration-300">
                                                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">No-Agent Fallback Message</FormLabel>
                                                        <FormControl><Textarea placeholder="Our team will be with you shortly." {...field} className="bg-muted/20 border-white/10 min-h-[100px]" /></FormControl>
                                                        <FormDescription className="text-xs">Shown after the visitor's first message when no AI Agent is assigned.</FormDescription>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'channels' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Channels</h2>
                                    <p className="text-muted-foreground text-sm">Channels route to the inbox by default. Enabling a channel here adds AI on top of your existing connections.</p>
                                </div>

                                <div className="grid gap-4">
                                    {[
                                        { id: 'web', label: 'Web Chat', icon: MessageSquare, desc: 'AI intelligence for site visitors.' },
                                        { id: 'sms', label: 'SMS', icon: Smartphone, desc: 'Real-time text assistance.' },
                                        { id: 'voice', label: 'Phone', icon: Phone, desc: 'Voice-based AI handling.' },
                                        { id: 'email', label: 'Email', icon: Mail, desc: 'Sync and automate email threads.' }
                                    ].map(channel => (
                                        <Card key={channel.id} className="bg-[#161b22] border-white/10 overflow-hidden">
                                            <div className="p-6 flex items-center justify-between border-b border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><channel.icon className="h-5 w-5" /></div>
                                                    <div>
                                                        <h3 className="font-bold text-white">{channel.label}</h3>
                                                        <p className="text-xs text-muted-foreground">{channel.desc}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {activeConfigPath === channel.id ? (
                                                        <Button variant="ghost" size="sm" onClick={() => setActiveConfigPath(null)} className="text-muted-foreground h-8 text-[10px] uppercase font-black">Close Config</Button>
                                                    ) : (
                                                        <Button variant="secondary" size="sm" onClick={() => setActiveConfigPath(channel.id)} className="h-8 text-[10px] uppercase font-black" disabled={!watchedValues.channelConfig?.[channel.id]?.enabled}>Configure</Button>
                                                    )}
                                                    <Switch checked={watchedValues.channelConfig?.[channel.id]?.enabled} onCheckedChange={(val) => form.setValue(`channelConfig.${channel.id}.enabled`, val)} />
                                                </div>
                                            </div>
                                            {activeConfigPath === channel.id && (
                                                <div className="p-6 bg-black/20 border-t border-white/5">
                                                    {renderChannelConfig(channel.id)}
                                                </div>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'branding' && mode === 'widget' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Branding</h2>
                                    <p className="text-muted-foreground text-sm">Customize your widget's appearance.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <ColorField name="primaryColor" label="Primary Color" form={form} />
                                        <ColorField name="backgroundColor" label="Background Color" form={form} />
                                    </div>
                                    <div className="space-y-4">
                                        <ColorField name="chatbotIconsColor" label="Launcher Color" form={form} />
                                        <ColorField name="chatbotIconsTextColor" label="Icon Color" form={form} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'installation' && mode === 'widget' && (
                            <div className="space-y-10 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Install</h2>
                                    <p className="text-muted-foreground text-sm">Embed code for your website.</p>
                                </div>
                                <div className="p-6 rounded-2xl border border-white/10 bg-[#161b22] space-y-4">
                                    <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-xs font-mono text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                        <code>{`<script src="https://manowar.cloud/chatbot-loader.js" data-widget-id="${bot?.id}" async></script>`}</code>
                                    </pre>
                                    <Button type="button" onClick={() => handleCopy(`<script src="https://manowar.cloud/chatbot-loader.js" data-widget-id="${bot?.id}" async></script>`)} className="w-full h-11 rounded-xl">Copy Snippet</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <footer className="p-4 border-t border-white/10 bg-[#090c10] shrink-0 flex justify-end items-center gap-3">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-white">Cancel</Button>
                    <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-primary/20">Save {mode === 'widget' ? 'Widget' : 'Agent'}</Button>
                </footer>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
                            <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-[-5px] h-[calc(100%+10px)] w-[calc(100%+10px)] cursor-pointer" />
                        </div>
                    </div>
                </FormItem>
            )}
        />
    );
}
