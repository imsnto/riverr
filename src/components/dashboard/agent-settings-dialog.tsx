'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  AlertCircle,
  ArrowRight,
  Ban,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe,
  GraduationCap,
  HelpCircle,
  Library,
  Mail,
  MessageSquare,
  Mic,
  Package,
  Palette,
  Phone,
  Plus,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  UserCircle2,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';

import { Bot as BotData, HelpCenter, User } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const behaviorModes = ['support', 'sales', 'hybrid'] as const;
const proactivenessLevels = ['low', 'medium', 'high'] as const;
const confidenceStrategies = ['answer', 'answer_softly', 'clarify', 'escalate'] as const;
const escalationTopics = ['billing', 'refunds', 'angry_customer', 'legal', 'custom_quote'] as const;
const captureTriggers = ['before_escalation', 'before_quote', 'after_helpful_answer', 'never'] as const;

const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Product name is required'),
  price: z.string().optional(),
  description: z.string().optional(),
  triggers: z.string().optional(),
});

const faqSchema = z.object({
  id: z.string(),
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
});

const objectionSchema = z.object({
  id: z.string(),
  objection: z.string().min(1, 'Objection is required'),
  response: z.string().min(1, 'Response is required'),
});

const agentSettingsSchema = z.object({
  id: z.string().optional(),
  type: z.literal('agent').default('agent'),
  isEnabled: z.boolean().default(true),

  // Identity
  name: z.string().min(1, 'Internal Name is required'),
  webAgentName: z.string().min(1, 'Public Agent Name is required'),
  roleTitle: z.string().optional(),

  // Intelligence access
  intelligenceAccessLevel: z
    .enum(['none', 'articles_only', 'topics_allowed', 'insights_hidden_support', 'internal_full_access'])
    .default('topics_allowed'),

  // Tone
  tone: z.enum(['friendly', 'formal', 'expert', 'direct', 'warm']).default('friendly'),
  responseLength: z.enum(['short', 'balanced', 'detailed']).default('balanced'),
  voiceNotes: z.string().optional(),

  // Mission
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  secondaryGoal: z.string().optional(),
  closingTemplate: z.string().optional(),

  // Behavior engine
  behavior: z.object({
    mode: z.enum(behaviorModes).default('hybrid'),
    proactiveness: z.enum(proactivenessLevels).default('medium'),
    askClarifyingQuestions: z.boolean().default(true),
    recommendNextStep: z.boolean().default(true),
    revealUncertainty: z.boolean().default(true),
  }),

  // Confidence handling
  confidenceHandling: z.object({
    high: z.enum(confidenceStrategies).default('answer'),
    medium: z.enum(confidenceStrategies).default('answer_softly'),
    low: z.enum(confidenceStrategies).default('clarify'),
  }),

  // Escalation
  escalation: z.object({
    enabled: z.boolean().default(true),
    notifyEmail: z.string().optional(),
    frustration: z.boolean().default(true),
    repeatedFailures: z.boolean().default(true),
    offerOnce: z.boolean().default(true),
    fallbackMessage: z.string().default('I can connect you with a teammate who can help further.'),
    forceTriggers: z.array(z.enum(escalationTopics)).default(['billing', 'angry_customer']),
  }),

  // Offline Followup (Smart Handoff)
  offlineFollowup: z.object({
    enabled: z.boolean().default(false),
    contactMethod: z.enum(['email', 'phone', 'either']).default('email'),
    unavailableMessage: z.string().optional(),
  }).default({ enabled: false, contactMethod: 'email' }),

  // Identity capture
  identityCapture: z.object({
    askForName: z.boolean().default(false),
    askForEmail: z.boolean().default(true),
    askForPhone: z.boolean().default(false),
    trigger: z.enum(captureTriggers).default('before_escalation'),
    leadCaptureMessage: z
      .string()
      .default('Before I connect you, can I grab your email so our team can follow up?'),
  }),

  // Business context
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    targetAudience: z.string().optional(),
    hours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiation: z.string().optional(),
    forbiddenTopics: z.string().optional(),
    structuredHours: z.object({
      timezone: z.string().default(''),
      // 7 days: 0=Sun, 1=Mon, ..., 6=Sat
      days: z.array(z.object({
        enabled: z.boolean().default(false),
        start: z.string().default('09:00'),
        end: z.string().default('18:00'),
      })).length(7),
    }).optional(),
  }),

  // Sources
  allowedHelpCenterIds: z.array(z.string()).default([]),

  // Manual knowledge
  products: z.array(productSchema).default([]),
  faqs: z.array(faqSchema).default([]),
  objections: z.array(objectionSchema).default([]),

  // Channels
  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(true),
      greeting: z.object({
        text: z.string().default('Hi! How can I help today?'),
        returningText: z.string().default('Welcome back. How can I help today?'),
      }),
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().default('Hi! How can I help?'),
      maxResponseLength: z.coerce.number().default(160),
      leadCaptureMessage: z.string().default("If you'd like, I can grab your email and have the team follow up with more details."),
      handoffKeywords: z.array(z.string()).default(['agent', 'human', 'person', 'call me']),
      allowMultiMessageReplies: z.boolean().default(false),
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      operationMode: z.enum(['full_ai', 'handoff', 'receptionist']).default('handoff'),
      greetingScript: z.string().default('Thank you for calling. How can I help today?'),
      voicemailScript: z.string().default('We’re unavailable right now. Please leave a message.'),
      transcribeCalls: z.boolean().default(true),
      maxCallMinutes: z.coerce.number().default(8),
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      approvalMode: z.enum(['auto', 'auto_exceptions', 'manual']).default('auto_exceptions'),
      standardSignoff: z.string().default('Best regards, {{agent_name}}'),
      toneOverride: z.enum(['inherit', 'formal', 'friendly']).default('inherit'),
    }),
  }),
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BLANK_DAY = { enabled: false, start: '09:00', end: '18:00' };

