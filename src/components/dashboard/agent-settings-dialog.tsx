'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
import { 
  Settings, 
  BookOpen, 
  Globe, 
  X, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Smartphone, 
  Phone, 
  Mail, 
  Search,
  Loader2,
  Sparkles,
  UserCheck,
  Flag,
  ShieldAlert,
  Clock,
  Zap,
  Target,
  BrainCircuit,
  Users,
  Palette,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  MessageCircle,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { crawlWebsiteAction } from '@/app/actions/chat';
import { useToast } from '@/hooks/use-toast';

const agentSettingsSchema = z.object({
  id: z.string().optional(),
  type: z.literal('agent').default('agent'),

  // Intelligence - Identity
  name: z.string().min(1, 'Internal Name is required'),
  webAgentName: z.string().min(1, 'Public Agent Name is required'),
  roleTitle: z.string().optional(),

  // Intelligence - Personality
  tone: z.enum(['friendly', 'formal', 'expert', 'direct', 'warm']).default('friendly'),
  voiceNotes: z.string().optional(),
  responseLength: z.enum(['short', 'balanced', 'detailed']).default('balanced'),
  proactivity: z.enum(['low', 'balanced', 'high']).default('balanced'),
  assertiveness: z.enum(['low', 'balanced', 'high']).default('balanced'),

  // Intelligence - Goals
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  secondaryGoal: z.string().optional(),
  closingTemplate: z.string().optional(),
  successCriteria: z.string().optional(),

  // Intelligence - Escalation
  escalation: z.object({
    enabled: z.boolean().default(true),
    notifyEmail: z.string().email('Valid email required').or(z.literal('')),
    highValue: z.object({
      enabled: z.boolean().default(false),
      threshold: z.coerce.number().default(500),
    }),
    frustration: z.boolean().default(true),
    repeatedFailures: z.boolean().default(true),
    complexRequests: z.boolean().default(true),
    maxFailures: z.coerce.number().default(2),
  }),

  // Intelligence - Safety
  safety: z.object({
    neverPretendHuman: z.boolean().default(true),
    askClarifyingWhenUnsure: z.boolean().default(true),
    offerHumanWhenUnsure: z.boolean().default(true),
    avoidHallucination: z.boolean().default(true),
    strictMode: z.boolean().default(false),
  }),

  // Knowledge - Business Context
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    targetAudience: z.string().optional(),
    businessHours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiators: z.string().optional(),
    forbiddenTopics: z.string().optional(),
  }),

  // Knowledge - Sources
  allowedHelpCenterIds: z.array(z.string()).default([]),

  // Knowledge - Repeatable Lists
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    priceRange: z.string().optional(),
    description: z.string(),
    recommendationTriggers: z.string(),
  })).default([]),

  faqs: z.array(z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string(),
  })).default([]),

  objections: z.array(z.object({
    id: z.string(),
    objection: z.string(),
    response: z.string(),
  })).default([]),

  qualificationFlow: z.array(z.object({
    id: z.string(),
    question: z.string(),
    note: z.string().optional(),
  })).default([]),

  policies: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
  })).default([]),

  scripts: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
  })).default([]),

  pricingPolicy: z.string().optional(),

  // Channels
  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(true),
      displayNameOverride: z.string().optional(),
      greeting: z.object({
        text: z.string().default('Hi! How can I help today?'),
        returningText: z.string().default('Welcome back. How can I help today?'),
      }),
      leadCapture: z.object({
        enabled: z.boolean().default(true),
        required: z.boolean().default(false),
        timing: z.enum(['before', 'after']).default('after'),
        captureMessage: z.string().default('Before I connect you with the right next step, could I grab your name and email?'),
        fields: z.object({
          name: z.boolean().default(true),
          email: z.boolean().default(true),
          phone: z.boolean().default(false),
        }),
      }),
      quickReplies: z.array(z.string()).default(['Pricing', 'Support', 'Talk to a human']),
      handoffKeywords: z.array(z.string()).default(['agent', 'human', 'person']),
      sentimentEscalation: z.boolean().default(true),
      afterHoursMode: z.enum(['ai_handles_everything', 'respond_and_notify']).default('ai_handles_everything'),
      afterHoursMessage: z.string().default("We're currently offline, but I can still help and make sure the team follows up if needed."),
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().default('Hi! How can I help?'),
      maxResponseLength: z.coerce.number().default(160),
      mmsEnabled: z.boolean().default(false),
      collectNameMode: z.enum(['none', 'natural']).default('natural'),
      collectEmailMode: z.enum(['none', 'natural']).default('natural'),
      leadCaptureMessage: z.string().default("If you'd like, I can grab your email and have the team follow up with more details."),
      handoffKeywords: z.array(z.string()).default(['agent', 'human', 'person', 'call me']),
      handoffMessage: z.string().default("No problem — I’ll have someone follow up with you soon."),
      sentimentEscalation: z.boolean().default(true),
      afterHoursMode: z.enum(['delayed_human', 'ai_only']).default('delayed_human'),
      afterHoursMessage: z.string().default("Thanks for texting. We're currently offline, but the team will follow up as soon as possible."),
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      operationMode: z.enum(['full_ai', 'handoff', 'receptionist']).default('handoff'),
      transferNumber: z.string().optional(),
      greetingScript: z.string().default('Thank you for calling. How can I help today?'),
      handoffScript: z.string().default('I’m going to connect you with a member of the team now.'),
      voicemailScript: z.string().default('We’re unavailable right now. Please leave your name, number, and what you need, and someone will get back to you.'),
      transcribeCalls: z.boolean().default(true),
      voicemailFallback: z.boolean().default(true),
      aiGreetingEnabled: z.boolean().default(true),
      afterHoursAiOnly: z.boolean().default(false),
      maxDurationMinutes: z.coerce.number().default(5),
      escalationKeywords: z.array(z.string()).default(['human', 'agent', 'manager', 'representative']),
      afterHoursMode: z.enum(['ai_message_only', 'redirect']).default('ai_message_only'),
      afterHoursRedirectNumber: z.string().optional(),
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      approvalMode: z.enum(['auto', 'auto_exceptions', 'manual']).default('auto_exceptions'),
      replyDelay: z.enum(['immediate', '2_5_minutes', '10_plus_minutes']).default('2_5_minutes'),
      threadingBehavior: z.enum(['reply_in_thread', 'new_thread']).default('reply_in_thread'),
      standardSignoff: z.string().default('Best regards, {{agent_name}}'),
      responseLength: z.enum(['short', 'standard', 'detailed']).default('standard'),
      alwaysIncludeBlock: z.string().optional(),
      subjectTemplate: z.string().optional(),
      escalation: z.object({
        holdForHighValue: z.boolean().default(true),
        holdForFrustration: z.boolean().default(true),
        holdForLegal: z.boolean().default(true),
        holdForAttachment: z.boolean().default(true),
        holdForVip: z.boolean().default(false),
      }),
      escalationKeywords: z.array(z.string()).default(['urgent', 'manager', 'legal', 'complaint']),
      sentimentEscalation: z.boolean().default(true),
    })
  })
});

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>;

