
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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, HelpCenter, PhoneChannelLookup, EmailConfig } from '@/lib/data';
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
  Target,
  UserCheck,
  Bell,
  Mic,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowRight
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '../ui/slider';
import Link from 'next/link';

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
  name: z.string().min(1, 'Name is required.'),
  isEnabled: z.boolean().default(true),
  aiEnabled: z.boolean().default(true),
  // Widget Specific (if mode === 'widget')
  welcomeMessage: z.string().optional(),
  noAgentFallbackMessage: z.string().optional(),
  assignedAgentId: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  logoUrl: z.string().optional(),
  chatbotIconsColor: z.string().optional(),
  chatbotIconsTextColor: z.string().optional(),
  // Agent Specific (if mode === 'agent')
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
  hubWidgets?: BotData[]; // For showing active assignments in Agent mode
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
  const [activeTab, setActiveTab] = useState(mode === 'agent' ? 'general' : 'general');
  const [activeConfigPath, setActiveConfigPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        web: { enabled: true },
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
        supportEmail: { tone: 'professional', signOff: 'Best regards, The Support Team', alwaysAddress: '', escalationTriggers: [] },
        sms: { responseStyle: 'concise', openingMessage: "Hi! You've reached support. How can I help?", afterHoursBehavior: 'ai_full', handoffKeywords: ['agent', 'human'], sentimentEscalation: true },
        voice: { greetingScript: 'Hi! Thank you for calling. How can I help?', callHandlingMode: 'full_ai', handoffTarget: 'any', handoffTimeoutSeconds: 30, handoffFallback: 'voicemail', voicemailEnabled: true, transcriptionEnabled: true, afterHoursBehavior: 'ai_full' }
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
    } else {
        form.reset();
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const navItems = mode === 'agent' 
    ? [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'channels', label: 'Channels', icon: Globe },
        { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
      ]
    : [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'installation', label: 'Install', icon: Plug },
      ];

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

  const widgetsUsingThisAgent = useMemo(() => {
    if (mode !== 'agent' || !bot) return [];
    return hubWidgets.filter(w => w.assignedAgentId === bot.id);
  }, [mode, bot, hubWidgets]);

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
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Name (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g. Finn" {...field} className="bg-muted/20 border-white/10" /></FormControl>
                            <FormDescription className="text-[10px]">What the AI calls itself during chat.</FormDescription>
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
                            <FormLabel className="text-xs text-muted-foreground font-normal">What should this agent try to achieve?</FormLabel>
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
                                    <p className="text-muted-foreground text-sm">Identity and basic settings.</p>
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

                        {activeTab === 'channels' && mode === 'agent' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-white">Channels</h2>
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 w-fit">
                                        <Info className="h-3.5 w-3.5 text-primary" />
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Channels route to the inbox by default. Enabling a channel here adds AI on top of your existing connections.
                                        </p>
                                    </div>
                                </div>

                                <Card className="bg-[#161b22] border-white/10 overflow-hidden">
                                    <div className="p-6 flex items-center justify-between border-b border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><MessageSquare className="h-5 w-5" /></div>
                                            <div>
                                                <h3 className="font-bold text-white">Web Chat</h3>
                                                <p className="text-xs text-muted-foreground">AI Intelligence for site visitors.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {activeConfigPath === 'web' ? (
                                                <Button variant="ghost" size="sm" onClick={() => setActiveConfigPath(null)} className="text-muted-foreground h-8 text-[10px] uppercase font-black">Close Config</Button>
                                            ) : (
                                                <Button variant="secondary" size="sm" onClick={() => setActiveConfigPath('web')} className="h-8 text-[10px] uppercase font-black">Configure</Button>
                                            )}
                                            <Switch checked={watchedValues.channelConfig?.web?.enabled} onCheckedChange={(val) => form.setValue('channelConfig.web.enabled', val)} />
                                        </div>
                                    </div>
                                    {activeConfigPath === 'web' && (
                                        <div className="p-6 bg-black/20 border-t border-white/5">
                                            {renderChannelConfig('web')}
                                        </div>
                                    )}
                                </Card>
                                
                                <p className="text-center py-12 text-muted-foreground italic text-xs">Other channels (SMS, Email, Phone) coming soon.</p>
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