/** Convert bot's structuredHours schedule array → flat 7-day form array */
function scheduleToFormDays(
  structuredHours: { timezone: string; schedule: { days: number[]; start: string; end: string }[] } | undefined
): { timezone: string; days: { enabled: boolean; start: string; end: string }[] } {
  if (!structuredHours?.schedule?.length) {
    return {
      timezone: structuredHours?.timezone || '',
      days: Array.from({ length: 7 }, (_, i) =>
        i === 0 || i === 5 ? { enabled: false, start: '09:00', end: '18:00' }
        : { enabled: true, start: '09:00', end: '18:00' }
      ),
    };
  }
  const days = Array.from({ length: 7 }, () => ({ ...BLANK_DAY }));
  for (const slot of structuredHours.schedule) {
    for (const d of slot.days) {
      days[d] = { enabled: true, start: slot.start, end: slot.end };
    }
  }
  return { timezone: structuredHours.timezone || '', days };
}

/** Convert flat 7-day form array → bot's structuredHours schedule array */
function formDaysToSchedule(
  formDays: { enabled: boolean; start: string; end: string }[],
  timezone: string
): { timezone: string; schedule: { days: number[]; start: string; end: string }[] } {
  const slotMap = new Map<string, number[]>();
  formDays.forEach((d, i) => {
    if (!d.enabled) return;
    const key = `${d.start}|${d.end}`;
    if (!slotMap.has(key)) slotMap.set(key, []);
    slotMap.get(key)!.push(i);
  });
  const schedule = Array.from(slotMap.entries()).map(([key, days]) => {
    const [start, end] = key.split('|');
    return { days, start, end };
  });
  return { timezone, schedule };
}