const defaultValues: AgentSettingsFormValues = {
  name: 'Support Agent V1',
  webAgentName: 'Assistant',
  roleTitle: 'Customer Support',
  tone: 'friendly',
  voiceNotes: '',
  responseLength: 'balanced',
  proactivity: 'balanced',
  assertiveness: 'balanced',
  primaryGoal: 'Provide helpful, accurate answers and guide the user toward the next best step.',
  secondaryGoal: 'Capture contact information when appropriate.',
  closingTemplate: 'Let me know if you need anything else!',
  successCriteria: 'The customer gets a clear answer, a qualified next step, or a human handoff.',
  escalation: {
    enabled: true,
    notifyEmail: '',
    highValue: { enabled: false, threshold: 500 },
    frustration: true,
    repeatedFailures: true,
    complexRequests: true,
    maxFailures: 2,
  },
  safety: {
    neverPretendHuman: true,
    askClarifyingWhenUnsure: true,
    offerHumanWhenUnsure: true,
    avoidHallucination: true,
    strictMode: false,
  },
  businessContext: {
    businessName: '',
    location: '',
    description: '',
    targetAudience: '',
    businessHours: '',
    minOrder: '',
    turnaround: '',
    differentiators: '',
    forbiddenTopics: '',
  },
  allowedHelpCenterIds: [],
  products: [],
  faqs: [],
  objections: [],
  qualificationFlow: [],
  policies: [],
  scripts: [],
  pricingPolicy: 'Always request a quote when pricing depends on scope, quantity, or timeline.',
  channelConfig: {
    web: {
      enabled: true,
      displayNameOverride: '',
      greeting: {
        text: 'Hi! How can I help today?',
        returningText: 'Welcome back. How can I help today?',
      },
      leadCapture: {
        enabled: true,
        required: false,
        timing: 'after',
        captureMessage: 'Before I connect you with the right next step, could I grab your name and email?',
        fields: { name: true, email: true, phone: false },
      },
      quickReplies: ['Pricing', 'Support', 'Talk to a human'],
      handoffKeywords: ['agent', 'human', 'person'],
      sentimentEscalation: true,
      afterHoursMode: 'ai_handles_everything',
      afterHoursMessage: "We're currently offline, but I can still help and make sure the team follows up if needed.",
    },
    sms: {
      enabled: false,
      openingText: 'Hi! How can I help?',
      maxResponseLength: 160,
      mmsEnabled: false,
      collectNameMode: 'natural',
      collectEmailMode: 'natural',
      leadCaptureMessage: "If you'd like, I can grab your email and have the team follow up with more details.",
      handoffKeywords: ['agent', 'human', 'person', 'call me'],
      handoffMessage: "No problem — I’ll have someone follow up with you soon.",
      sentimentEscalation: true,
      afterHoursMode: 'delayed_human',
      afterHoursMessage: "Thanks for texting. We're currently offline, but the team will follow up as soon as possible.",
    },
    phone: {
      enabled: false,
      operationMode: 'handoff',
      transferNumber: '',
      greetingScript: 'Thank you for calling. How can I help today?',
      handoffScript: 'I’m going to connect you with a member of the team now.',
      voicemailScript: 'We’re unavailable right now. Please leave your name, number, and what you need, and someone will get back to you.',
      transcribeCalls: true,
      voicemailFallback: true,
      aiGreetingEnabled: true,
      afterHoursAiOnly: false,
      maxDurationMinutes: 5,
      escalationKeywords: ['human', 'agent', 'manager', 'representative'],
      afterHoursMode: 'ai_message_only',
      afterHoursRedirectNumber: '',
    },
    email: {
      enabled: false,
      approvalMode: 'auto_exceptions',
      replyDelay: '2_5_minutes',
      threadingBehavior: 'reply_in_thread',
      standardSignoff: 'Best regards, {{agent_name}}',
      responseLength: 'standard',
      alwaysIncludeBlock: '',
      subjectTemplate: '',
      escalation: {
        holdForHighValue: true,
        holdForFrustration: true,
        holdForLegal: true,
        holdForAttachment: true,
        holdForVip: false,
      },
      escalationKeywords: ['urgent', 'manager', 'legal', 'complaint'],
      sentimentEscalation: true,
    }
  }
};

