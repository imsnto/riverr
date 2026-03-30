
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
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, Hub, Space } from '@/lib/data';
import { 
  X, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Upload, 
  Loader2, 
  Check,
  Palette,
  Settings2,
  Users,
  BrainCircuit,
  Sparkles,
  ChevronRight,
  FileIcon,
  Code,
  Copy,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import ChatbotSimulator from './chatbot-simulator';
import { uploadBotLogo } from '@/lib/db';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const widgetSettingsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  welcomeMessage: z.string().min(1, 'Welcome message is required.'),
  assignedAgentId: z.string().nullable().optional(),
  agentIds: z.array(z.string()).default([]),
  styleSettings: z.object({
    primaryColor: z.string().default('#3b82f6'),
    backgroundColor: z.string().default('#111827'),
    logoUrl: z.string().default(''),
    chatbotIconsColor: z.string().default('#3b82f6'),
    chatbotIconsTextColor: z.string().default('#ffffff'),
    headerTextColor: z.string().default('#ffffff'),
    customerTextColor: z.string().default('#ffffff'),
    agentMessageBackgroundColor: z.string().default('#374151'),
    agentMessageTextColor: z.string().default('#ffffff'),
  }),
  identityCapture: z.object({
    askForName: z.boolean().default(false),
    askForEmail: z.boolean().default(true),
    askForPhone: z.boolean().default(false),
    trigger: z.enum(['before_escalation', 'before_quote', 'after_helpful_answer', 'never']).default('after_helpful_answer'),
    leadCaptureMessage: z.string().default('Before we continue, could I grab your name and email?'),
  }),
});

type WidgetSettingsFormValues = z.infer<typeof widgetSettingsSchema>;

interface WidgetSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (data: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  allUsers: User[];
  hubAgents: BotData[]; 
  activeHub: Hub | null;
  activeSpace: Space | null;
}

const DEFAULT_WIDGET_VALUES: WidgetSettingsFormValues = {
  name: '',
  welcomeMessage: 'Hi! How can we help you today?',
  agentIds: [],
  assignedAgentId: null,
  styleSettings: {
    primaryColor: '#3b82f6',
    backgroundColor: '#111827',
    headerTextColor: '#ffffff',
    customerTextColor: '#ffffff',
    agentMessageBackgroundColor: '#374151',
    agentMessageTextColor: '#ffffff',
    chatbotIconsColor: '#3b82f6',
    chatbotIconsTextColor: '#ffffff',
    logoUrl: '',
  },
  identityCapture: {
    askForName: false,
    askForEmail: true,
    askForPhone: false,
    trigger: 'after_helpful_answer',
    leadCaptureMessage: 'Before we continue, could I grab your name and email?',
  },
};