const DEFAULT_AGENT_VALUES: AgentSettingsFormValues = {
  type: 'agent',
  isEnabled: true,
  name: '',
  webAgentName: '',
  roleTitle: '',
  intelligenceAccessLevel: 'insights_hidden_support',
  tone: 'friendly',
  responseLength: 'balanced',
  voiceNotes: '',
  primaryGoal: 'Understand the user’s need, provide helpful guidance, and move them toward a clear next step.',
  secondaryGoal: '',
  closingTemplate: 'Let me know if you’d like me to connect you with someone from our team.',
  behavior: {
    mode: 'hybrid',
    proactiveness: 'medium',
    askClarifyingQuestions: true,
    recommendNextStep: true,
    revealUncertainty: true,
  },
  confidenceHandling: {
    high: 'answer',
    medium: 'answer_softly',
    low: 'clarify',
  },
  escalation: {
    enabled: true,
    notifyEmail: '',
    frustration: true,
    repeatedFailures: true,
    offerOnce: true,
    fallbackMessage: 'I can connect you with a teammate who can help further.',
    forceTriggers: ['billing', 'angry_customer'],
  },
  offlineFollowup: {
    enabled: false,
    contactMethod: 'email',
    unavailableMessage: '',
  },
  identityCapture: {
    askForName: false,
    askForEmail: true,
    askForPhone: false,
    trigger: 'before_escalation',
    leadCaptureMessage: 'Before I connect you, can I grab your email so our team can follow up?',
  },
  businessContext: {
    businessName: '',
    location: '',
    description: '',
    targetAudience: '',
    hours: '',
    minOrder: '',
    turnaround: '',
    differentiation: '',
    forbiddenTopics: '',
    structuredHours: {
      timezone: '',
      days: [
        { enabled: false, start: '09:00', end: '18:00' }, // Sun
        { enabled: true,  start: '09:00', end: '18:00' }, // Mon
        { enabled: true,  start: '09:00', end: '18:00' }, // Tue
        { enabled: true,  start: '09:00', end: '18:00' }, // Wed
        { enabled: true,  start: '09:00', end: '18:00' }, // Thu
        { enabled: false, start: '09:00', end: '18:00' }, // Fri
        { enabled: true,  start: '09:00', end: '18:00' }, // Sat
      ],
    },
  },
  allowedHelpCenterIds: [],
  products: [],
  faqs: [],
  objections: [],
  channelConfig: {
    web: {
      enabled: true,
      greeting: {
        text: 'Hi! How can I help today?',
        returningText: 'Welcome back. How can I help today?',
      },
    },
    sms: {
      enabled: false,
      openingText: 'Hi! How can I help?',
      maxResponseLength: 160,
      leadCaptureMessage: "If you'd like, I can grab your email and have the team follow up with more details.",
      handoffKeywords: ['agent', 'human', 'person', 'call me'],
      allowMultiMessageReplies: false,
    },
    phone: {
      enabled: false,
      operationMode: 'handoff',
      greetingScript: 'Thank you for calling. How can I help today?',
      voicemailScript: 'We’re unavailable right now. Please leave a message.',
      transcribeCalls: true,
      maxCallMinutes: 8,
    },
    email: {
      enabled: false,
      approvalMode: 'auto_exceptions',
      standardSignoff: 'Best regards, {{agent_name}}',
      toneOverride: 'inherit',
    },
  },
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-left">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

function FieldCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-left', className)}>{children}</div>;
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'intelligence' | 'knowledge' | 'channels' | 'preview'>('intelligence');
  const [activeChannel, setActiveChannel] = useState<'web' | 'sms' | 'phone' | 'email'>('web');
  const [activeSubpanel, setActiveSubpanel] = useState<string>('identity');

  const botToFormValues = (b: BotData): any => ({
    ...DEFAULT_AGENT_VALUES,
    ...b,
    businessContext: {
      ...DEFAULT_AGENT_VALUES.businessContext,
      ...(b.businessContext || {}),
      structuredHours: scheduleToFormDays((b.businessContext as any)?.structuredHours),
    },
  });

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: bot ? botToFormValues(bot) : DEFAULT_AGENT_VALUES,
  });

  const watched = form.watch();

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
    control: form.control,
    name: 'products',
  });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({
    control: form.control,
    name: 'faqs',
  });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({
    control: form.control,
    name: 'objections',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (bot) {
      form.reset(botToFormValues(bot));
    } else {
      form.reset(DEFAULT_AGENT_VALUES);
    }
  }, [bot, isOpen]);

  useEffect(() => {
    if (activeTab === 'intelligence') setActiveSubpanel('identity');
    if (activeTab === 'knowledge') setActiveSubpanel('sources');
    if (activeTab === 'channels') setActiveSubpanel('web');
  }, [activeTab]);

  const completion = useMemo(() => {
    return {
      identity: !!watched.name && !!watched.webAgentName,
      mission: !!watched.primaryGoal,
      sources: watched.allowedHelpCenterIds.length > 0 || watched.products.length > 0 || watched.faqs.length > 0,
      channels: !!watched.channelConfig.web.enabled || !!watched.channelConfig.sms.enabled || !!watched.channelConfig.phone.enabled || !!watched.channelConfig.email.enabled,
    };
  }, [watched]);

  const onSubmit = (values: AgentSettingsFormValues) => {
    // Convert flat days form state back to structuredHours schedule array
    const formDays = (values.businessContext as any)?.structuredHours?.days;
    const timezone = (values.businessContext as any)?.structuredHours?.timezone || '';
    const structuredHours = formDays && timezone
      ? formDaysToSchedule(formDays, timezone)
      : undefined;

    const payload: BotData | Omit<BotData, 'id' | 'hubId'> = {
      ...(bot || {}),
      ...values,
      type: 'agent',
      businessContext: {
        ...values.businessContext,
        structuredHours: structuredHours || null,
      },
    } as any;

    onSave(payload);
    onOpenChange(false);
  };

  const onError = (errors: any) => {
    console.error("Agent Validation Errors:", errors);
    toast({
      variant: 'destructive',
      title: 'Missing required fields',
      description: 'Please complete the agent identity and mission before saving.',
    });
  };

  const renderIntelligence = () => (
    <Tabs value={activeSubpanel} onValueChange={setActiveSubpanel} className="space-y-8">
      <TabsList className="bg-white/5 border border-white/10 p-1 h-11 w-full justify-start overflow-x-auto">
        <TabsTrigger value="identity" className="text-xs font-bold uppercase tracking-widest px-6">Identity</TabsTrigger>
        <TabsTrigger value="mission" className="text-xs font-bold uppercase tracking-widest px-6">Mission</TabsTrigger>
        <TabsTrigger value="behavior" className="text-xs font-bold uppercase tracking-widest px-6">Behavior</TabsTrigger>
        <TabsTrigger value="confidence" className="text-xs font-bold uppercase tracking-widest px-6">Confidence</TabsTrigger>
        <TabsTrigger value="escalation" className="text-xs font-bold uppercase tracking-widest px-6">Escalation</TabsTrigger>
        <TabsTrigger value="capture" className="text-xs font-bold uppercase tracking-widest px-6">Lead Capture</TabsTrigger>
        <TabsTrigger value="style" className="text-xs font-bold uppercase tracking-widest px-6">Style</TabsTrigger>
      </TabsList>

      <div className="space-y-8 min-h-[400px]">
        {activeSubpanel === 'identity' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={UserCircle2} title="Identity" description="Define who this agent is, both publicly and internally." />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="webAgentName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Public Agent Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="What customers see" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="Internal reference name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="roleTitle" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Role / Title</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="Support assistant, sales concierge, intake specialist..." /></FormControl>
                </FormItem>
              )} />
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'mission' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={Target} title="Mission" description="This is the north star. It should describe the outcome, not just the tone." />
            <div className="mt-6 space-y-6">
              <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Mission</FormLabel>
                  <FormControl><Textarea rows={4} {...field} value={field.value || ''} placeholder="Understand the user’s need, provide helpful guidance, and move them toward a clear next step." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="secondaryGoal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Mission</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} placeholder="Optional supporting objective, like collecting lead details or reducing support load." /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="closingTemplate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Next-Step Prompt</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} placeholder="Would you like me to connect you with someone from our team?" /></FormControl>
                  <FormDescription>Used when the agent should naturally move the conversation forward.</FormDescription>
                </FormItem>
              )} />
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'behavior' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={Zap} title="Behavior Engine" description="How the AI thinks and operates, not just how it sounds." />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="behavior.mode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Behavior Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="behavior.proactiveness" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proactiveness</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ['behavior.askClarifyingQuestions', 'Ask clarifying questions', 'When intent is fuzzy, the agent pauses and probes.'],
                ['behavior.recommendNextStep', 'Recommend next step', 'Prompt for booking, quote, follow-up, or escalation when helpful.'],
                ['behavior.revealUncertainty', 'Reveal uncertainty', 'The agent can admit when confidence is lower than ideal.'],
              ].map(([name, label, desc]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as any}
                  render={({ field }) => (
                    <FieldCard className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      </div>
                    </FieldCard>
                  )}
                />
              ))}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'confidence' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={ShieldCheck} title="Confidence Handling" description="Choose how the agent behaves based on confidence in the answer." />
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {[
                ['confidenceHandling.high', 'High confidence'],
                ['confidenceHandling.medium', 'Medium confidence'],
                ['confidenceHandling.low', 'Low confidence'],
              ].map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="answer">Answer directly</SelectItem>
                          <SelectItem value="answer_softly">Answer carefully</SelectItem>
                          <SelectItem value="clarify">Ask a clarifying question</SelectItem>
                          <SelectItem value="escalate">Escalate to human</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'escalation' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={ShieldAlert} title="Escalation" description="Decide when the agent hands the baton to a human." />
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['escalation.enabled', 'Escalation enabled', 'Allow human handoff when needed.'],
                  ['escalation.frustration', 'Escalate frustrated users', 'Detect upset or frustrated tone.'],
                  ['escalation.repeatedFailures', 'Escalate repeated failures', 'After repeated confusion or failed answers.'],
                  ['escalation.offerOnce', 'Offer once only', 'Avoid repeating the same handoff offer over and over.'],
                ].map(([name, label, desc]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name as any}
                    render={({ field }) => (
                      <FieldCard className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                        </div>
                      </FieldCard>
                    )}
                  />
                ))}
              </div>

              <FormField control={form.control} name="escalation.notifyEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalation Notification Email</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="team@company.com" /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="escalation.fallbackMessage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fallback Escalation Message</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />

              <div>
                <Label className="text-sm font-semibold">Force Escalation Topics</Label>
                <p className="mt-1 text-xs text-muted-foreground">These topics should bypass normal AI confidence rules and move toward a human.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {escalationTopics.map((topic) => (
                    <FormField
                      key={topic}
                      control={form.control}
                      name="escalation.forceTriggers"
                      render={({ field }) => {
                        const selected = field.value || [];
                        const checked = selected.includes(topic);
                        return (
                          <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                if (state) field.onChange([...selected, topic]);
                                else field.onChange(selected.filter((item) => item !== topic));
                              }}
                            />
                            <span className="text-sm capitalize text-white">{topic.replaceAll('_', ' ')}</span>
                          </label>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'escalation' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300 mt-6">
            <SectionHeader icon={ShieldAlert} title="Offline Followup" description="When no agents are available, collect contact info for follow-up." />
            <div className="mt-6 space-y-6">
              <FormField
                control={form.control}
                name="offlineFollowup.enabled"
                render={({ field }) => (
                  <FieldCard className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Enable offline followup</p>
                        <p className="mt-1 text-xs text-muted-foreground">When no humans are available, collect visitor contact info instead of faking a live handoff.</p>
                      </div>
                      <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                    </div>
                  </FieldCard>
                )}
              />

              {form.watch('offlineFollowup.enabled') && (
                <>
                  <FormField control={form.control} name="offlineFollowup.contactMethod" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Method</FormLabel>
                      <Select value={field.value || 'email'} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="either">Either (let visitor choose)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="offlineFollowup.unavailableMessage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Unavailable Message</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          {...field}
                          value={field.value || ''}
                          placeholder="Our team isn't available right now, but if you share your email, someone will reach out..."
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Leave blank for automatic messaging based on contact method.</p>
                    </FormItem>
                  )} />
                </>
              )}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'capture' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={Users} title="Lead Capture" description="Tell the agent when and how to collect identity details." />
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['identityCapture.askForName', 'Ask for name'],
                  ['identityCapture.askForEmail', 'Ask for email'],
                  ['identityCapture.askForPhone', 'Ask for phone'],
                ].map(([name, label]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name as any}
                    render={({ field }) => (
                      <FieldCard className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{label}</p>
                          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                        </div>
                      </FieldCard>
                    )}
                  />
                ))}
              </div>

              <FormField control={form.control} name="identityCapture.trigger" render={({ field }) => (
                <FormItem>
                  <FormLabel>When should the agent ask?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="before_escalation">Before escalation</SelectItem>
                      <SelectItem value="before_quote">Before quote / pricing follow-up</SelectItem>
                      <SelectItem value="after_helpful_answer">After a helpful answer</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="identityCapture.leadCaptureMessage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Capture Prompt</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'style' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={Palette} title="Tone & Style" description="The outer voice of the agent." />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="tone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Tone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly & approachable</SelectItem>
                      <SelectItem value="formal">Professional & formal</SelectItem>
                      <SelectItem value="expert">Expert & authoritative</SelectItem>
                      <SelectItem value="direct">Direct & concise</SelectItem>
                      <SelectItem value="warm">Warm & empathic</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="responseLength" render={({ field }) => (
                <FormItem>
                  <FormLabel>Response Length</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="voiceNotes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Additional Style Notes</FormLabel>
                  <FormControl><Textarea rows={4} {...field} value={field.value || ''} placeholder="Examples: Never sound pushy. Use simple language. Mention turnaround only when asked." /></FormControl>
                </FormItem>
              )} />
            </div>
          </FieldCard>
        )}
      </div>
    </Tabs>
  );

  const renderKnowledge = () => (
    <Tabs value={activeSubpanel} onValueChange={setActiveSubpanel} className="space-y-8">
      <TabsList className="bg-white/5 border border-white/10 p-1 h-11 w-full justify-start overflow-x-auto">
        <TabsTrigger value="sources" className="text-xs font-bold uppercase tracking-widest px-6">Sources</TabsTrigger>
        <TabsTrigger value="business" className="text-xs font-bold uppercase tracking-widest px-6">Context</TabsTrigger>
        <TabsTrigger value="products" className="text-xs font-bold uppercase tracking-widest px-6">Products</TabsTrigger>
        <TabsTrigger value="faqs" className="text-xs font-bold uppercase tracking-widest px-6">FAQs</TabsTrigger>
        <TabsTrigger value="objections" className="text-xs font-bold uppercase tracking-widest px-6">Objections</TabsTrigger>
      </TabsList>

      <div className="space-y-8 min-h-[400px]">
        {activeSubpanel === 'sources' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader
              icon={Library}
              title="Connected Sources"
              description="Attach the real brain. Public help centers and internal libraries should be chosen here."
              right={<Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{watched.allowedHelpCenterIds.length} attached</Badge>}
            />
            <div className="mt-6 space-y-3">
              {helpCenters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-muted-foreground">
                  No libraries or help centers available yet.
                </div>
              ) : (
                helpCenters.map((center) => (
                  <FormField
                    key={center.id}
                    control={form.control}
                    name="allowedHelpCenterIds"
                    render={({ field }) => {
                      const selected = field.value || [];
                      const checked = selected.includes(center.id);
                      const visibility = (center as any).visibility || 'public';
                      return (
                        <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 hover:border-primary/20 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              if (state) field.onChange([...selected, center.id]);
                              else field.onChange(selected.filter((id) => id !== center.id));
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{center.name}</p>
                              <Badge variant="outline" className="text-[10px] uppercase">{visibility}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {(center as any).description || 'Connected knowledge source'}
                            </p>
                          </div>
                        </label>
                      );
                    }}
                  />
                ))
              )}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'business' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader icon={GraduationCap} title="Business Context" description="Manual context the agent should keep in its head at all times." />
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="businessContext.businessName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Official Business Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Operating Hours <span className="text-muted-foreground text-xs font-normal">(display text for AI)</span></FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="Mon-Fri 9am-5pm EST" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="City, state, service area..." /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.targetAudience" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="Local businesses, schools, churches..." /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.minOrder" render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Order</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="Optional" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.turnaround" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typical Turnaround</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="3-5 business days" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.description" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>What We Do</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.differentiation" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Why Choose Us</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="businessContext.forbiddenTopics" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Strictly Forbidden Topics</FormLabel>
                  <FormControl><Textarea rows={3} {...field} value={field.value || ''} placeholder="Things the agent should never discuss." /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Structured Business Hours */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <p className="text-sm font-semibold text-white">Availability Schedule</p>
                <span className="text-xs text-muted-foreground">— used to check if agents are available for live handoff</span>
              </div>
              <div className="mb-4">
                <FormField control={form.control} name={"businessContext.structuredHours.timezone" as any} render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Asia/Dhaka">Asia/Dhaka (UTC+6)</SelectItem>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</SelectItem>
                        <SelectItem value="Asia/Karachi">Asia/Karachi (UTC+5)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                        <SelectItem value="Asia/Riyadh">Asia/Riyadh (UTC+3)</SelectItem>
                        <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (UTC+0/+1)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (UTC-5/-4)</SelectItem>
                        <SelectItem value="America/Chicago">America/Chicago (UTC-6/-5)</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="space-y-2">
                {DAY_NAMES.map((dayName, idx) => (
                  <div key={dayName} className="flex items-center gap-3">
                    <div className="w-8 text-xs text-muted-foreground font-medium">{dayName}</div>
                    <FormField control={form.control} name={`businessContext.structuredHours.days.${idx}.enabled` as any} render={({ field }) => (
                      <FormItem className="flex items-center space-x-0 space-y-0">
                        <FormControl>
                          <input type="checkbox" checked={!!field.value} onChange={field.onChange} className="h-4 w-4 rounded accent-blue-500" />
                        </FormControl>
                      </FormItem>
                    )} />
                    {form.watch(`businessContext.structuredHours.days.${idx}.enabled` as any) ? (
                      <div className="flex items-center gap-2">
                        <FormField control={form.control} name={`businessContext.structuredHours.days.${idx}.start` as any} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl><Input type="time" {...field} value={field.value || '09:00'} className="h-7 w-28 text-xs" /></FormControl>
                          </FormItem>
                        )} />
                        <span className="text-xs text-muted-foreground">—</span>
                        <FormField control={form.control} name={`businessContext.structuredHours.days.${idx}.end` as any} render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl><Input type="time" {...field} value={field.value || '18:00'} className="h-7 w-28 text-xs" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'products' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader
              icon={Package}
              title="Products & Services"
              description="Use these for recommendation nudges and context-specific answers."
              right={<Button type="button" size="sm" variant="outline" onClick={() => appendProduct({ id: Date.now().toString(), name: '', price: '', description: '', triggers: '' })}><Plus className="mr-1 h-3.5 w-3.5" /> Add Product</Button>}
            />
            <div className="mt-6 space-y-4">
              {productFields.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground text-center">No products added yet.</div>}
              {productFields.map((item, idx) => (
                <FieldCard key={item.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Product #{idx + 1}</p>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(idx)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name={`products.${idx}.name`} render={({ field }) => (
                      <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`products.${idx}.price`} render={({ field }) => (
                      <FormItem><FormLabel>Price / Range</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`products.${idx}.description`} render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name={`products.${idx}.triggers`} render={({ field }) => (
                      <FormItem className="md:col-span-2"><FormLabel>When should the agent recommend this?</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="Keywords, use cases, or buying signals" /></FormControl></FormItem>
                    )} />
                  </div>
                </FieldCard>
              ))}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'faqs' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader
              icon={HelpCircle}
              title="Fixed FAQs"
              description="Pinned answers that should remain stable, even before RAG comes into play."
              right={<Button type="button" size="sm" variant="outline" onClick={() => appendFaq({ id: Date.now().toString(), question: '', answer: '' })}><Plus className="mr-1 h-3.5 w-3.5" /> Add FAQ</Button>}
            />
            <div className="mt-6 space-y-4">
              {faqFields.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground text-center">No FAQs added yet.</div>}
              {faqFields.map((item, idx) => (
                <FieldCard key={item.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">FAQ #{idx + 1}</p>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFaq(idx)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                  <div className="space-y-4">
                    <FormField control={form.control} name={`faqs.${idx}.question`} render={({ field }) => (
                      <FormItem><FormLabel>Question</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`faqs.${idx}.answer`} render={({ field }) => (
                      <FormItem><FormLabel>Answer</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </FieldCard>
              ))}
            </div>
          </FieldCard>
        )}

        {activeSubpanel === 'objections' && (
          <FieldCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SectionHeader
              icon={AlertCircle}
              title="Objections & Responses"
              description="This is where the sales brain gets sharper."
              right={<Button type="button" size="sm" variant="outline" onClick={() => appendObjection({ id: Date.now().toString(), objection: '', response: '' })}><Plus className="mr-1 h-3.5 w-3.5" /> Add Objection</Button>}
            />
            <div className="mt-6 space-y-4">
              {objectionFields.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground text-center">No objections added yet.</div>}
              {objectionFields.map((item, idx) => (
                <FieldCard key={item.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Objection #{idx + 1}</p>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeObjection(idx)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                  <div className="space-y-4">
                    <FormField control={form.control} name={`objections.${idx}.objection`} render={({ field }) => (
                      <FormItem><FormLabel>Objection</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="It’s too expensive. We’re not ready. I need approval..." /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={`objections.${idx}.response`} render={({ field }) => (
                      <FormItem><FormLabel>Recommended Response</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </FieldCard>
              ))}
            </div>
          </FieldCard>
        )}
      </div>
    </Tabs>
  );

  const renderChannels = () => (
    <div className="space-y-10">
      <Tabs value={activeChannel} onValueChange={(v) => { setActiveChannel(v as any); setActiveSubpanel(v); }}>
        <TabsList className="h-12 border border-white/10 bg-white/[0.03] p-1">
          {[
            { id: 'web', icon: MessageSquare, label: 'Web', enabled: watched.channelConfig.web.enabled },
            { id: 'sms', icon: Smartphone, label: 'SMS', enabled: watched.channelConfig.sms.enabled },
            { id: 'phone', icon: Phone, label: 'Phone', enabled: watched.channelConfig.phone.enabled },
            { id: 'email', icon: Mail, label: 'Email', enabled: watched.channelConfig.email.enabled },
          ].map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="relative gap-2 text-xs font-bold">
              {React.createElement(item.icon, { className: "h-3.5 w-3.5" })}
              {item.label}
              {item.enabled ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500" /> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="web" className="mt-8 space-y-6">
          <FieldCard className="animate-in fade-in duration-300">
            <SectionHeader icon={MessageSquare} title="Web Widget" description="Best default channel. Keep this on for most agents." />
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Enable for web</p>
                  <p className="mt-1 text-xs text-muted-foreground">Allow the agent to respond in the site widget.</p>
                </div>
                <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>} />
              </div>
              {watched.channelConfig.web.enabled && (
                <div className="grid gap-6">
                  <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                    <FormItem><FormLabel>Initial Greeting</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.web.greeting.returningText" render={({ field }) => (
                    <FormItem><FormLabel>Returning Visitor Greeting</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                </div>
              )}
            </div>
          </FieldCard>
        </TabsContent>

        <TabsContent value="sms" className="mt-8 space-y-6">
          <FieldCard className="animate-in fade-in duration-300">
            <SectionHeader icon={Smartphone} title="SMS" description="Keep replies short, sharp, and segment-aware." />
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Enable for SMS</p>
                  <p className="mt-1 text-xs text-muted-foreground">Respond to text messages automatically.</p>
                </div>
                <FormField control={form.control} name="channelConfig.sms.enabled" render={({ field }) => <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>} />
              </div>
              {watched.channelConfig.sms.enabled && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>First Text Response</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.sms.maxResponseLength" render={({ field }) => (
                    <FormItem><FormLabel>Max Character Limit</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.sms.allowMultiMessageReplies" render={({ field }) => (
                    <FormItem className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-left">
                          <FormLabel>Allow multi-message replies</FormLabel>
                          <FormDescription>Useful when a single segment is too cramped.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.sms.leadCaptureMessage" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Lead Capture Prompt</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                </div>
              )}
            </div>
          </FieldCard>
        </TabsContent>

        <TabsContent value="phone" className="mt-8 space-y-6">
          <FieldCard className="animate-in fade-in duration-300">
            <SectionHeader icon={Phone} title="Phone" description="Voice AI needs guardrails, not just greetings." />
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Enable for voice</p>
                  <p className="mt-1 text-xs text-muted-foreground">Handle phone calls with AI voice.</p>
                </div>
                <FormField control={form.control} name="channelConfig.phone.enabled" render={({ field }) => <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>} />
              </div>
              {watched.channelConfig.phone.enabled && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="channelConfig.phone.operationMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Handling Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="full_ai">Full AI resolution</SelectItem>
                          <SelectItem value="handoff">Triage & transfer</SelectItem>
                          <SelectItem value="receptionist">Simple receptionist</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.phone.maxCallMinutes" render={({ field }) => (
                    <FormItem><FormLabel>Max Call Minutes</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.phone.greetingScript" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Greeting Script</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.phone.voicemailScript" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Voicemail Instructions</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.phone.transcribeCalls" render={({ field }) => (
                    <FormItem className="md:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-left">
                          <FormLabel>Record & transcribe calls</FormLabel>
                          <FormDescription>Stores call transcripts for review and intelligence.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </div>
                    </FormItem>
                  )} />
                </div>
              )}
            </div>
          </FieldCard>
        </TabsContent>

        <TabsContent value="email" className="mt-8 space-y-6">
          <FieldCard className="animate-in fade-in duration-300">
            <SectionHeader icon={Mail} title="Email" description="Email needs stricter approval rails than chat." />
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Enable for email</p>
                  <p className="mt-1 text-xs text-muted-foreground">Draft or send replies automatically.</p>
                </div>
                <FormField control={form.control} name="channelConfig.email.enabled" render={({ field }) => <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>} />
              </div>
              {watched.channelConfig.email.enabled && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="channelConfig.email.approvalMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reply Approval Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="auto">Fully automated</SelectItem>
                          <SelectItem value="auto_exceptions">Auto except risky cases</SelectItem>
                          <SelectItem value="manual">Manual approval only</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.email.toneOverride" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Tone Override</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="inherit">Inherit agent tone</SelectItem>
                          <SelectItem value="formal">Force formal</SelectItem>
                          <SelectItem value="friendly">Force friendly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="channelConfig.email.standardSignoff" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Signature / Sign-off</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                  )} />
                </div>
              )}
            </div>
          </FieldCard>
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderPreview = () => (
    <div className="flex justify-center items-start pt-10 min-h-[500px]">
      <FieldCard className="max-w-2xl w-full sticky top-6 shadow-2xl shadow-primary/5">
        <SectionHeader icon={Sparkles} title="Agent Preview" description="A quick pulse-check before you save." />
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-white truncate">{watched.webAgentName || 'Unnamed Agent'}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.1em]">{watched.behavior.mode} • {watched.tone} • {watched.responseLength}</p>
              </div>
            </div>
            <p className="mt-6 text-sm text-white/90 leading-relaxed text-left font-medium italic">
              "{watched.primaryGoal || 'Mission pending configuration...'}"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Sources', watched.allowedHelpCenterIds.length],
              ['FAQs', watched.faqs.length],
              ['Products', watched.products.length],
              ['Objections', watched.objections.length]
            ].map(([label, count]) => (
              <div key={label as string} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground opacity-50">{label as string}</span>
                <span className="text-sm font-bold text-white">{count}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Intelligence Profile</p>
            <p className="mt-3 text-xs text-white/90 leading-relaxed">
              {watched.behavior.askClarifyingQuestions ? 'Proactively clarifies intent, ' : 'Answers based on initial prompt, '}
              {watched.behavior.recommendNextStep ? 'guides users to next actions, ' : 'remains passive, '}
              and {watched.escalation.enabled ? 'smoothly transitions to human support when needed.' : 'operates in fully automated mode.'}
            </p>
          </div>
        </div>
      </FieldCard>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] w-[96vw] max-w-[1440px] overflow-hidden border-white/10 bg-[#0d1117] p-0 text-left text-white">
        <DialogHeader className="border-b border-white/10 bg-[#090c10] p-0">
          <div className="flex items-center justify-between gap-6 px-6 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="truncate text-lg font-bold text-white leading-none">
                  {watched.webAgentName || 'New Agent'}
                </DialogTitle>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-50">
                  Intelligence configuration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
                {[
                  ['intelligence', BrainCircuit, 'Intelligence'],
                  ['knowledge', BookOpen, 'Knowledge'],
                  ['channels', Globe, 'Channels'],
                  ['preview', Sparkles, 'Preview'],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id as string}
                    type="button"
                    onClick={() => setActiveTab(id as any)}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                      activeTab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-white'
                    )}
                  >
                    {React.createElement(Icon as any, { className: 'h-4 w-4' })}
                    {label as string}
                  </button>
                ))}
              </div>
              <Button onClick={form.handleSubmit(onSubmit, onError)} className="rounded-full px-6 font-bold h-10">Save Agent</Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full h-10 w-10">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="mx-auto max-w-7xl space-y-10 px-6 py-8 pb-24">
              <div className="grid gap-4 md:hidden">
                {[
                  ['intelligence', BrainCircuit, 'Intelligence'],
                  ['knowledge', BookOpen, 'Knowledge'],
                  ['channels', Globe, 'Channels'],
                  ['preview', Sparkles, 'Preview'],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id as string}
                    type="button"
                    onClick={() => setActiveTab(id as any)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold',
                      activeTab === id ? 'border-primary/30 bg-primary/10 text-white' : 'border-white/10 bg-white/[0.03] text-muted-foreground'
                    )}
                  >
                    {React.createElement(Icon as any, { className: 'h-4 w-4' })}
                    {label as string}
                  </button>
                ))}
              </div>

              <div className="min-w-0">
                {activeTab === 'intelligence' && renderIntelligence()}
                {activeTab === 'knowledge' && renderKnowledge()}
                {activeTab === 'channels' && renderChannels()}
                {activeTab === 'preview' && renderPreview()}
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