interface AgentSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (data: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  helpCenters: HelpCenter[];
  allUsers: User[];
}

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  appUser,
  helpCenters,
  allUsers,
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('intelligence');
  const [activeChannel, setActiveChannel] = useState('web');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, startCrawlTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues,
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({ control: form.control, name: "products" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" });
  const { fields: qualificationFields, append: appendQualification, remove: removeQualification } = useFieldArray({ control: form.control, name: "qualificationFlow" });
  const { fields: policyFields, append: appendPolicy, remove: removePolicy } = useFieldArray({ control: form.control, name: "policies" });
  const { fields: scriptFields, append: appendScript, remove: removeScript } = useFieldArray({ control: form.control, name: "scripts" });

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        const mergedData = {
          ...defaultValues,
          ...bot,
          styleSettings: { ...defaultValues.styleSettings, ...(bot.styleSettings || {}) },
          identityCapture: { ...defaultValues.identityCapture, ...(bot.identityCapture || {}) },
          channelConfig: {
            ...defaultValues.channelConfig,
            ...(bot.channelConfig || {}),
            web: { 
              ...defaultValues.channelConfig.web, 
              ...(bot.channelConfig?.web || {}),
              greeting: { ...defaultValues.channelConfig.web.greeting, ...(bot.channelConfig?.web?.greeting || {}) },
              leadCapture: { ...defaultValues.channelConfig.web.leadCapture, ...(bot.channelConfig?.web?.leadCapture || {}) }
            },
            sms: { ...defaultValues.channelConfig.sms, ...(bot.channelConfig?.sms || {}) },
            phone: { ...defaultValues.channelConfig.phone, ...(bot.channelConfig?.phone || {}) },
            email: { ...defaultValues.channelConfig.email, ...(bot.channelConfig?.email || {}) },
          },
          businessContext: { ...defaultValues.businessContext, ...(bot.businessContext || {}) },
          escalation: { ...defaultValues.escalation, ...(bot.escalation || {}) },
          safety: { ...defaultValues.safety, ...(bot.safety || {}) },
        };
        form.reset(mergedData as any);
      } else {
        form.reset(defaultValues);
      }
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const handleCrawlWebsite = () => {
    let urlToCrawl = crawlUrl.trim();
    if (!urlToCrawl) return;
    if (!/^https?:\/\//i.test(urlToCrawl)) urlToCrawl = `https://${urlToCrawl}`;
    
    startCrawlTransition(async () => {
      try {
        const result = await crawlWebsiteAction(urlToCrawl);
        if (result.businessContext) {
          Object.entries(result.businessContext).forEach(([key, value]) => {
            if (value) form.setValue(`businessContext.${key as any}`, value);
          });
        }
        toast({ title: 'Crawl Successful' });
        setCrawlUrl('');
      } catch (e) {
        toast({ variant: 'destructive', title: 'Crawl Failed' });
      }
    });
  };

  const onSubmit = (values: AgentSettingsFormValues) => {
    const payload: BotData | Omit<BotData, 'id' | 'hubId'> = {
      ...(bot || {}),
      ...values,
      type: 'agent',
    } as any;

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10 text-left">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">{watchedValues.webAgentName || 'AI Brain'}</h2>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Global Configuration</p>
                  </div>
                </div>

                <nav className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/5">
                  {[
                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
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
              <div className="p-10 max-w-4xl mx-auto pb-32 space-y-16">
                {activeTab === 'intelligence' && (
                  <div className="space-y-16 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Users className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Identity</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="webAgentName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Public Agent Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Internal ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="roleTitle" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Official Role / Job Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Customer Support" /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Palette className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Personality</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="tone" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Primary Voice Persona</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                                <SelectItem value="formal">Professional & Polished</SelectItem>
                                <SelectItem value="expert">Expert & Reassuring</SelectItem>
                                <SelectItem value="direct">Direct & Efficient</SelectItem>
                                <SelectItem value="warm">Warm & Supportive</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="responseLength" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Response Length</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="short">Concise</SelectItem>
                                <SelectItem value="balanced">Balanced</SelectItem>
                                <SelectItem value="detailed">In-depth</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="voiceNotes" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Custom Voice & Style Constraints</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="e.g. Never use emojis. Use industry terminology." /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Target className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Goals & Success</h3>
                      </div>
                      <div className="grid gap-6">
                        <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Primary Conversation Objective</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="secondaryGoal" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Secondary Objective</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="closingTemplate" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Default Closing Signature</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldAlert className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Escalation & Handoff</h3>
                      </div>
                      <div className="space-y-4">
                        <FormField control={form.control} name="escalation.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                            <div className="space-y-0.5"><FormLabel className="text-sm font-bold">Enable Human Handoff</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="escalation.notifyEmail" render={({ field }) => (
                            <FormItem className="col-span-2"><FormLabel className="text-xs">Escalation Alert Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="escalation.frustration" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Frustration Alerts</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="escalation.repeatedFailures" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Unanswered Loops</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="escalation.highValue.enabled" render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">High-Value Escalation</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="escalation.highValue.threshold" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs">Threshold ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                          )} />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Safety & Ethics</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <FormField control={form.control} name="safety.neverPretendHuman" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Never claim to be human</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="safety.askClarifyingWhenUnsure" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Ask clarifying questions when unsure</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="safety.offerHumanWhenUnsure" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Offer human handoff when unsure</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="safety.avoidHallucination" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Avoid unsupported answers</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-16 animate-in fade-in duration-300">
                    <Card className="bg-primary/5 border-primary/20 border-2 overflow-hidden">
                      <CardHeader className="py-4 text-left">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                          <Sparkles className="h-4 w-4" /> Knowledge Autopilot
                        </CardTitle>
                        <CardDescription className="text-xs">This scans your site and drafts business knowledge automatically. Review before using in production.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3">
                          <Input placeholder="e.g. yourwebsite.com" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} className="bg-background" />
                          <Button type="button" onClick={handleCrawlWebsite} disabled={isCrawling} className="shrink-0 font-bold">
                            {isCrawling ? <Loader2 className="animate-spin h-4 w-4" /> : 'Start Extraction'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <BookOpen className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Business Context</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="businessContext.businessName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Legal/Official Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.location" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Service Area / HQ</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.description" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">What You Actually Do</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.targetAudience" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Ideal Customer Profile</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.businessHours" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Business Hours</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.minOrder" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Minimum Order / Lead Time</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.differentiators" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Key Differentiators (Why Us?)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.forbiddenTopics" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Strict Forbidden Topics</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                          <h3 className="text-sm font-bold uppercase tracking-widest">Connected Libraries</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Choose which libraries or help centers this agent can use as grounding sources.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {helpCenters.map(hc => (
                          <div key={hc.id} className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><BookOpen className="h-5 w-5" /></div>
                              <div>
                                <p className="text-sm font-bold">{hc.name}</p>
                                <Badge variant="outline" className="text-[9px] uppercase font-black px-1 h-4 mt-1">{hc.visibility}</Badge>
                              </div>
                            </div>
                            <Checkbox 
                              checked={watchedValues.allowedHelpCenterIds?.includes(hc.id)} 
                              onCheckedChange={(checked) => {
                                const current = watchedValues.allowedHelpCenterIds || [];
                                form.setValue('allowedHelpCenterIds', checked ? [...current, hc.id] : current.filter(id => id !== hc.id));
                              }} 
                            />
                          </div>
                        ))}
                        {helpCenters.length === 0 && (
                          <div className="col-span-full py-8 text-center border-2 border-dashed rounded-xl opacity-50">
                            <p className="text-sm italic">No libraries available in this Hub.</p>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Plus className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Grounding Sources</h3>
                      </div>
                      
                      <Tabs defaultValue="products">
                        <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                          <TabsTrigger value="products">Products</TabsTrigger>
                          <TabsTrigger value="faqs">FAQs</TabsTrigger>
                          <TabsTrigger value="objections">Objections</TabsTrigger>
                          <TabsTrigger value="qualification">Qualification</TabsTrigger>
                          <TabsTrigger value="policies">Policies</TabsTrigger>
                          <TabsTrigger value="scripts">Scripts</TabsTrigger>
                        </TabsList>

                        <TabsContent value="products" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendProduct({ id: `p-${Date.now()}`, name: '', description: '', recommendationTriggers: '' })}>Add Product</Button></div>
                          {productFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <div className="grid grid-cols-2 gap-4">
                                <Input placeholder="Product/Service Name" {...form.register(`products.${i}.name`)} className="bg-background font-bold" />
                                <Input placeholder="Price/Range" {...form.register(`products.${i}.priceRange`)} className="bg-background" />
                              </div>
                              <Textarea placeholder="Full Description" {...form.register(`products.${i}.description`)} rows={2} className="bg-background" />
                              <Input placeholder="When should the AI recommend this?" {...form.register(`products.${i}.recommendationTriggers`)} className="bg-background text-xs italic" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="faqs" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendFaq({ id: `f-${Date.now()}`, question: '', answer: '' })}>Add FAQ</Button></div>
                          {faqFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeFaq(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Customer asks" {...form.register(`faqs.${i}.question`)} className="bg-background font-bold" />
                              <Textarea placeholder="Answer" {...form.register(`faqs.${i}.answer`)} rows={2} className="bg-background" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="objections" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendObjection({ id: `o-${Date.now()}`, objection: '', response: '' })}>Add Objection</Button></div>
                          {objectionFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeObjection(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Objection" {...form.register(`objections.${i}.objection`)} className="bg-background font-bold" />
                              <Textarea placeholder="Best Response" {...form.register(`objections.${i}.response`)} rows={2} className="bg-background" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="qualification" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendQualification({ id: `q-${Date.now()}`, question: '', note: '' })}>Add Point</Button></div>
                          {qualificationFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeQualification(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Question" {...form.register(`qualificationFlow.${i}.question`)} className="bg-background font-bold" />
                              <Input placeholder="Why this matters" {...form.register(`qualificationFlow.${i}.note`)} className="bg-background text-xs" />
                            </div>
                          ))}
                          <Separator className="my-6" />
                          <FormField control={form.control} name="pricingPolicy" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider">Pricing Guidance</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                          )} />
                        </TabsContent>

                        <TabsContent value="policies" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendPolicy({ id: `pol-${Date.now()}`, title: '', content: '' })}>Add Policy</Button></div>
                          {policyFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removePolicy(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Policy Name" {...form.register(`policies.${i}.title`)} className="bg-background font-bold" />
                              <Textarea placeholder="Policy Details" {...form.register(`policies.${i}.content`)} rows={3} className="bg-background" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="scripts" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendScript({ id: `scr-${Date.now()}`, title: '', content: '' })}>Add Script</Button></div>
                          {scriptFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeScript(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Script Name" {...form.register(`scripts.${i}.title`)} className="bg-background font-bold" />
                              <Textarea placeholder="Approved Script / Messaging" {...form.register(`scripts.${i}.content`)} rows={3} className="bg-background" />
                            </div>
                          ))}
                        </TabsContent>
                      </Tabs>
                    </section>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Tabs value={activeChannel} onValueChange={setActiveChannel}>
                      <TabsList className="bg-white/5 border border-white/10 h-11 p-1 mb-10">
                        <TabsTrigger value="web" className="text-xs font-bold gap-2 min-w-[100px] justify-start relative">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span>Web Chat</span>
                          {watchedValues.channelConfig?.web?.enabled && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] ml-auto shrink-0" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="sms" className="text-xs font-bold gap-2 min-w-[100px] justify-start relative">
                          <Smartphone className="h-3.5 w-3.5 shrink-0" />
                          <span>SMS</span>
                          {watchedValues.channelConfig?.sms?.enabled && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] ml-auto shrink-0" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="phone" className="text-xs font-bold gap-2 min-w-[100px] justify-start relative">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>Phone</span>
                          {watchedValues.channelConfig?.phone?.enabled && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] ml-auto shrink-0" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="email" className="text-xs font-bold gap-2 min-w-[100px] justify-start relative">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span>Email</span>
                          {watchedValues.channelConfig?.email?.enabled && (
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] ml-auto shrink-0" />
                          )}
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="web" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-sm font-bold">Enable Web Chat</Label>
                          <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>

                        {watchedValues.channelConfig?.web?.enabled && (
                          <div className="space-y-12 pl-6 border-l-2 border-primary/20">
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5" /> Core Behavior
                              </h4>
                              <div className="grid gap-6">
                                <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Initial greeting</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.greeting.returningText" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Returning visitor greeting</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.displayNameOverride" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Display name override</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <UserCheck className="h-3.5 w-3.5" /> Lead Capture
                              </h4>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-6">
                                  <FormField control={form.control} name="channelConfig.web.leadCapture.timing" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">When to ask for contact details</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a timing" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                          <SelectItem value="before">Before chat starts</SelectItem>
                                          <SelectItem value="after">After first meaningful reply</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )} />
                                  <FormField control={form.control} name="channelConfig.web.leadCapture.required" render={({ field }) => (
                                    <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Require contact details before chat starts</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                  )} />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <FormField control={form.control} name="channelConfig.web.leadCapture.fields.name" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs !mt-0">Capture Name</FormLabel></FormItem>
                                  )} />
                                  <FormField control={form.control} name="channelConfig.web.leadCapture.fields.email" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs !mt-0">Capture Email</FormLabel></FormItem>
                                  )} />
                                  <FormField control={form.control} name="channelConfig.web.leadCapture.fields.phone" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs !mt-0">Capture Phone</FormLabel></FormItem>
                                  )} />
                                </div>
                                <FormField control={form.control} name="channelConfig.web.leadCapture.captureMessage" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Lead capture message</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <ShieldAlert className="h-3.5 w-3.5" /> Escalation
                              </h4>
                              <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="channelConfig.web.sentimentEscalation" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Escalate on negative sentiment</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.afterHoursMode" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">After-hours behavior</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="ai_handles_everything">AI continues helping</SelectItem>
                                        <SelectItem value="respond_and_notify">Respond & Set Expectation</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                              </div>
                              <FormField control={form.control} name="channelConfig.web.afterHoursMessage" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">After-hours message</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                              )} />
                            </section>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="sms" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-sm font-bold">Enable SMS Channel</Label>
                          <FormField control={form.control} name="channelConfig.sms.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>
                        {watchedValues.channelConfig?.sms?.enabled && (
                          <div className="space-y-12 pl-6 border-l-2 border-primary/20">
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">SMS Behavior</h4>
                              <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (
                                  <FormItem className="col-span-2"><FormLabel className="text-xs">Opening SMS Text</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.sms.maxResponseLength" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Max Response Length</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.sms.mmsEnabled" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Allow MMS Attachments</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>
                            
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Lead Capture</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="channelConfig.sms.collectNameMode" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Collect Name</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="natural">Natural Conversation</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.sms.collectEmailMode" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Collect Email</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="natural">Natural Conversation</SelectItem></SelectContent></Select></FormItem>
                                )} />
                              </div>
                              <FormField control={form.control} name="channelConfig.sms.leadCaptureMessage" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Lead capture prompt</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                              )} />
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Escalation</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="channelConfig.sms.sentimentEscalation" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Sentiment escalation</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                              </div>
                              <FormField control={form.control} name="channelConfig.sms.handoffMessage" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Handoff Confirmation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                              )} />
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">After Hours</h4>
                              <FormField control={form.control} name="channelConfig.sms.afterHoursMode" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">After-hours mode</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ai_only">AI Only</SelectItem><SelectItem value="delayed_human">Set Delayed Human Expectation</SelectItem></SelectContent></Select></FormItem>
                              )} />
                              <FormField control={form.control} name="channelConfig.sms.afterHoursMessage" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">After-hours auto-reply</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                              )} />
                            </section>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="phone" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-sm font-bold">Enable Phone Channel</Label>
                          <FormField control={form.control} name="channelConfig.phone.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>
                        {watchedValues.channelConfig?.phone?.enabled && (
                          <div className="space-y-12 pl-6 border-l-2 border-primary/20">
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Call Handling</h4>
                              <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="channelConfig.phone.operationMode" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Call handling mode</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select a mode" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="full_ai">Full AI resolution</SelectItem>
                                        <SelectItem value="handoff">AI triage + handoff</SelectItem>
                                        <SelectItem value="receptionist">AI takes a message</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.transferNumber" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Transfer Number</FormLabel><FormControl><Input placeholder="+1..." {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Call Scripts</h4>
                              <div className="grid gap-6">
                                <FormField control={form.control} name="channelConfig.phone.greetingScript" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Phone greeting script</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.handoffScript" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Handoff script</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.voicemailScript" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Voicemail Script</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Voice Behavior</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="channelConfig.phone.transcribeCalls" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Transcribe calls</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.voicemailFallback" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Voicemail fallback</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.aiGreetingEnabled" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">AI greeting enabled</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.maxDurationMinutes" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Max duration (minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">After Hours</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="channelConfig.phone.afterHoursMode" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">After-hours mode</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ai_message_only">AI message only</SelectItem><SelectItem value="redirect">Redirect call</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.phone.afterHoursRedirectNumber" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Redirect number</FormLabel><FormControl><Input placeholder="+1..." {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="email" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-sm font-bold">Enable Email Channel</Label>
                          <FormField control={form.control} name="channelConfig.email.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>
                        {watchedValues.channelConfig?.email?.enabled && (
                          <div className="space-y-12 pl-6 border-l-2 border-primary/20">
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Reply Workflow</h4>
                              <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="channelConfig.email.approvalMode" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Reply approval</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select a mode" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="auto">Auto-send</SelectItem>
                                        <SelectItem value="auto_exceptions">Auto-send except escalations</SelectItem>
                                        <SelectItem value="manual">Manual approval</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.replyDelay" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Reply Delay</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select a delay" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="immediate">Immediate</SelectItem>
                                        <SelectItem value="2_5_minutes">2-5 Minutes</SelectItem>
                                        <SelectItem value="10_plus_minutes">10+ Minutes</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.threadingBehavior" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Threading behavior</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="reply_in_thread">Reply in thread</SelectItem>
                                        <SelectItem value="new_thread">Start new thread</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Formatting</h4>
                              <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="channelConfig.email.responseLength" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Response length</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="short">Short</SelectItem>
                                        <SelectItem value="standard">Standard</SelectItem>
                                        <SelectItem value="detailed">Detailed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.standardSignoff" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Email sign-off</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.subjectTemplate" render={({ field }) => (
                                  <FormItem className="col-span-2"><FormLabel className="text-xs">Subject Template (for new threads)</FormLabel><FormControl><Input placeholder="e.g. Re: {{original_subject}}" {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.alwaysIncludeBlock" render={({ field }) => (
                                  <FormItem className="col-span-2"><FormLabel className="text-xs">Always include block (Footer)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>

                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Escalation Rules</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="channelConfig.email.escalation.holdForFrustration" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Hold for frustration</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.escalation.holdForHighValue" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Hold for high value</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.escalation.holdForLegal" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Hold for legal/refund</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.escalation.holdForAttachment" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Hold for attachment</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.escalation.holdForVip" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Hold for VIP</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.email.sentimentEscalation" render={({ field }) => (
                                  <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Sentiment escalation</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>
                          </div>
                        )}
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
