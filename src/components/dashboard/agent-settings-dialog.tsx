'use client';

import React, { useEffect, useState } from 'react';
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
import { Bot as BotData, User, HelpCenter } from '@/lib/data';
import { 
  BookOpen, 
  Globe, 
  X, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Smartphone, 
  Phone, 
  Mail, 
  BrainCircuit,
  Users,
  Palette,
  CheckCircle2,
  ShieldCheck,
  Target,
  Zap,
  Mic,
  Settings2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Package,
  HelpCircle,
  Ban
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
  intelligenceAccessLevel: z.enum(['none', 'articles_only', 'topics_allowed', 'insights_hidden_support', 'internal_full_access']).default('topics_allowed'),

  // Intelligence - Personality
  tone: z.enum(['friendly', 'formal', 'expert', 'direct', 'warm']).default('friendly'),
  voiceNotes: z.string().optional(),
  responseLength: z.enum(['short', 'balanced', 'detailed']).default('balanced'),

  // Intelligence - Goals
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  secondaryGoal: z.string().optional(),
  closingTemplate: z.string().optional(),

  // Intelligence - Escalation
  escalation: z.object({
    enabled: z.boolean().default(true),
    notifyEmail: z.string().optional(),
    frustration: z.boolean().default(true),
    repeatedFailures: z.boolean().default(true),
  }),

  // Knowledge - Business Context
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
  }),

  // Knowledge - Sources
  allowedHelpCenterIds: z.array(z.string()).default([]),

  // Knowledge - Repeatable Lists
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.string().optional(),
    description: z.string(),
    triggers: z.string(),
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
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      operationMode: z.enum(['full_ai', 'handoff', 'receptionist']).default('handoff'),
      greetingScript: z.string().default('Thank you for calling. How can I help today?'),
      voicemailScript: z.string().default('We’re unavailable right now. Please leave a message.'),
      transcribeCalls: z.boolean().default(true),
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      approvalMode: z.enum(['auto', 'auto_exceptions', 'manual']).default('auto_exceptions'),
      standardSignoff: z.string().default('Best regards, {{agent_name}}'),
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
  intelligenceAccessLevel: 'topics_allowed',
  tone: 'friendly',
  voiceNotes: '',
  responseLength: 'balanced',
  primaryGoal: 'Provide helpful support answers.',
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
  },
  products: [],
  faqs: [],
  objections: [],
  allowedHelpCenterIds: [],
  channelConfig: {
    web: { enabled: true, greeting: { text: 'Hi! How can I help today?', returningText: 'Welcome back!' } },
    sms: { enabled: false, openingText: 'Hi! How can I help?', maxResponseLength: 160, leadCaptureMessage: '', handoffKeywords: [] },
    phone: { enabled: false, operationMode: 'handoff', greetingScript: '', voicemailScript: '', transcribeCalls: true },
    email: { enabled: false, approvalMode: 'auto_exceptions', standardSignoff: '' }
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

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        form.reset({ ...DEFAULT_AGENT_VALUES, ...(bot as any) });
      } else {
        form.reset(DEFAULT_AGENT_VALUES as any);
      }
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
                <div className="flex items-center gap-3 shrink-0 text-left">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold text-white leading-none">{watchedValues.webAgentName || 'Unnamed Agent'}</DialogTitle>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Intelligence Configuration</p>
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
                <Button onClick={form.handleSubmit(onSubmit)} className="rounded-full h-9 px-6 font-bold">Save Agent</Button>
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
                          <FormItem>
                            <FormLabel className="text-xs">Public Agent Name</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} placeholder="What customers call the agent" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Internal Name</FormLabel>
                            <FormControl><Input {...field} value={field.value || ''} placeholder="How you identify this brain" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Knowledge Policy</h3>
                      </div>
                      <FormField control={form.control} name="intelligenceAccessLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Intelligence Access Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Disabled (No Context)</SelectItem>
                              <SelectItem value="articles_only">Library Articles Only (Strict)</SelectItem>
                              <SelectItem value="topics_allowed">Articles + Intelligence Topics</SelectItem>
                              <SelectItem value="insights_hidden_support">Articles + Hidden Support Signal</SelectItem>
                              <SelectItem value="internal_full_access">Full Internal Memory</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Palette className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Personality & Style</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="tone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Primary Tone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                                <SelectItem value="formal">Professional & Formal</SelectItem>
                                <SelectItem value="expert">Expert & Authoritative</SelectItem>
                                <SelectItem value="direct">Direct & Concise</SelectItem>
                                <SelectItem value="warm">Warm & Empathetic</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="responseLength" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Response Length</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="short">Short (One sentence)</SelectItem>
                                <SelectItem value="balanced">Balanced (2-3 sentences)</SelectItem>
                                <SelectItem value="detailed">Detailed (In-depth help)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-16 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><GraduationCap className="h-3 w-3 mr-1" /> Training</Badge>
                        <h3 className="text-sm font-bold uppercase tracking-widest">Business Context</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="businessContext.businessName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Official Business Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.hours" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Operating Hours</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="e.g. Mon-Fri 9am-5pm EST" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.description" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Business Description (What we do)</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.differentiation" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Key Differentiators (Why us?)</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.forbiddenTopics" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Ban className="h-3.5 w-3.5 text-rose-500" />
                                <FormLabel className="text-xs">Strictly Forbidden Topics</FormLabel>
                            </div>
                            <FormControl><Input {...field} value={field.value || ''} placeholder="Topics the agent must never discuss" /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </section>

                    <Separator className="border-white/5" />

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <Package className="h-4 w-4" />
                          <h3 className="text-sm font-bold uppercase tracking-widest">Key Products/Services</h3>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendProduct({ id: Date.now().toString(), name: '', description: '', triggers: '' })}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {productFields.map((item, idx) => (
                          <div key={item.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4 relative group">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeProduct(idx)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name={`products.${idx}.name`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px]">Product Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name={`products.${idx}.price`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px]">Price/Range</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                              )} />
                            </div>
                            <FormField control={form.control} name={`products.${idx}.description`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`products.${idx}.triggers`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">When to recommend this?</FormLabel><FormControl><Input {...field} placeholder="Keywords or situations" /></FormControl></FormItem>
                            )} />
                          </div>
                        ))}
                      </div>
                    </section>

                    <Separator className="border-white/5" />

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <HelpCircle className="h-4 w-4" />
                          <h3 className="text-sm font-bold uppercase tracking-widest">Fixed FAQs</h3>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendFaq({ id: Date.now().toString(), question: '', answer: '' })}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {faqFields.map((item, idx) => (
                          <div key={item.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4 relative group">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeFaq(idx)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                            <FormField control={form.control} name={`faqs.${idx}.question`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">Question</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`faqs.${idx}.answer`} render={({ field }) => (
                              <FormItem><FormLabel className="text-[10px]">Answer</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                            )} />
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
                          <MessageSquare className="h-3.5 w-3.5" /> Web
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
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02] border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><MessageSquare className="h-5 w-5" /></div>
                            <div>
                              <p className="text-sm font-bold text-white">Enable for Web Widget</p>
                              <p className="text-[10px] text-muted-foreground">Allow this agent to respond on the website chat.</p>
                            </div>
                          </div>
                          <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>
                        
                        {watchedValues.channelConfig.web.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-primary/20 animate-in slide-in-from-left-2 duration-300">
                            <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Initial Greeting</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ''} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.web.greeting.returningText" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Returning Visitor Greeting</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                            )} />
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="sms" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02] border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Smartphone className="h-5 w-5" /></div>
                            <div>
                              <p className="text-sm font-bold text-white">Enable for SMS</p>
                              <p className="text-[10px] text-muted-foreground">Respond to text messages automatically.</p>
                            </div>
                          </div>
                          <FormField control={form.control} name="channelConfig.sms.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>

                        {watchedValues.channelConfig.sms.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-emerald-500/20 animate-in slide-in-from-left-2 duration-300">
                            <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">First Text Response</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-6">
                              <FormField control={form.control} name="channelConfig.sms.maxResponseLength" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Max Character Limit</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription className="text-[9px]">Sms segments are ~160 chars.</FormDescription></FormItem>
                              )} />
                            </div>
                            <FormField control={form.control} name="channelConfig.sms.leadCaptureMessage" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Lead Capture Request (SMS Style)</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl></FormItem>
                            )} />
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="phone" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02] border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500"><Phone className="h-5 w-5" /></div>
                            <div>
                              <p className="text-sm font-bold text-white">Enable for Voice</p>
                              <p className="text-[10px] text-muted-foreground">Handle phone calls with AI Voice.</p>
                            </div>
                          </div>
                          <FormField control={form.control} name="channelConfig.phone.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>

                        {watchedValues.channelConfig.phone.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-orange-500/20 animate-in slide-in-from-left-2 duration-300">
                            <FormField control={form.control} name="channelConfig.phone.operationMode" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Call Handling Mode</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="full_ai">Full AI Resolution</SelectItem>
                                    <SelectItem value="handoff">Triage & Transfer</SelectItem>
                                    <SelectItem value="receptionist">Simple Receptionist</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.phone.greetingScript" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Greeting Script (Text-to-Speech)</FormLabel>
                                <FormControl><Textarea rows={3} {...field} value={field.value || ''} placeholder="What the AI says when it picks up." /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.phone.voicemailScript" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Voicemail Instructions</FormLabel>
                                <FormControl><Textarea rows={2} {...field} value={field.value || ''} /></FormControl>
                              </FormItem>
                            )} />
                            <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.01]">
                              <div className="flex items-center gap-2">
                                <Mic className="h-4 w-4 text-muted-foreground" />
                                <Label className="text-xs">Record & Transcribe Calls</Label>
                              </div>
                              <FormField control={form.control} name="channelConfig.phone.transcribeCalls" render={({ field }) => (
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              )} />
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="email" className="space-y-10">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02] border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500"><Mail className="h-5 w-5" /></div>
                            <div>
                              <p className="text-sm font-bold text-white">Enable for Email</p>
                              <p className="text-[10px] text-muted-foreground">Draft or send email replies automatically.</p>
                            </div>
                          </div>
                          <FormField control={form.control} name="channelConfig.email.enabled" render={({ field }) => (
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          )} />
                        </div>

                        {watchedValues.channelConfig.email.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-indigo-500/20 animate-in slide-in-from-left-2 duration-300">
                            <FormField control={form.control} name="channelConfig.email.approvalMode" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Reply Approval Mode</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="auto">Fully Automated (Risky)</SelectItem>
                                    <SelectItem value="auto_exceptions">Auto-reply (except high value/frustrated)</SelectItem>
                                    <SelectItem value="manual">Manual Approval Only (Drafts only)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.email.standardSignoff" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Signature / Sign-off</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ''} placeholder="Best regards, {{agent_name}}" /></FormControl></FormItem>
                            )} />
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