export default function WidgetSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  allUsers,
  hubAgents,
  activeHub,
  activeSpace,
}: WidgetSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('style');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<WidgetSettingsFormValues>({
    resolver: zodResolver(widgetSettingsSchema),
    defaultValues: bot ? ({ ...DEFAULT_WIDGET_VALUES, ...bot } as any) : DEFAULT_WIDGET_VALUES,
  });

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        form.reset({ ...DEFAULT_WIDGET_VALUES, ...bot } as any);
      } else {
        form.reset(DEFAULT_WIDGET_VALUES);
      }
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const simulatorBotData = useMemo(() => {
    const agent = hubAgents.find(a => a.id === watchedValues.assignedAgentId);
    const baseData = {
      ...watchedValues,
      hubId: (watchedValues as any).hubId || activeHub?.id,
      spaceId: (watchedValues as any).spaceId || activeSpace?.id,
      type: 'widget' as const
    };

    if (agent) {
      return {
        ...baseData,
        ...agent,
        styleSettings: watchedValues.styleSettings,
        assignedAgentId: watchedValues.assignedAgentId,
      };
    }
    return baseData;
  }, [watchedValues, hubAgents, activeHub, activeSpace]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bot?.id) return;
    setIsUploading(true);
    try {
      const url = await uploadBotLogo(file, bot.id);
      form.setValue('styleSettings.logoUrl', url);
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const onSubmit = (values: WidgetSettingsFormValues) => {
    const payload: BotData | Omit<BotData, 'id' | 'hubId'> = {
      ...(bot || {}),
      ...values,
      type: 'widget',
    } as any;

    onSave(payload);
    onOpenChange(false);
  };

  const navItems = [
    { id: 'style', label: 'Style & Branding', icon: Palette },
    { id: 'behavior', label: 'Chat Behavior', icon: BrainCircuit },
    { id: 'team', label: 'Human Team', icon: Users },
    { id: 'installation', label: 'Installation', icon: Code }
  ];

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://app.riverr.app';
  
  const basicEmbedCode = `<!-- Manowar Chat Widget -->
<script>
  window.manowarSettings = {
    botId: "${bot?.id || 'YOUR_BOT_ID'}",
    hubId: "${bot?.hubId || 'YOUR_HUB_ID'}"
  };
</script>
<script src="${appOrigin}/widget.js" async></script>`;

  const identityEmbedCode = `<!-- Manowar Identity-Aware Widget -->
<script>
  window.manowarSettings = {
    botId: "${bot?.id || 'YOUR_BOT_ID'}",
    hubId: "${bot?.hubId || 'YOUR_HUB_ID'}",
    user_id: "USER_ID_FROM_YOUR_DB", // REQUIRED for identity
    name: "User Name",
    email: "user@example.com",
    // user_hash: "HMAC_SHA256_HASH" // Recommended for Secure Mode
  };
</script>
<script src="${appOrigin}/widget.js" async></script>`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <DialogHeader className="border-b border-white/10 bg-[#090c10] p-0 shrink-0 z-[100]">
          <div className="flex items-center justify-between gap-6 px-6 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-lg font-bold text-white leading-none">
                  {watchedValues.name || 'New Chat Widget'}
                </DialogTitle>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-50">
                  Chat Widget Configuration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-white/10 bg-white/[0.03] p-1 lg:flex">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                      activeTab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-white'
                    )}
                  >
                    {React.createElement(item.icon, { className: 'h-4 w-4' })}
                    {item.label}
                  </button>
                ))}
              </div>
              <Button onClick={form.handleSubmit(onSubmit)} className="rounded-full px-6 font-bold h-10">Save Widget</Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-10 w-10">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          <ScrollArea className="flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-10 px-6 py-8 pb-32 text-left">
                <div className="grid gap-4 lg:hidden">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold',
                        activeTab === item.id ? 'border-primary/30 bg-primary/10 text-white' : 'border-white/10 bg-white/[0.03] text-muted-foreground'
                      )}
                    >
                      {React.createElement(item.icon, { className: 'h-4 w-4' })}
                      {item.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'style' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary">Identity</h3>
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold">Widget Name (Internal)</FormLabel>
                          <FormControl><Input placeholder="e.g. Website Support Chat" {...field} value={field.value || ''} /></FormControl>
                          <FormDescription className="text-[10px]">How this widget is identified in your dashboard.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary">Branding & Visuals</h3>
                      <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                          <AvatarImage src={watchedValues.styleSettings?.logoUrl} />
                          <AvatarFallback className="text-xl">LG</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || !bot?.id} className="h-10 rounded-xl">
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Upload Widget Logo
                          </Button>
                          {!bot?.id && <p className="text-[10px] text-amber-500 font-bold">Save widget to enable logo uploads.</p>}
                        </div>
                      </div>

                      <div className="grid gap-8 sm:grid-cols-2">
                        <ColorInput form={form} name="styleSettings.primaryColor" label="Primary Theme Color" />
                        <ColorInput form={form} name="styleSettings.backgroundColor" label="Background Color" />
                        <ColorInput form={form} name="styleSettings.headerTextColor" label="Header Text Color" />
                        <ColorInput form={form} name="styleSettings.customerTextColor" label="Customer Bubble Text" />
                        <ColorInput form={form} name="styleSettings.agentMessageBackgroundColor" label="Agent Bubble Color" />
                        <ColorInput form={form} name="styleSettings.agentMessageTextColor" label="Agent Bubble Text" />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'behavior' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <BrainCircuit className="h-4 w-4" />
                        <h3 className="text-sm font-black uppercase tracking-widest">AI Agent Brain</h3>
                      </div>
                      <FormField control={form.control} name="assignedAgentId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold">Select an AI Brain</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'none'}>
                            <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="No Agent Brain (Human Only)" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">None (Use Fallback Behavior)</SelectItem>
                              {hubAgents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </section>

                    {(!watchedValues.assignedAgentId || watchedValues.assignedAgentId === 'none') && (
                      <div className="space-y-12 animate-in slide-in-from-top-2 duration-300">
                        <section className="space-y-6">
                          <FormField control={form.control} name="welcomeMessage" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold">Default Greeting</FormLabel>
                              <FormControl><Textarea rows={4} placeholder="Hi! How can we help you?" {...field} value={field.value || ''} className="rounded-xl bg-white/[0.02]" /></FormControl>
                            </FormItem>
                          )} />
                        </section>

                        <section className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-50">Lead Capture</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                              { id: 'f-name', name: 'identityCapture.askForName', label: 'Name' },
                              { id: 'f-email', name: 'identityCapture.askForEmail', label: 'Email' },
                              { id: 'f-phone', name: 'identityCapture.askForPhone', label: 'Phone' },
                            ].map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                                <Label htmlFor={item.id} className="text-sm font-bold">{item.label}</Label>
                                <Switch checked={!!form.getValues(item.name as any)} onCheckedChange={(v) => form.setValue(item.name as any, v)} id={item.id} />
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'team' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">Human Team</h3>
                    <p className="text-sm text-muted-foreground">Select team members who should be notified or assigned to new conversations from this widget.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {allUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border border-white/5 bg-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate text-white">{user.name}</p>
                              <p className="text-[10px] font-medium text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                          <Checkbox 
                            checked={watchedValues.agentIds?.includes(user.id)} 
                            onCheckedChange={(checked) => {
                              const current = watchedValues.agentIds || [];
                              form.setValue('agentIds', checked ? [...current, user.id] : current.filter(id => id !== user.id));
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'installation' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-primary">Standard Installation</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Paste this code right before the closing <code>&lt;/body&gt;</code> tag on every page where you want the chat to appear.
                      </p>
                      <div className="relative group">
                        <pre className="bg-black/40 p-6 rounded-2xl border border-white/5 text-[11px] font-mono overflow-x-auto text-zinc-300 leading-relaxed shadow-inner">
                          {basicEmbedCode}
                        </pre>
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          className="absolute top-3 right-3 h-8 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg"
                          onClick={() => handleCopy(basicEmbedCode)}
                        >
                          <Copy className="h-3 w-3 mr-1.5" /> Copy Code
                        </Button>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Identify Known Users</h3>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] uppercase font-black px-2 h-5">Advanced</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        If your users are already logged in, you can pass their details to Manowar. This ensures conversations are linked to their CRM profile automatically.
                      </p>
                      <div className="relative group">
                        <pre className="bg-black/40 p-6 rounded-2xl border border-white/5 text-[11px] font-mono overflow-x-auto text-zinc-300 leading-relaxed shadow-inner">
                          {identityEmbedCode}
                        </pre>
                        <Button 
                          type="button" 
                          variant="secondary" 
                          size="sm" 
                          className="absolute top-3 right-3 h-8 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg"
                          onClick={() => handleCopy(identityEmbedCode)}
                        >
                          <Copy className="h-3 w-3 mr-1.5" /> Copy Code
                        </Button>
                      </div>
                    </section>
                  </div>
                )}
              </form>
            </Form>
          </ScrollArea>

          <aside className="hidden xl:flex w-[400px] border-l border-white/10 bg-[#090c10] flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Live Simulator</span>
              <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold border-white/10 text-primary bg-primary/5 px-2">Preview Mode</Badge>
            </div>
            <div className="flex-1 relative">
              <ChatbotSimulator 
                isOpen={true} 
                onClose={() => {}} 
                botData={simulatorBotData as any} 
                flow={simulatorBotData.flow || { nodes: [], edges: [] }} 
                agents={allUsers.filter(u => simulatorBotData.agentIds?.includes(u.id))}
              />
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorInput({ form, name, label }: { form: any, name: string, label: string }) {
  const value = form.watch(name);
  
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</FormLabel>
          <div className="flex gap-3">
            <FormControl>
              <div className="relative flex-1">
                <div 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md shadow-inner border border-white/10" 
                  style={{ backgroundColor: field.value }} 
                />
                <Input 
                  {...field} 
                  value={field.value || ''} 
                  className="pl-11 font-mono text-xs h-11 uppercase bg-white/[0.02] border-white/10" 
                />
              </div>
            </FormControl>
            <input 
              type="color" 
              value={field.value || '#000000'} 
              onChange={(e) => field.onChange(e.target.value)} 
              className="w-11 h-11 rounded-xl border border-white/10 bg-transparent p-1.5 cursor-pointer shrink-0 hover:scale-105 transition-transform" 
            />
          </div>
        </FormItem>
      )}
    />
  );
}
