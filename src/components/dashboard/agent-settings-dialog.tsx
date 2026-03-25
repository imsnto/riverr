
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
import { useToast } from '@/hooks/use-toast';

const agentSettingsSchema = z.object({
  id: z.string().optional(),
  type: z.literal('agent').default('agent'),

  // Intelligence - Identity
  name: z.string().min(1, 'Internal Name is required'),
  webAgentName: z.string().min(1, 'Public Agent Name is required'),
  roleTitle: z.string().optional(),

  // Intelligence - Knowledge Retrieval Policy
  intelligenceAccessLevel: z.enum(['none', 'topics_only', 'insights_hidden_support', 'internal_full_access']).default('topics_only'),

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

interface AgentSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (data: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  helpCenters: HelpCenter[];
  allUsers: User[];
}

const DEFAULT_AGENT_VALUES: Partial<AgentSettingsFormValues> = {
  name: '',
  webAgentName: '',
  roleTitle: '',
  intelligenceAccessLevel: 'topics_only',
  tone: 'friendly',
  voiceNotes: '',
  responseLength: 'balanced',
  primaryGoal: '',
  secondaryGoal: '',
  closingTemplate: '',
  successCriteria: '',
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
  }
};

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
  const { toast } = useToast();

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: bot ? { ...DEFAULT_AGENT_VALUES, ...(bot as any) } : DEFAULT_AGENT_VALUES as any,
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({ control: form.control, name: "products" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" });
  const { fields: qualificationFields, append: appendQualification, remove: removeQualification } = useFieldArray({ control: form.control, name: "qualificationFlow" });
  const { fields: policyFields, append: appendPolicy, remove: removePolicy } = useFieldArray({ control: form.control, name: "policies" });
  const { fields: scriptFields, append: appendScript, remove: removeScript } = useFieldArray({ control: form.control, name: "scripts" });

  useEffect(() => {
    if (isOpen && bot) {
      form.reset({ ...DEFAULT_AGENT_VALUES, ...(bot as any) });
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

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
        <DialogHeader className="p-0 shrink-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold text-white leading-none">{watchedValues.webAgentName || 'AI Brain'}</DialogTitle>
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
                <Button onClick={form.handleSubmit(onSubmit)} className="rounded-full h-9 px-6 font-bold">Save Changes</Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full"><X className="h-5 w-5" /></Button>
              </div>
            </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-10 max-w-4xl mx-auto pb-32 space-y-16">
                {activeTab === 'intelligence' && (
                  <div className="space-y-16 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Users className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Identity</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="webAgentName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Public Agent Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Internal ID</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="roleTitle" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Official Role / Job Title</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="e.g. Customer Support" /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Knowledge Retrieval Policy</h3>
                      </div>
                      <FormField control={form.control} name="intelligenceAccessLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Intelligence Access Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Library Articles Only (Strict)</SelectItem>
                              <SelectItem value="topics_only">Articles + Topic Patterns</SelectItem>
                              <SelectItem value="insights_hidden_support">Articles + Hidden Support Signal</SelectItem>
                              <SelectItem value="internal_full_access">Full Internal Memory (Internal Copilot)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[10px]">
                            Controls whether the agent can draw from un-curated support memories and recurring patterns.
                          </FormDescription>
                        </FormItem>
                      )} />
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
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Custom Voice & Style Constraints</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} placeholder="e.g. Never use emojis. Use industry terminology." /></FormControl></FormItem>
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
                          <FormItem><FormLabel className="text-xs">Primary Conversation Objective</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="secondaryGoal" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Secondary Objective</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="closingTemplate" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Default Closing Signature</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-16 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <BookOpen className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Business Context</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="businessContext.businessName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Legal/Official Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.location" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Service Area / HQ</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.description" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">What You Actually Do</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.targetAudience" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Ideal Customer Profile</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.businessHours" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Business Hours</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.minOrder" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Minimum Order / Lead Time</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.differentiators" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Key Differentiators (Why Us?)</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.forbiddenTopics" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Strict Forbidden Topics</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
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
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Tabs value={activeChannel} onValueChange={setActiveChannel}>
                      <TabsList className="bg-white/5 border border-white/10 h-11 p-1 mb-10">
                        <TabsTrigger value="web" className="text-xs font-bold gap-2">
                          <MessageSquare className="h-3.5 w-3.5" /> Web Chat
                        </TabsTrigger>
                        <TabsTrigger value="sms" className="text-xs font-bold gap-2">
                          <Smartphone className="h-3.5 w-3.5" /> SMS
                        </TabsTrigger>
                        <TabsTrigger value="phone" className="text-xs font-bold gap-2">
                          <Phone className="h-3.5 w-3.5" /> Phone
                        </TabsTrigger>
                        <TabsTrigger value="email" className="text-xs font-bold gap-2">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="web" className="space-y-10">
                        <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                            <FormLabel className="text-sm font-bold">Enable Web Chat</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        {watchedValues.channelConfig?.web?.enabled && (
                          <div className="space-y-12 pl-6 border-l-2 border-primary/20">
                            <section className="space-y-6">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5" /> Core Behavior
                              </h4>
                              <div className="grid gap-6">
                                <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Initial greeting</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.greeting.returningText" render={({ field }) => (
                                  <FormItem><FormLabel className="text-xs">Returning visitor greeting</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                                )} />
                              </div>
                            </section>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
