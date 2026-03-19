
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Bot as BotData, User, HelpCenter, Hub, Space } from '@/lib/data';
import { 
  Bot as BotIcon, 
  X, 
  Check, 
  Loader2, 
  MessageSquare, 
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
  EyeOff,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Users,
  FilePlus,
  Briefcase,
  Star,
  Headset,
  Workflow
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as db from '@/lib/db';

const agentSettingsSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  hubId: z.string().optional(),
  spaceId: z.string().optional(),
  ownerType: z.string().optional(),
  ownerId: z.string().optional(),
  
  // Tab 1: General
  name: z.string().min(1, 'Internal name is required.'),
  webAgentName: z.string().min(1, 'Agent name is required.'),
  roleTitle: z.string().optional(),
  isEnabled: z.boolean().default(true),
  aiEnabled: z.boolean().default(true),
  tone: z.enum(['formal', 'friendly', 'expert', 'direct', 'warm']).default('friendly'),
  voiceNotes: z.string().optional(),
  primaryGoal: z.string().min(1, 'Primary goal is required.'),
  closingTemplate: z.string().optional(),
  escalationRules: z.object({
    orderValueThresholdEnabled: z.boolean().default(false),
    orderValueThreshold: z.coerce.number().optional(),
    frustrationEnabled: z.boolean().default(true),
    unansweredLoopEnabled: z.boolean().default(true),
    complexRequestEnabled: z.boolean().default(true),
    notifyEmail: z.string().optional()
  }),

  // Tab 2: Knowledge
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    whatYouDo: z.string().optional(),
    targetAudience: z.string().optional(),
    hours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiation: z.string().optional(),
    forbiddenTopics: z.string().optional(),
  }),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  products: z.array(z.object({ id: z.string(), name: z.string(), price: z.string().optional(), description: z.string(), triggers: z.string() })).optional(),
  faqs: z.array(z.object({ id: z.string(), question: z.string(), answer: z.string() })).optional(),
  objections: z.array(z.object({ id: z.string(), objection: z.string(), response: z.string() })).optional(),
  qualificationFlow: z.array(z.object({ id: z.string(), question: z.string(), note: z.string().optional(), goal: z.string(), pricingPolicy: z.string() })).optional(),

  // Tab 3: Channels
  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(false),
      agentDisplayName: z.string().optional(),
      greeting: z.object({ text: z.string(), returningText: z.string().optional() }),
      quickReplies: z.array(z.object({ id: z.string(), name: z.string(), trigger: z.string(), options: z.array(z.string()) })).optional(),
      capture: z.object({ timing: z.string(), fields: z.object({ name: z.boolean(), email: z.boolean(), phone: z.boolean(), company: z.boolean() }) }),
      afterHours: z.object({ mode: z.string(), message: z.string().optional() })
    }).optional(),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      allowMms: z.boolean().default(false),
      capture: z.object({ email: z.string(), name: z.string(), message: z.string().optional() }),
      escalation: { 
        keywords: z.array(z.string()), 
        message: z.string(), 
        sentiment: z.boolean() 
      },
      afterHours: z.object({ mode: z.string(), message: z.string().optional() })
    }).optional(),
    phone: z.object({
      enabled: z.boolean().default(false),
      mode: z.string(),
      transferNumber: z.string().optional(),
      scripts: z.object({ greeting: z.string(), handoff: z.string().optional(), voicemail: z.string().optional() }),
      behaviour: z.object({ transcribe: z.boolean(), afterHoursAiOnly: z.boolean(), voicemailFallback: z.boolean(), greetingEnabled: z.boolean(), maxDuration: z.string(), keywords: z.array(z.string()) }),
      afterHours: z.object({ mode: z.string(), redirectNumber: z.string().optional() })
    }).optional(),
    email: z.object({
      enabled: z.boolean().default(false),
      workflow: z.object({ approval: z.string(), delay: z.string(), threading: z.string() }),
      format: z.object({ signOff: z.string(), length: z.string(), alwaysInclude: z.string(), subject: z.string() }),
      escalation: z.object({ holdForValue: z.boolean(), holdForFrustration: z.boolean(), holdForLegal: z.boolean(), holdForAttachment: z.boolean(), holdForVip: z.boolean(), keywords: z.array(z.string()), sentiment: z.boolean() })
    }).optional()
  }).optional()
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
  activeHub?: Hub | null;
  activeSpace?: Space | null;
}

