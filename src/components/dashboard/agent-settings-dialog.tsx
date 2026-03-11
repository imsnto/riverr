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
  ArrowRight, 
  Info,
  Trash2,
  Bell,
  Eye,
  Upload,
  Plus,
  Image as ImageIcon,
  EyeOff
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatbotSimulator from './chatbot-simulator';
import * as db from '@/lib/db';

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
  headerTextColor: z.string().optional(),
  customerTextColor: z.string().optional(),
  agentMessageBackgroundColor: z.string().optional(),
  agentMessageTextColor: z.string().optional(),
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
      headerTextColor: '#ffffff',
      customerTextColor: '#ffffff',
      agentMessageBackgroundColor: '#374151',
      agentMessageTextColor: '#ffffff',
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
          welcomeMessage: 'Hi! How can I help?',
          handoffKeywords: ['agent', 'human', 'person'],
          conversationGoal: 'Resolve the customer\'s issue efficiently and collect contact details.',
          identityCapture: { timing: 'after', fields: { name: true, email: true, phone: false } },
          afterHoursBehavior: 'ai_full'
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
        headerTextColor: bot.styleSettings?.headerTextColor || '#ffffff',
        customerTextColor: bot.styleSettings?.customerTextColor || '#ffffff',
        agentMessageBackgroundColor: bot.styleSettings?.agentMessageBackgroundColor || '#374151',
        agentMessageTextColor: bot.styleSettings?.agentMessageTextColor || '#ffffff',
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
    const items = [
      { id: 'general', label: 'General', icon: Settings },
    ];

    if (mode === 'widget') {
      items.push(
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'installation', label: 'Install', icon: Plug }
      );
    } else {
      items.push(
        { id: 'channels', label: 'Channels', icon: Globe },
        { id: 'knowledge', label: 'Knowledge', icon: BookOpen }
      );
    }

    return items;
  }, [mode]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bot) return;

    setIsUploadingLogo(true);
    try {
      const url = await db.uploadBotLogo(file, bot.id);
      form.setValue('logoUrl', url);
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const onSubmit = (values: AgentSettingsFormValues) => {
    const deepSanitize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(deepSanitize);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, deepSanitize(v)])
        );
      }
      return obj;
    };

    const styleSettings = {
        primaryColor: values.primaryColor || '#3b82f6',
        backgroundColor: values.backgroundColor || '#111827',
        logoUrl: values.logoUrl || '',
        chatbotIconsColor: values.chatbotIconsColor || '#3b82f6',
        chatbotIconsTextColor: values.chatbotIconsTextColor || '#ffffff',
        headerTextColor: values.headerTextColor || '#ffffff',
        customerTextColor: values.customerTextColor || '#ffffff',
        agentMessageBackgroundColor: values.agentMessageBackgroundColor || '#374151',
        agentMessageTextColor: values.agentMessageTextColor || '#ffffff',
    };

    const commonData = deepSanitize({
        ...values,
        styleSettings
    });

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
                <p className="text-xs text-muted-foreground leading-relaxed text-left">
                    Widget installation and appearance is managed in <Link href={`/space/${bot?.spaceId}/hub/${bot?.hubId}/settings?view=web-chat`} className="text-primary font-bold hover:underline">Web Chat settings</Link>.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
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

            <div className="space-y-4 text-left">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Conversation Goal</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.web.conversationGoal"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea 
                                    placeholder="Resolve the customer's issue efficiently..." 
                                    {...field} 
                                    className="bg-muted/20 border-white/10 min-h-[100px] text-sm italic"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <div className="space-y-4 text-left">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Handoff Keywords</Label>
                <FormField
                    control={form.control}
                    name="workflowConfig.web.handoffKeywords"
                    render={({ field }) => (
                        <FormItem>
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
            </div>

            <Separator className="bg-white/5" />

            <div className="space-y-6 text-left">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Identity Capture</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="workflowConfig.web.identityCapture.timing"
                        render={({ field }) => (
                            <FormItem className="space-y-3 text-left">
                                <FormLabel className="text-xs text-muted-foreground">Timing</FormLabel>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="before" id="before" /><Label htmlFor="before" className="text-xs">Before first response</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="after" id="after" /><Label htmlFor="after" className="text-xs">After first response</Label></div>
                                </RadioGroup>
                            </FormItem>
                        )}
                    />
                    <div className="space-y-3 text-left">
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

            <div className="space-y-4 text-left">
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

            <div className="pt-6 border-t border-white/5 text-left">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Active on Widgets</Label>
                <div className="mt-4 space-y-2">
                    {widgetsUsingThisAgent.length > 0 ? widgetsUsingThisAgent.map(w => (
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                                <span className="text-sm font-medium text-white">{w.name}</span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" asChild className="h-8 text-[10px] uppercase font-bold text-primary hover:text-primary hover:bg-primary/10">
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
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
            {!isPersonalAgent && (
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="workflowConfig.sms.responseStyle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Response Style</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || (isPersonalAgent ? 'short' : 'concise')}>
                                <FormControl><SelectTrigger className="bg-muted/20 border-white/10"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {isPersonalAgent ? (
                                      <>
                                        <SelectItem value="short">Short</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="match">Match</SelectItem>
                                      </>
                                    ) : (
                                      <>
                                        <SelectItem value="concise">Concise</SelectItem>
                                        <SelectItem value="conversational">Conversational</SelectItem>
                                      </>
                                    )}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}
                />
                {!isPersonalAgent ? (
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
                ) : (
                  <FormField
                    control={form.control}
                    name="workflowConfig.sms.smartTiming"
                    render={({ field }) => (
                        <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] mt-6">
                            <div className="space-y-0.5">
                                <p className="text-sm font-bold text-white">Smart Timing</p>
                                <p className="text-[10px] text-muted-foreground">Notify me instead of drafting outside my hours.</p>
                            </div>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                    )}
                  />
                )}
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

            {!isPersonalAgent && (
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
                                  <p className="text-sm font-bold text-white">Escalate on repeated negative sentiment</p>
                                  <p className="text-xs text-muted-foreground">If a customer sends multiple frustrated messages in a row, flag for human review automatically.</p>
                              </div>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </div>
                      )}
                  />
              </div>
            )}
          </div>
        );
      case 'voice':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
            <FormField
                control={form.control}
                name="workflowConfig.voice.greetingScript"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Greeting Script</FormLabel>
                        <FormControl><Textarea placeholder="Hi! Thank you for calling. How can I help?" {...field} className="bg-muted/20 border-white/10 min-h-[100px]" /></FormControl>
                        <FormDescription className="text-[10px]">What the AI says when the call connects.</FormDescription>
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
                            {!isPersonalAgent && (
                              <>
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
                              </>
                            )}
                            <label htmlFor="mode-receptionist" className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer", field.value === 'receptionist_only' ? "bg-primary/10 border-primary shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10")}>
                                <RadioGroupItem value="receptionist_only" id="mode-receptionist" className="sr-only" />
                                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", field.value === 'receptionist_only' ? "bg-primary text-primary-foreground" : "bg-card border")}><UserCheck className="h-5 w-5" /></div>
                                <div className="flex-1">
                                    <p className={cn("font-bold text-sm", field.value === 'receptionist_only' ? "text-primary" : "text-foreground")}>{isPersonalAgent ? 'Receptionist' : 'Receptionist Only'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">AI greets, takes a message, and ends the call.</p>
                                </div>
                            </label>
                            {isPersonalAgent && (
                              <label htmlFor="mode-voicemail" className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer", field.value === 'voicemail_only' ? "bg-primary/10 border-primary shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10")}>
                                  <RadioGroupItem value="voicemail_only" id="mode-voicemail" className="sr-only" />
                                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", field.value === 'voicemail_only' ? "bg-primary text-primary-foreground" : "bg-card border")}><Mic className="h-5 w-5" /></div>
                                  <div className="flex-1">
                                      <p className={cn("font-bold text-sm", field.value === 'voicemail_only' ? "text-primary" : "text-foreground")}>Voicemail Only</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">Direct callers straight to your personal voicemail.</p>
                                  </div>
                              </label>
                            )}
                        </RadioGroup>
                    )}
                />
            </div>

            {!isPersonalAgent && watchedValues.workflowConfig?.voice?.callHandlingMode === 'warm_handoff' && (
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
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                        { key: 'afterHoursAiOnly', label: 'After-hours AI only', icon: Clock, def: false, hide: isPersonalAgent },
                        { key: 'voicemailEnabled', label: 'Voicemail fallback', icon: ShieldAlert, def: true },
                        { key: 'aiGreetingEnabled', label: 'AI Greeting', icon: MessageSquare, def: true },
                        { key: 'callbackNotification', label: 'Callback Notification', icon: Bell, def: true, show: isPersonalAgent },
                    ].filter(t => !t.hide && (t.show === undefined || t.show)).map(t => (
                        <FormField
                            key={t.key}
                            control={form.control}
                            name={`workflowConfig.voice.${t.key}`}
                            render={({ field }) => (
                                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <t.icon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col text-left">
                                          <span className="text-xs font-bold">{t.label}</span>
                                          {t.key === 'callbackNotification' && <span className="text-[9px] text-muted-foreground">Notify me immediately when AI takes a message.</span>}
                                        </div>
                                    </div>
                                    <Switch checked={field.value ?? t.def} onCheckedChange={field.onChange} />
                                </div>
                            )}
                        />
                    ))}
                </div>
            </div>

            {!isPersonalAgent && (
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
            )}
          </div>
        );
      case 'email':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isPersonalAgent ? (
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
                ) : (
                  <FormField
                    control={form.control}
                    name="workflowConfig.personalEmail.writingStyle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Writing Style</FormLabel>
                            <FormControl><Input placeholder="How should the AI write on your behalf?" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                        </FormItem>
                    )}
                  />
                )}
                <FormField
                    control={form.control}
                    name={isPersonalAgent ? "workflowConfig.personalEmail.signOff" : "workflowConfig.supportEmail.signOff"}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Default Sign-off</FormLabel>
                            <FormControl><Input placeholder={isPersonalAgent ? `Thanks, ${bot?.name?.split(' ')[0]}` : "Best regards, The Support Team"} {...field} className="bg-muted/20 border-white/10" /></FormControl>
                        </FormItem>
                    )}
                />
            </div>

            {isPersonalAgent && (
              <FormField
                control={form.control}
                name="workflowConfig.personalEmail.contextAwareness"
                render={({ field }) => (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="space-y-0.5">
                            <p className="text-sm font-bold text-white">Context Awareness</p>
                            <p className="text-xs text-muted-foreground">Reference previous email history with this contact when drafting.</p>
                        </div>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                )}
              />
            )}

            <FormField
                control={form.control}
                name={isPersonalAgent ? "workflowConfig.personalEmail.alwaysAddress" : "workflowConfig.supportEmail.alwaysAddress"}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Always Include</FormLabel>
                        <FormControl><Textarea placeholder="e.g. ticket numbers, help center links, or survey links." {...field} className="bg-muted/20 border-white/10 min-h-[80px]" /></FormControl>
                        <FormDescription className="text-[10px]">Key info the AI should reference in every reply.</FormDescription>
                    </FormItem>
                )}
            />

            {!isPersonalAgent && (
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
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-7xl w-[98vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10 transition-all duration-500"
      )}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            {/* Top Navigation Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className={cn("h-2 w-2 rounded-full", watchedValues.isEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600")} />
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-white leading-none truncate">{watchedValues.name || 'Bot'}</h2>
                            <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">
                                {mode === 'widget' ? 'Widget Configuration' : 'AI Agent Configuration'}
                            </p>
                        </div>
                    </div>

                    <nav className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/5">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                                    activeTab === item.id 
                                        ? "bg-primary text-primary-foreground shadow-lg" 
                                        : "text-muted-foreground hover:text-white"
                                )}
                            >
                                <item.icon className="h-3.5 w-3.5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                        className={cn(
                            "rounded-full h-9 w-9", 
                            isPreviewOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-white"
                        )}
                    >
                        {isPreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Separator orientation="vertical" className="h-6 bg-white/10" />
                    <Button type="submit" className="rounded-full h-9 px-6 font-black shadow-lg shadow-primary/20">
                        Save Changes
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-9 w-9 text-muted-foreground hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <ScrollArea className="flex-1 h-full">
                    <div className="p-10 max-w-4xl mx-auto space-y-10 pb-32 text-left">
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">General</h2>
                                    <p className="text-muted-foreground text-sm">Identity and human team settings.</p>
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
                                    <div className="space-y-10 pt-4 border-t border-white/5">
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Human Team Members</Label>
                                            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {watchedValues.agentIds?.map(userId => {
                                                        const user = allUsers.find(u => u.id === userId);
                                                        return (
                                                            <Badge key={userId} variant="secondary" className="pl-1 pr-2 py-1 h-8 gap-2 rounded-lg border-white/5">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={user?.avatarUrl} />
                                                                    <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-xs">{user?.name}</span>
                                                                <button type="button" onClick={() => form.setValue('agentIds', watchedValues.agentIds?.filter(id => id !== userId))}>
                                                                    <X className="h-3 w-3 hover:text-white" />
                                                                </button>
                                                            </Badge>
                                                        );
                                                    })}
                                                    {(!watchedValues.agentIds || watchedValues.agentIds.length === 0) && (
                                                        <p className="text-xs text-muted-foreground italic px-1">No human members assigned.</p>
                                                    )}
                                                </div>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button type="button" variant="outline" size="sm" className="h-9 gap-2 border-white/10 rounded-lg">
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Add Team Member
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search members..." />
                                                            <CommandList>
                                                                <CommandEmpty>No members found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {allUsers.map(user => (
                                                                        <CommandItem 
                                                                            key={user.id} 
                                                                            onSelect={() => {
                                                                                const current = watchedValues.agentIds || [];
                                                                                if (!current.includes(user.id)) {
                                                                                    form.setValue('agentIds', [...current, user.id]);
                                                                                }
                                                                            }}
                                                                            className="gap-3 p-2 cursor-pointer"
                                                                        >
                                                                            <Avatar className="h-6 w-6">
                                                                                <AvatarImage src={user.avatarUrl} />
                                                                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="text-sm font-medium">{user.name}</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">These members appear in the chat header and handle handoffs.</p>
                                        </div>

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
                            <div className="space-y-12 animate-in fade-in duration-300">
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
                                    ].filter(c => !isPersonalAgent || c.id !== 'web').map(channel => (
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
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => setActiveConfigPath(null)} className="text-muted-foreground h-8 text-[10px] uppercase font-black">Close Config</Button>
                                                    ) : (
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => setActiveConfigPath(channel.id)} className="h-8 text-[10px] uppercase font-black" disabled={!watchedValues.channelConfig?.[channel.id]?.enabled}>Configure</Button>
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

                        {activeTab === 'knowledge' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Knowledge</h2>
                                    <p className="text-muted-foreground text-sm">Select libraries this agent can reference to answer questions.</p>
                                </div>
                                <div className="space-y-3">
                                    {helpCenters.map(hc => (
                                        <div key={hc.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                                    <BookOpen className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-white block">{hc.name}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{hc.visibility}</span>
                                                </div>
                                            </div>
                                            <Checkbox 
                                                checked={watchedValues.allowedHelpCenterIds?.includes(hc.id)} 
                                                onCheckedChange={(checked) => {
                                                    const current = watchedValues.allowedHelpCenterIds || [];
                                                    const updated = checked ? [...current, hc.id] : current.filter(id => id !== hc.id);
                                                    form.setValue('allowedHelpCenterIds', updated);
                                                }}
                                            />
                                        </div>
                                    ))}
                                    {helpCenters.length === 0 && (
                                        <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl text-center">
                                            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-20" />
                                            <p className="text-xs text-muted-foreground">No libraries found. Create one in the Knowledge tab.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'branding' && mode === 'widget' && (
                            <div className="space-y-10 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">Branding</h2>
                                    <p className="text-muted-foreground text-sm">Customize your widget's appearance.</p>
                                </div>
                                
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Main Theme</Label>
                                            <ColorField name="primaryColor" label="Primary Color" form={form} />
                                            <ColorField name="backgroundColor" label="Background Color" form={form} />
                                            
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-muted-foreground/70">Widget Logo</Label>
                                                <div className="flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                                                    {watchedValues.logoUrl ? (
                                                        <img src={watchedValues.logoUrl} className="h-10 w-10 rounded-lg object-contain bg-black/40 p-1 border border-white/10" alt="Logo" />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-dashed border-white/10">
                                                            <ImageIcon className="h-4 w-4 text-muted-foreground opacity-40" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            ref={logoInputRef} 
                                                            onChange={handleLogoUpload} 
                                                            className="hidden" 
                                                        />
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-8 gap-2"
                                                            onClick={() => logoInputRef.current?.click()}
                                                            disabled={isUploadingLogo}
                                                        >
                                                            {isUploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                                            {watchedValues.logoUrl ? 'Change Logo' : 'Upload Logo'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Launcher</Label>
                                            <ColorField name="chatbotIconsColor" label="Launcher Color" form={form} />
                                            <ColorField name="chatbotIconsTextColor" label="Icon Color" form={form} />
                                        </div>
                                    </div>

                                    <Separator className="bg-white/5" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Agent Messages</Label>
                                            <ColorField name="agentMessageBackgroundColor" label="Bubble Background" form={form} />
                                            <ColorField name="agentMessageTextColor" label="Text Color" form={form} />
                                            <ColorField name="headerTextColor" label="Header Text Color" form={form} />
                                        </div>
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Customer Messages</Label>
                                            <ColorField name="customerTextColor" label="Text Color" form={form} />
                                        </div>
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

                                <Tabs defaultValue="standard" className="w-full">
                                    <TabsList className="bg-white/5 border-white/10 p-1 rounded-xl mb-6">
                                        <TabsTrigger value="standard" className="rounded-lg text-xs font-bold px-6">Standard Snippet</TabsTrigger>
                                        <TabsTrigger value="identify" className="rounded-lg text-xs font-bold px-6">User Identification</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="standard" className="space-y-6">
                                        <div className="p-6 rounded-2xl border border-white/10 bg-[#161b22] space-y-4">
                                            <p className="text-xs text-muted-foreground">Standard script for basic chat functionality.</p>
                                            <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-xs font-mono text-primary leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                                <code>{`<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${bot?.id}" data-hub-id="${bot?.hubId}" async></script>`}</code>
                                            </pre>
                                            <Button type="button" onClick={() => handleCopy(`<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${bot?.id}" data-hub-id="${bot?.hubId}" async></script>`)} className="w-full h-11 rounded-xl">Copy Snippet</Button>
                                        </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="identify" className="space-y-6">
                                        <div className="p-6 rounded-2xl border border-white/10 bg-[#161b22] space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black px-1.5 h-5">Advanced</Badge>
                                                <p className="text-xs text-muted-foreground font-medium">Identify logged-in users to sync their profile and history securely.</p>
                                            </div>
                                            <pre className="bg-[#0d1117] border border-white/10 p-5 rounded-xl text-[11px] font-mono text-indigo-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                                <code>{`<script>
  window.Manowar = window.Manowar || function() { (window.ManowarArgs = window.ManowarArgs || []).push(arguments) };
  Manowar('identify', {
    user_id: 'USER_ID', // Replace with your user's ID
    email: 'user@example.com', // Replace with your user's email
    name: 'John Doe' // Optional
  });
</script>
<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${bot?.id}" data-hub-id="${bot?.hubId}" async></script>`}</code>
                                            </pre>
                                            <Button type="button" onClick={() => handleCopy(`<script>
  window.Manowar = window.Manowar || function() { (window.ManowarArgs = window.ManowarArgs || []).push(arguments) };
  Manowar('identify', {
    user_id: 'USER_ID',
    email: 'user@example.com',
    name: 'John Doe'
  });
</script>
<script src="https://manowar.cloud/chatbot-loader.js" data-bot-id="${bot?.id}" data-hub-id="${bot?.hubId}" async></script>`)} className="w-full h-11 rounded-xl">Copy User-Aware Snippet</Button>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Sidebar Preview */}
                {isPreviewOpen && (
                    <aside className="w-[420px] border-l border-white/10 bg-[#090c10] relative flex flex-col shrink-0 animate-in slide-in-from-right duration-500 overflow-hidden">
                        <div className="flex-1 overflow-hidden relative">
                            <ChatbotSimulator 
                                isOpen={isPreviewOpen}
                                onClose={() => setIsPreviewOpen(false)}
                                botData={{
                                    ...bot,
                                    name: watchedValues.name,
                                    welcomeMessage: watchedValues.welcomeMessage,
                                    styleSettings: {
                                        primaryColor: watchedValues.primaryColor || '#3b82f6',
                                        backgroundColor: watchedValues.backgroundColor || '#111827',
                                        logoUrl: watchedValues.logoUrl || '',
                                        chatbotIconsColor: watchedValues.chatbotIconsColor || '#3b82f6',
                                        chatbotIconsTextColor: watchedValues.chatbotIconsTextColor || '#ffffff',
                                        headerTextColor: watchedValues.headerTextColor || '#ffffff',
                                        customerTextColor: watchedValues.customerTextColor || '#ffffff',
                                        agentMessageBackgroundColor: watchedValues.agentMessageBackgroundColor || '#374151',
                                        agentMessageTextColor: watchedValues.agentMessageTextColor || '#ffffff',
                                    }
                                }}
                                flow={bot?.flow || { nodes: [], edges: [] }}
                                agents={allUsers.filter(u => watchedValues.agentIds?.includes(u.id))}
                            />
                        </div>
                        <div className="p-4 bg-black/40 border-t border-white/5 text-center shrink-0">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Live Appearance Simulator</p>
                        </div>
                    </aside>
                )}
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