const DEFAULT_QUALIFICATION_GOAL = "Provide information and let customer decide";
const DEFAULT_PRICING_POLICY = "Always request a quote — never state prices";

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  appUser,
  allUsers,
  helpCenters,
  activeHub,
  activeSpace,
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [activeChannel, setActiveChannel] = useState('web');
  const { toast } = useToast();

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: 'My AI Agent',
      webAgentName: 'Assistant',
      roleTitle: '',
      isEnabled: true,
      aiEnabled: true,
      tone: 'friendly',
      voiceNotes: '',
      primaryGoal: DEFAULT_QUALIFICATION_GOAL,
      closingTemplate: '',
      escalationRules: {
        orderValueThresholdEnabled: false,
        frustrationEnabled: true,
        unansweredLoopEnabled: true,
        complexRequestEnabled: true,
        notifyEmail: ''
      },
      businessContext: {
        businessName: '',
        location: '',
        whatYouDo: '',
        targetAudience: '',
        hours: '',
        minOrder: '',
        turnaround: '',
        differentiation: '',
        forbiddenTopics: '',
      },
      products: [{ id: 'prod-1', name: '', price: '', description: '', triggers: '' }],
      faqs: [{ id: 'faq-1', question: '', answer: '' }],
      objections: [{ id: 'obj-1', objection: '', response: '' }],
      qualificationFlow: [
        { id: 'q1', question: "What do you need?", goal: DEFAULT_QUALIFICATION_GOAL, pricingPolicy: DEFAULT_PRICING_POLICY },
        { id: 'q2', question: "How many / what quantity?", goal: DEFAULT_QUALIFICATION_GOAL, pricingPolicy: DEFAULT_PRICING_POLICY },
        { id: 'q3', question: "What is your timeline?", goal: DEFAULT_QUALIFICATION_GOAL, pricingPolicy: DEFAULT_PRICING_POLICY }
      ],
      channelConfig: {
        web: {
          enabled: false,
          agentDisplayName: '',
          greeting: { text: 'Hi! How can I help you today?', returningText: '' },
          quickReplies: [{ id: 'qr-1', name: 'Opening message', trigger: 'On greeting', options: ["Tell me more", "Get a quote", "Contact us"] }],
          capture: { timing: 'after', fields: { name: true, email: true, phone: false, company: false } },
          afterHours: { mode: 'ai_full', message: '' }
        },
        sms: {
          enabled: false,
          openingText: "Hi! You've reached us. How can I help?",
          maxLength: 160,
          allowMms: false,
          capture: { email: 'natural_quote', name: 'natural', message: '' },
          escalation: { keywords: ['agent', 'human', 'person'], message: 'Let me connect you with a team member now.', sentiment: true },
          afterHours: { mode: 'delayed_human', message: '' }
        },
        phone: {
          enabled: false,
          mode: 'triage',
          transferNumber: '',
          scripts: { greeting: 'Thank you for calling. How can I help you today?', handoff: '', voicemail: '' },
          behaviour: { transcribe: true, afterHoursAiOnly: false, voicemailFallback: true, greetingEnabled: true, maxDuration: '5', keywords: ['manager', 'human', 'transfer'] },
          afterHours: { mode: 'ai_message', redirectNumber: '' }
        },
        email: {
          enabled: false,
          workflow: { approval: 'auto_exceptions', delay: '2-5', threading: 'thread' },
          format: { signOff: '', length: 'standard', alwaysInclude: '', subject: '' },
          escalation: { holdForValue: true, holdForFrustration: true, holdForLegal: true, holdForAttachment: true, holdForVip: false, keywords: ['urgent', 'manager', 'complaint', 'legal'], sentiment: true }
        }
      }
    },
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({ control: form.control, name: "products" as any });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" as any });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" as any });
  const { fields: qualFields, append: appendQual, remove: removeQual } = useFieldArray({ control: form.control, name: "qualificationFlow" as any });

  useEffect(() => {
    if (bot) {
      form.reset(bot as any);
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const onSubmit = (values: AgentSettingsFormValues) => {
    onSave(values as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className={cn("h-2 w-2 rounded-full", watchedValues.isEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600")} />
                        <div>
                            <h2 className="text-sm font-bold text-white leading-none">{watchedValues.name || 'AI Agent'}</h2>
                            <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">BotForge Config</p>
                        </div>
                    </div>

                    <nav className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/5">
                        {[
                            { id: 'general', label: 'General', icon: Settings },
                            { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
                            { id: 'channels', label: 'Channels', icon: Globe }
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                                    activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"
                                )}
                            >
                                <item.icon className="h-3.5 w-3.5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <Button type="submit" className="rounded-full h-9 px-6 font-black">Save Changes</Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full"><X className="h-5 w-5" /></Button>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-10 max-w-4xl mx-auto space-y-12 pb-32">
                    {activeTab === 'general' && (
                        <div className="space-y-10 animate-in fade-in duration-300 text-left">
                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Agent Identity</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <FormField control={form.control} name="webAgentName" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Agent Name</FormLabel><FormControl><Input placeholder="e.g. B" {...field} /></FormControl><FormDescription className="text-[10px]">One word only. Used for trust and branding.</FormDescription></FormItem>
                                    )} />
                                    <FormField control={form.control} name="roleTitle" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Role Title</FormLabel><FormControl><Input placeholder="e.g. Sales Concierge" {...field} /></FormControl></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Internal Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Tone & Personality</h3>
                                <FormField control={form.control} name="tone" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Tone Selector</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="formal">Formal</SelectItem><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="expert">Expert</SelectItem><SelectItem value="direct">Direct</SelectItem><SelectItem value="warm">Warm</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name="voiceNotes" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Voice Notes</FormLabel><FormControl><Textarea placeholder="Specific brand-voice rules..." {...field} /></FormControl></FormItem>
                                )} />
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Conversation Goal</h3>
                                <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Primary Goal</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Guide to order directly">Guide to order directly</SelectItem><SelectItem value="Capture details and send quote">Capture details and send quote</SelectItem><SelectItem value="Book a callback">Book a callback</SelectItem><SelectItem value="Collect email for follow-up">Collect email for follow-up</SelectItem><SelectItem value="Provide information and let customer decide">Provide information and let customer decide</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name="closingTemplate" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Closing Message Template</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                                )} />
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Shared Escalation Rules</h3>
                                <div className="grid gap-4">
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                                        <Label className="text-xs">Order Value Threshold</Label>
                                        <div className="flex items-center gap-3">
                                            <Input type="number" placeholder="$500" className="w-24 h-8" />
                                            <Switch checked={watchedValues.escalationRules.orderValueThresholdEnabled} onCheckedChange={(val) => form.setValue('escalationRules.orderValueThresholdEnabled', val)} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                                        <Label className="text-xs">Escalate on Frustration</Label>
                                        <Switch checked={watchedValues.escalationRules.frustrationEnabled} onCheckedChange={(val) => form.setValue('escalationRules.frustrationEnabled', val)} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                                        <Label className="text-xs">Escalate on Unanswered Loops</Label>
                                        <Switch checked={watchedValues.escalationRules.unansweredLoopEnabled} onCheckedChange={(val) => form.setValue('escalationRules.unansweredLoopEnabled', val)} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                                        <Label className="text-xs">Complex or custom request</Label>
                                        <Switch checked={watchedValues.escalationRules.complexRequestEnabled} onCheckedChange={(val) => form.setValue('escalationRules.complexRequestEnabled', val)} />
                                    </div>
                                    <FormField control={form.control} name="escalationRules.notifyEmail" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Escalation Notify Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                    )} />
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'knowledge' && (
                        <div className="space-y-12 animate-in fade-in duration-300 text-left">
                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Business Context</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <FormField control={form.control} name="businessContext.businessName" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Business Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="businessContext.location" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Location / Service Area</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="businessContext.whatYouDo" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">What you do</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="businessContext.targetAudience" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Who your customers are</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-6">
                                    <FormField control={form.control} name="businessContext.hours" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Business Hours</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="businessContext.minOrder" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Min Order / Delivery Area</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="businessContext.turnaround" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Turnaround / Lead Times</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="businessContext.differentiation" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">What makes you different</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="businessContext.forbiddenTopics" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Topics the agent must never discuss</FormLabel><FormControl><Input placeholder="Comma-separated..." {...field} /></FormControl></FormItem>
                                )} />
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Products & Services</h3>
                                <div className="space-y-4">
                                    {productFields.map((field, index) => (
                                        <Card key={field.id} className="bg-[#161b22] border-white/10 relative">
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeProduct(index)}><Trash2 className="h-3 w-3" /></Button>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input placeholder="Product Name" {...form.register(`products.${index}.name` as any)} />
                                                    <Input placeholder="Price / Range" {...form.register(`products.${index}.price` as any)} />
                                                </div>
                                                <Textarea placeholder="Description" {...form.register(`products.${index}.description` as any)} />
                                                <Input placeholder="When to recommend (signals/keywords)" {...form.register(`products.${index}.triggers` as any)} className="border-primary/20" />
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendProduct({ id: Date.now().toString(), name: '', price: '', description: '', triggers: '' })}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Common Questions (FAQs)</h3>
                                <div className="space-y-4">
                                    {faqFields.map((field, index) => (
                                        <Card key={field.id} className="bg-[#161b22] border-white/10">
                                            <CardContent className="p-6 space-y-4">
                                                <Input placeholder="Customer asks..." {...form.register(`faqs.${index}.question` as any)} />
                                                <Textarea placeholder="Your answer" {...form.register(`faqs.${index}.answer` as any)} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendFaq({ id: Date.now().toString(), question: '', answer: '' })}><Plus className="h-4 w-4 mr-2" /> Add FAQ</Button>
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Objections & How to handle them</h3>
                                <div className="space-y-4">
                                    {objectionFields.map((field, index) => (
                                        <Card key={field.id} className="bg-[#161b22] border-white/10">
                                            <CardContent className="p-6 space-y-4">
                                                <Input placeholder="Objection..." {...form.register(`objections.${index}.objection` as any)} />
                                                <Textarea placeholder="How to respond" {...form.register(`objections.${index}.response` as any)} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendObjection({ id: Date.now().toString(), objection: '', response: '' })}><Plus className="h-4 w-4 mr-2" /> Add Objection</Button>
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Qualification Flow</h3>
                                <div className="space-y-4">
                                    {qualFields.map((field, index) => (
                                        <Card key={field.id} className="bg-[#161b22] border-white/10 relative">
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeQual(index)}><Trash2 className="h-3 w-3" /></Button>
                                            <CardContent className="p-6 space-y-4">
                                                <Input placeholder="Step question" {...form.register(`qualificationFlow.${index}.question` as any)} />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField control={form.control} name={`qualificationFlow.${index}.goal`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-[10px] uppercase font-bold opacity-50">Goal</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Guide to order directly">Order directly</SelectItem><SelectItem value="Capture details and send quote">Capture & Quote</SelectItem><SelectItem value="Book a callback">Book Callback</SelectItem><SelectItem value="Collect email for follow-up">Collect Email</SelectItem><SelectItem value="Provide information and let customer decide">Provide Info</SelectItem></SelectContent></Select>
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`qualificationFlow.${index}.pricingPolicy`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-[10px] uppercase font-bold opacity-50">Pricing Policy</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="State prices directly">State prices directly</SelectItem><SelectItem value="Ranges only (\"from...\")">Ranges only</SelectItem><SelectItem value="Always request a quote — never state prices">Always request quote</SelectItem></SelectContent></Select>
                                                        </FormItem>
                                                    )} />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendQual({ id: Date.now().toString(), question: '', goal: DEFAULT_QUALIFICATION_GOAL, pricingPolicy: DEFAULT_PRICING_POLICY })}><Plus className="h-4 w-4 mr-2" /> Add Qualification Step</Button>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'channels' && (
                        <div className="space-y-12 animate-in fade-in duration-300 text-left">
                            <Tabs defaultValue="web" onValueChange={setActiveChannel} className="w-full">
                                <TabsList className="bg-white/[0.03] border-white/10 p-1 mb-8">
                                    <TabsTrigger value="web" className="gap-2"><MessageSquare className="h-3.5 w-3.5" /> Web Chat</TabsTrigger>
                                    <TabsTrigger value="sms" className="gap-2"><Smartphone className="h-3.5 w-3.5" /> SMS</TabsTrigger>
                                    <TabsTrigger value="phone" className="gap-2"><Phone className="h-3.5 w-3.5" /> Phone</TabsTrigger>
                                    <TabsTrigger value="email" className="gap-2"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
                                </TabsList>

                                <TabsContent value="web" className="space-y-10">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] mb-6">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold">Enable Web Chat for this Agent</Label>
                                            <p className="text-xs text-muted-foreground">Allow this agent to handle conversations from web widgets.</p>
                                        </div>
                                        <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => (
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        )} />
                                    </div>

                                    <div className={cn("grid grid-cols-2 gap-10 transition-opacity", !watchedValues.channelConfig?.web?.enabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Greeting</Label>
                                                <FormField control={form.control} name="channelConfig.web.agentDisplayName" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Agent Display Name Override</FormLabel><FormControl><Input placeholder="Inherits from General..." {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Opening Greeting</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.web.greeting.returningText" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Returning Customer Greeting</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Lead Capture</Label>
                                                <FormField control={form.control} name="channelConfig.web.capture.timing" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Capture Timing</FormLabel><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col gap-2 mt-2"><div className="flex items-center gap-2"><RadioGroupItem value="after" id="cap-after" /><Label htmlFor="cap-after">After first response</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="before" id="cap-before" /><Label htmlFor="cap-before">Before first response</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="escalation" id="cap-esc" /><Label htmlFor="cap-esc">On escalation</Label></div></RadioGroup></FormItem>
                                                )} />
                                                <div className="grid grid-cols-2 gap-4 pt-4">
                                                    {['name', 'email', 'phone', 'company'].map(f => (
                                                        <div key={f} className="flex items-center gap-2"><Checkbox checked={(watchedValues.channelConfig?.web?.capture?.fields as any)?.[f]} onCheckedChange={(val) => form.setValue(`channelConfig.web.capture.fields.${f}` as any, val)} /><Label className="capitalize text-xs">{f}</Label></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="sms" className="space-y-10">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] mb-6">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold">Enable SMS for this Agent</Label>
                                            <p className="text-xs text-muted-foreground">Allow this agent to handle inbound SMS messages.</p>
                                        </div>
                                        <FormField control={form.control} name="channelConfig.sms.enabled" render={({ field }) => (
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        )} />
                                    </div>

                                    <div className={cn("space-y-10 transition-opacity", !watchedValues.channelConfig?.sms?.enabled && "opacity-40 pointer-events-none")}>
                                        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                                            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-500 leading-relaxed font-bold">SMS hard constraints: No quick replies, no formatting, no images (unless MMS). Plain text only.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-10">
                                            <div className="space-y-8">
                                                <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Opening Text</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormDescription className="text-[10px]">Character count: {field.value?.length || 0}/160</FormDescription></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.sms.maxLength" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Max Response Length</FormLabel><Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="160">160 Chars (1 SMS)</SelectItem><SelectItem value="320">320 Chars (2 SMS)</SelectItem><SelectItem value="0">No Limit</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                            </div>
                                            <div className="space-y-8">
                                                <FormField control={form.control} name="channelConfig.sms.escalation.message" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Handoff Message</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.sms.escalation.keywords" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Handoff Keywords</FormLabel><FormControl><Input placeholder="agent, human, person" value={field.value?.join(', ')} onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="phone" className="space-y-10">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] mb-6">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold">Enable Phone for this Agent</Label>
                                            <p className="text-xs text-muted-foreground">Allow this agent to handle voice calls.</p>
                                        </div>
                                        <FormField control={form.control} name="channelConfig.phone.enabled" render={({ field }) => (
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        )} />
                                    </div>

                                    <div className={cn("grid grid-cols-2 gap-10 transition-opacity", !watchedValues.channelConfig?.phone?.enabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-8">
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Call Mode</Label>
                                                <FormField control={form.control} name="channelConfig.phone.mode" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Handling Mode</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="full_ai">Full AI Resolution</SelectItem><SelectItem value="triage">AI Triage + Warm Handoff</SelectItem><SelectItem value="receptionist">Receptionist Only</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                                {watchedValues.channelConfig?.phone?.mode === 'triage' && (
                                                    <FormField control={form.control} name="channelConfig.phone.transferNumber" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-xs">Transfer to Number</FormLabel><FormControl><Input placeholder="+1..." {...field} /></FormControl></FormItem>
                                                    )} />
                                                )}
                                            </section>
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Scripts</Label>
                                                <FormField control={form.control} name="channelConfig.phone.scripts.greeting" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">AI Greeting Script</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.phone.scripts.handoff" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Warm handoff intro script</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.phone.scripts.voicemail" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Voicemail Script</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                                )} />
                                            </section>
                                        </div>
                                        <div className="space-y-8">
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Behaviour</Label>
                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]">
                                                        <Label className="text-xs">Transcribe Calls</Label>
                                                        <Switch checked={watchedValues.channelConfig?.phone?.behaviour?.transcribe} onCheckedChange={(val) => form.setValue('channelConfig.phone.behaviour.transcribe' as any, val)} />
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]">
                                                        <Label className="text-xs">Voicemail Fallback</Label>
                                                        <Switch checked={watchedValues.channelConfig?.phone?.behaviour?.voicemailFallback} onCheckedChange={(val) => form.setValue('channelConfig.phone.behaviour.voicemailFallback' as any, val)} />
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]">
                                                        <Label className="text-xs">AI Greeting Enabled</Label>
                                                        <Switch checked={watchedValues.channelConfig?.phone?.behaviour?.greetingEnabled} onCheckedChange={(val) => form.setValue('channelConfig.phone.behaviour.greetingEnabled' as any, val)} />
                                                    </div>
                                                </div>
                                                <FormField control={form.control} name="channelConfig.phone.behaviour.maxDuration" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Max Call Duration</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="2">2 Minutes</SelectItem><SelectItem value="5">5 Minutes</SelectItem><SelectItem value="10">10 Minutes</SelectItem><SelectItem value="0">No Limit</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.phone.behaviour.keywords" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Escalation Keywords</FormLabel><FormControl><Input placeholder="manager, human, transfer" value={field.value?.join(', ')} onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))} /></FormControl></FormItem>
                                                )} />
                                            </section>
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">After Hours</Label>
                                                <FormField control={form.control} name="channelConfig.phone.afterHours.mode" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">After Hours Mode</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ai_full">Full AI Resolution</SelectItem><SelectItem value="ai_message">AI Triage & Message</SelectItem><SelectItem value="voicemail">Voicemail Only</SelectItem><SelectItem value="redirect">Redirect to On-Call</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                                {watchedValues.channelConfig?.phone?.afterHours?.mode === 'redirect' && (
                                                    <FormField control={form.control} name="channelConfig.phone.afterHours.redirectNumber" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-xs">Redirect Number</FormLabel><FormControl><Input placeholder="+1..." {...field} /></FormControl></FormItem>
                                                    )} />
                                                )}
                                            </section>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="email" className="space-y-10">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.03] mb-6">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold">Enable Email for this Agent</Label>
                                            <p className="text-xs text-muted-foreground">Allow this agent to handle inbound emails.</p>
                                        </div>
                                        <FormField control={form.control} name="channelConfig.email.enabled" render={({ field }) => (
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        )} />
                                    </div>

                                    <div className={cn("grid grid-cols-2 gap-10 transition-opacity", !watchedValues.channelConfig?.email?.enabled && "opacity-40 pointer-events-none")}>
                                        <div className="space-y-8">
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Workflow</Label>
                                                <FormField control={form.control} name="channelConfig.email.workflow.approval" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Approval Workflow</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="auto">Auto-send immediately</SelectItem><SelectItem value="auto_exceptions">Auto-send, flag exceptions</SelectItem><SelectItem value="manual">Human approves every send</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.email.workflow.delay" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Reply Delay</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="immediate">Immediate</SelectItem><SelectItem value="2-5">2–5 minutes</SelectItem><SelectItem value="15-30">15–30 minutes</SelectItem></SelectContent></Select></FormItem>
                                                )} />
                                            </section>
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Format</Label>
                                                <FormField control={form.control} name="channelConfig.email.format.signOff" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Default Sign-off</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.email.format.alwaysInclude" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Always include in every reply</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="channelConfig.email.format.subject" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Subject Line Template (Outbound)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                                )} />
                                            </section>
                                        </div>
                                        <div className="space-y-8">
                                            <section className="space-y-4">
                                                <Label className="text-[10px] uppercase font-black tracking-widest text-primary">Escalation Triggers</Label>
                                                <div className="grid gap-2">
                                                    {[
                                                        { key: 'holdForValue', label: 'Hold for review: order value' },
                                                        { key: 'holdForFrustration', label: 'Hold for review: frustration or complaint' },
                                                        { key: 'holdForLegal', label: 'Hold for review: legal or contract' },
                                                        { key: 'holdForAttachment', label: 'Hold for review: email contains attachment' },
                                                        { key: 'holdForVip', label: 'Hold for review: known VIP domain' },
                                                    ].map(t => (
                                                        <div key={t.key} className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]">
                                                            <Label className="text-xs">{t.label}</Label>
                                                            <Switch checked={(watchedValues.channelConfig?.email?.escalation as any)?.[t.key]} onCheckedChange={(val) => form.setValue(`channelConfig.email.escalation.${t.key}` as any, val)} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <FormField control={form.control} name="channelConfig.email.escalation.keywords" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Escalation Keywords</FormLabel><FormControl><Input placeholder="urgent, manager, complaint, legal" value={field.value?.join(', ')} onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))} /></FormControl></FormItem>
                                                )} />
                                            </section>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </ScrollArea>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
