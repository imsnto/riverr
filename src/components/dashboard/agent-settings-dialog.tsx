'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Globe2,
  Loader2,
  Sparkles,
  Check,
  ShieldAlert,
  Bot,
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
  hubId: z.string().optional(),
  spaceId: z.string().optional(),
  type: z.literal('agent').default('agent'),
  
  // TAB 1 — GENERAL
  webAgentName: z.string().min(1, 'Agent name is required.'),
  roleTitle: z.string().optional(),
  name: z.string().min(1, 'Internal name is required.'),
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
    notifyEmail: z.string().email('Valid email required.').or(z.literal(''))
  }),

  // TAB 2 — KNOWLEDGE
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    whatYouDo: z.string().optional(),
    whoYourCustomersAre: z.string().optional(),
    hours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiation: z.string().optional(),
    forbiddenTopics: z.string().optional(),
  }),
  allowedHelpCenterIds: z.array(z.string()).optional(),
  products: z.array(z.object({ id: z.string(), name: z.string(), price: z.string().optional(), description: z.string(), triggers: z.string() })),
  faqs: z.array(z.object({ id: z.string(), question: z.string(), answer: z.string() })),
  objections: z.array(z.object({ id: z.string(), objection: z.string(), response: z.string() })),
  qualificationFlow: z.array(z.object({ id: z.string(), question: z.string(), note: z.string().optional(), goal: z.string(), pricingPolicy: z.string() })),
  pricingPolicy: z.string().default('Always request a quote — never state prices'),

  // TAB 3 — CHANNELS
  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(false),
      agentDisplayName: z.string().optional(),
      greeting: z.object({ text: z.string(), returningText: z.string().optional() }),
      quickReplies: z.array(z.object({ id: z.string(), groupName: z.string(), trigger: z.string(), options: z.array(z.string()) })),
      capture: z.object({ timing: z.enum(['before', 'after']), fields: z.object({ name: z.boolean(), email: z.boolean(), phone: z.boolean(), company: z.boolean() }) }),
      afterHours: z.object({ mode: z.string(), message: z.string().optional() })
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      allowMms: z.boolean().default(false),
      capture: z.object({ email: z.string(), name: z.string(), message: z.string().optional() }),
      escalation: z.object({ keywords: z.array(z.string()), message: z.string(), sentiment: z.boolean() }),
      afterHours: z.object({ mode: z.string(), message: z.string().optional() })
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      mode: z.string(),
      transferNumber: z.string().optional(),
      scripts: z.object({ greeting: z.string(), handoff: z.string().optional(), voicemail: z.string().optional() }),
      behaviour: z.object({ transcribe: z.boolean(), afterHoursAiOnly: z.boolean(), voicemailFallback: z.boolean(), greetingEnabled: z.boolean(), maxDuration: z.string(), keywords: z.array(z.string()) }),
      afterHours: z.object({ mode: z.string(), redirectNumber: z.string().optional() })
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      workflow: z.object({ approval: string, delay: string, threading: string }),
      format: z.object({ signOff: string, length: string, alwaysInclude: string, subject: string }),
      escalation: z.object({ holdForValue: z.boolean(), holdForFrustration: z.boolean(), holdForLegal: z.boolean(), holdForAttachment: z.boolean(), holdForVip: z.boolean(), keywords: z.array(z.string()), sentiment: z.boolean() })
    })
  }).optional()
});

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>;

interface AgentSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bot: BotData | null;
  onSave: (data: BotData | Omit<BotData, 'id' | 'hubId'>) => void;
  appUser: User | null;
  helpCenters: HelpCenter[];
}

export default function AgentSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  appUser,
  helpCenters,
}: AgentSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [activeChannel, setActiveChannel] = useState('web');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, startCrawlTransition] = useTransition();
  const { toast } = useToast();

  const defaultFormValues: AgentSettingsFormValues = {
    webAgentName: 'Assistant',
    name: 'My AI Agent',
    isEnabled: true,
    aiEnabled: true,
    tone: 'friendly',
    primaryGoal: 'Provide information and let customer decide',
    escalationRules: { frustrationEnabled: true, unansweredLoopEnabled: true, complexRequestEnabled: true, notifyEmail: '' },
    businessContext: {},
    products: [{ id: 'p1', name: '', description: '', triggers: '' }],
    faqs: [{ id: 'f1', question: '', answer: '' }],
    objections: [{ id: 'o1', objection: '', response: '' }],
    qualificationFlow: [
      { id: 'q1', question: 'What do you need?', goal: 'Provide information and let customer decide', pricingPolicy: 'Always request a quote — never state prices' },
      { id: 'q2', question: 'How many / what quantity?', goal: 'Provide information and let customer decide', pricingPolicy: 'Always request a quote — never state prices' },
      { id: 'q3', question: 'What is your timeline?', goal: 'Provide information and let customer decide', pricingPolicy: 'Always request a quote — never state prices' }
    ],
    pricingPolicy: 'Always request a quote — never state prices',
    channelConfig: {
      web: { enabled: false, greeting: { text: 'Hi! How can I help you today?' }, quickReplies: [{ id: 'qr1', groupName: 'Opening message', trigger: 'On greeting', options: ['Tell me more', 'Get a quote', 'Contact us'] }], capture: { timing: 'after', fields: { name: true, email: true, phone: false, company: false } }, afterHours: { mode: 'ai_full' } },
      sms: { enabled: false, openingText: "Hi! You've reached us. How can I help?", maxLength: 160, capture: { email: 'natural_quote', name: 'natural' }, escalation: { keywords: ['agent', 'human', 'person'], message: 'Let me connect you with a team member now.', sentiment: true }, afterHours: { mode: 'delayed_human' } },
      phone: { enabled: false, mode: 'triage', scripts: { greeting: 'Thank you for calling. How can I help you today?' }, behaviour: { transcribe: true, afterHoursAiOnly: false, voicemailFallback: true, greetingEnabled: true, maxDuration: '5', keywords: ['manager', 'human', 'transfer'] }, afterHours: { mode: 'ai_message' } },
      email: { enabled: false, workflow: { approval: 'auto_exceptions', delay: '2-5', threading: 'thread' }, format: { signOff: '', length: 'standard', alwaysInclude: '', subject: '' }, escalation: { holdForValue: true, holdForFrustration: true, holdForLegal: true, holdForAttachment: true, holdForVip: false, keywords: ['urgent', 'manager', 'complaint', 'legal'], sentiment: true } }
    }
  };

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: defaultFormValues,
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct, replace: replaceProducts } = useFieldArray({ control: form.control, name: "products" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq, replace: replaceFaqs } = useFieldArray({ control: form.control, name: "faqs" });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" });
  const { fields: qualFields } = useFieldArray({ control: form.control, name: "qualificationFlow" });

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        const merged = {
          ...defaultFormValues,
          ...bot,
          escalationRules: { ...defaultFormValues.escalationRules, ...bot.escalationRules },
          businessContext: { ...defaultFormValues.businessContext, ...bot.businessContext },
          channelConfig: {
            web: { ...defaultFormValues.channelConfig.web, ...bot.channelConfig?.web },
            sms: { ...defaultFormValues.channelConfig.sms, ...bot.channelConfig?.sms },
            phone: { ...defaultFormValues.channelConfig.phone, ...bot.channelConfig?.phone },
            email: { ...defaultFormValues.channelConfig.email, ...bot.channelConfig?.email },
          }
        };
        form.reset(merged as any);
      } else {
        form.reset(defaultFormValues);
      }
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const handleCrawlWebsite = () => {
    let urlToCrawl = crawlUrl.trim();
    if (!urlToCrawl) return;
    if (!/^https?:\/\//i.test(urlToCrawl)) {
      urlToCrawl = `https://${urlToCrawl}`;
    }
    startCrawlTransition(async () => {
      try {
        const result = await crawlWebsiteAction(urlToCrawl);
        if (result.businessContext) {
          Object.entries(result.businessContext).forEach(([key, value]) => {
            if (value) form.setValue(`businessContext.${key as keyof typeof result.businessContext}`, value);
          });
        }
        if (result.products && result.products.length > 0) {
          replaceProducts(result.products.map(p => ({ ...p, id: `p-${Math.random()}` })));
        }
        if (result.faqs && result.faqs.length > 0) {
          replaceFaqs(result.faqs.map(f => ({ ...f, id: `f-${Math.random()}` })));
        }
        toast({ title: 'Crawl Successful' });
        setCrawlUrl('');
      } catch (e) {
        toast({ variant: 'destructive', title: 'Crawl Failed' });
      }
    });
  };

  const onSubmit = (values: AgentSettingsFormValues) => {
    onSave(values as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <DialogTitle className="sr-only">AI Agent Configuration</DialogTitle>
        <DialogDescription className="sr-only">Configure your AI Agent's intelligence and delivery channels.</DialogDescription>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 shrink-0 text-left">
                  <div className={cn("h-2 w-2 rounded-full", watchedValues.isEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600")} />
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">{watchedValues.name || 'AI Agent'}</h2>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Intelligence Config</p>
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
              <div className="p-10 max-w-4xl mx-auto pb-32 text-left">
                {activeTab === 'general' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Agent Identity</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="webAgentName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Agent Name (One word)</FormLabel><FormControl><Input placeholder="Assistant" {...field} /></FormControl></FormItem>
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
                        <FormItem><FormLabel className="text-xs">Voice Notes</FormLabel><FormControl><Textarea placeholder="Specific rules: 'Avoid corporate jargon'..." {...field} /></FormControl></FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Conversation Goal</h3>
                      <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Primary Goal</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Guide to order directly">Order directly</SelectItem><SelectItem value="Capture details and send quote">Capture & Quote</SelectItem><SelectItem value="Book a callback">Book Callback</SelectItem><SelectItem value="Collect email">Collect Email</SelectItem><SelectItem value="Provide information and let customer decide">Provide Information</SelectItem></SelectContent></Select></FormItem>
                      )} />
                      <FormField control={form.control} name="closingTemplate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Closing Template</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Shared Escalation Rules</h3>
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-xs font-bold">Order Value Threshold</Label>
                          <div className="flex items-center gap-3">
                            <Input type="number" placeholder="$" className="w-24 h-8" value={watchedValues.escalationRules?.orderValueThreshold || ''} onChange={(e) => form.setValue('escalationRules.orderValueThreshold', Number(e.target.value))} />
                            <Switch checked={watchedValues.escalationRules?.orderValueThresholdEnabled ?? false} onCheckedChange={(val) => form.setValue('escalationRules.orderValueThresholdEnabled', val)} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-xs">Frustration detected</Label><Switch checked={watchedValues.escalationRules?.frustrationEnabled ?? true} onCheckedChange={(val) => form.setValue('escalationRules.frustrationEnabled', val)} /></div>
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-xs">Same question unanswered twice</Label><Switch checked={watchedValues.escalationRules?.unansweredLoopEnabled ?? true} onCheckedChange={(val) => form.setValue('escalationRules.unansweredLoopEnabled', val)} /></div>
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-xs">Complex or custom requests</Label><Switch checked={watchedValues.escalationRules?.complexRequestEnabled ?? true} onCheckedChange={(val) => form.setValue('escalationRules.complexRequestEnabled', val)} /></div>
                        <FormField control={form.control} name="escalationRules.notifyEmail" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Escalation Notify Email</FormLabel><FormControl><Input placeholder="team@business.com" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Card className="bg-primary/5 border-primary/20 border-2 overflow-hidden">
                      <CardHeader className="bg-primary/10 py-4">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                          <Sparkles className="h-4 w-4" />
                          Knowledge Autopilot
                        </CardTitle>
                        <CardDescription className="text-xs">Enter your website URL and we'll auto-populate your context.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="riverr.app" className="pl-10 h-11 bg-background border-white/10" value={crawlUrl} onChange={(e) => setCrawlUrl(e.target.value)} />
                          </div>
                          <Button type="button" size="lg" className="font-bold gap-2 px-8" onClick={handleCrawlWebsite} disabled={isCrawling || !crawlUrl}>
                            {isCrawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {isCrawling ? 'Crawling...' : 'Crawl Website'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

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
                        <FormItem><FormLabel className="text-xs">What you do (Details)</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="businessContext.whoYourCustomersAre" render={({ field }) => (
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
                        <FormItem><FormLabel className="text-xs">Topics never to discuss</FormLabel><FormControl><Input placeholder="Comma-separated..." {...field} /></FormControl></FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Connected Libraries</h3>
                      <FormField control={form.control} name="allowedHelpCenterIds" render={({ field }) => (
                        <FormItem>
                          <div className="grid gap-2">
                            {helpCenters.map((hc) => (
                              <div key={hc.id} className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><BookOpen className="h-4 w-4" /></div>
                                  <div><p className="text-xs font-bold">{hc.name}</p><p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">{hc.visibility || 'PUBLIC'}</p></div>
                                </div>
                                <Checkbox checked={field.value?.includes(hc.id)} onCheckedChange={(checked) => { const current = field.value || []; field.onChange(checked ? [...current, hc.id] : current.filter(id => id !== hc.id)); }} />
                              </div>
                            ))}
                          </div>
                        </FormItem>
                      )} />
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Products, FAQs & Objections</h3>
                      <Tabs defaultValue="products">
                        <TabsList className="bg-white/5"><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="faqs">FAQs</TabsTrigger><TabsTrigger value="objections">Objections</TabsTrigger></TabsList>
                        <TabsContent value="products" className="space-y-4 mt-4">
                          {productFields.map((field, index) => (
                            <Card key={field.id} className="bg-[#161b22] border-white/10 relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeProduct(index)}><Trash2 className="h-3 w-3" /></Button>
                              <CardContent className="p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><Input placeholder="Name" {...form.register(`products.${index}.name` as any)} /><Input placeholder="Price" {...form.register(`products.${index}.price` as any)} /></div><Textarea placeholder="Description" {...form.register(`products.${index}.description` as any)} /><Input placeholder="Recommendation triggers..." {...form.register(`products.${index}.triggers` as any)} /></CardContent>
                            </Card>
                          ))}
                          <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendProduct({ id: Date.now().toString(), name: '', description: '', triggers: '' })}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
                        </TabsContent>
                        <TabsContent value="faqs" className="space-y-4 mt-4">
                          {faqFields.map((field, index) => (
                            <Card key={field.id} className="bg-[#161b22] border-white/10 relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeFaq(index)}><Trash2 className="h-3 w-3" /></Button>
                              <CardContent className="p-6 space-y-4"><Input placeholder="Question" {...form.register(`faqs.${index}.question` as any)} /><Textarea placeholder="Answer" {...form.register(`faqs.${index}.answer` as any)} /></CardContent>
                            </Card>
                          ))}
                          <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendFaq({ id: Date.now().toString(), question: '', answer: '' })}><Plus className="h-4 w-4 mr-2" /> Add FAQ</Button>
                        </TabsContent>
                        <TabsContent value="objections" className="space-y-4 mt-4">
                          {objectionFields.map((field, index) => (
                            <Card key={field.id} className="bg-[#161b22] border-white/10 relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeObjection(index)}><Trash2 className="h-3 w-3" /></Button>
                              <CardContent className="p-6 space-y-4"><Input placeholder="Objection" {...form.register(`objections.${index}.objection` as any)} /><Textarea placeholder="Response" {...form.register(`objections.${index}.response` as any)} /></CardContent>
                            </Card>
                          ))}
                          <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendObjection({ id: Date.now().toString(), objection: '', response: '' })}><Plus className="h-4 w-4 mr-2" /> Add Objection</Button>
                        </TabsContent>
                      </Tabs>
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Qualification Flow</h3>
                      <div className="space-y-4">
                        {qualFields.map((field, index) => (
                          <Card key={field.id} className="bg-[#161b22] border-white/10">
                            <CardContent className="p-6 space-y-4">
                              <Input placeholder="Question" {...form.register(`qualificationFlow.${index}.question` as any)} />
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name={`qualificationFlow.${index}.goal`} render={({ field }) => (
                                  <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Guide to order directly">Order directly</SelectItem><SelectItem value="Capture details and send quote">Capture & Quote</SelectItem><SelectItem value="Book a callback">Book Callback</SelectItem><SelectItem value="Collect email">Collect Email</SelectItem><SelectItem value="Provide information">Provide Information</SelectItem></SelectContent></Select></FormItem>
                                )} />
                                <FormField control={form.control} name={`qualificationFlow.${index}.pricingPolicy`} render={({ field }) => (
                                  <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="State prices directly">State prices</SelectItem><SelectItem value="Ranges only">Ranges only</SelectItem><SelectItem value="Always request a quote">Always request quote</SelectItem></SelectContent></Select></FormItem>
                                )} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 p-1 rounded-xl mb-10 overflow-x-auto">
                      {[
                        { id: 'web', label: 'Web Chat', icon: MessageSquare },
                        { id: 'sms', label: 'SMS', icon: Smartphone },
                        { id: 'phone', label: 'Phone', icon: Phone },
                        { id: 'email', label: 'Email', icon: Mail }
                      ].map(ch => (
                        <button key={ch.id} type="button" onClick={() => setActiveChannel(ch.id)} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap", activeChannel === ch.id ? "bg-white/[0.05] text-white shadow-lg" : "text-muted-foreground hover:text-white")}>
                          <ch.icon className="h-4 w-4" />{ch.label}{watchedValues.channelConfig?.[ch.id as keyof typeof watchedValues.channelConfig]?.enabled && (<div className="h-1.5 w-1.5 rounded-full bg-green-500 ml-1" />)}
                        </button>
                      ))}
                    </div>

                    {activeChannel === 'web' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Web Chat</Label><Switch checked={watchedValues.channelConfig?.web?.enabled ?? false} onCheckedChange={(val) => form.setValue('channelConfig.web.enabled', val)} /></div>
                        <div className={cn("space-y-10", !watchedValues.channelConfig?.web?.enabled && "opacity-40 pointer-events-none")}>
                          <section className="space-y-6">
                            <Label className="text-xs font-bold uppercase tracking-widest text-primary">Greetings & Messaging</Label>
                            <FormField control={form.control} name="channelConfig.web.agentDisplayName" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Agent Display Name Override</FormLabel><FormControl><Input placeholder="Inherits from General..." {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Opening Greeting</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                            )} />
                          </section>
                          <section className="space-y-6">
                            <Label className="text-xs font-bold uppercase tracking-widest text-primary">Lead Capture</Label>
                            <RadioGroup onValueChange={(v) => form.setValue('channelConfig.web.capture.timing', v as 'before' | 'after')} value={watchedValues.channelConfig?.web?.capture?.timing || 'after'} className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2"><RadioGroupItem value="before" id="cap-before" /><Label htmlFor="t-before">Before first response</Label></div>
                              <div className="flex items-center gap-2"><RadioGroupItem value="after" id="cap-after" /><Label htmlFor="t-after">After first response</Label></div>
                            </RadioGroup>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2"><Checkbox checked={watchedValues.channelConfig?.web?.capture?.fields?.name} onCheckedChange={(v) => form.setValue('channelConfig.web.capture.fields.name', !!v)} id="f-name" /><Label htmlFor="f-name">Capture Name</Label></div>
                              <div className="flex items-center gap-2"><Checkbox checked={watchedValues.channelConfig?.web?.capture?.fields?.email} onCheckedChange={(v) => form.setValue('channelConfig.web.capture.fields.email', !!v)} id="f-email" /><Label htmlFor="f-email">Capture Email</Label></div>
                            </div>
                          </section>
                        </div>
                      </div>
                    )}

                    {activeChannel === 'sms' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable SMS</Label><Switch checked={watchedValues.channelConfig?.sms?.enabled ?? false} onCheckedChange={(val) => form.setValue('channelConfig.sms.enabled', val)} /></div>
                        <div className={cn("space-y-8", !watchedValues.channelConfig?.sms?.enabled && "opacity-40 pointer-events-none")}>
                          <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (<FormItem><FormLabel className="text-xs">Opening Text</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>)} />
                          <FormField control={form.control} name="channelConfig.sms.maxLength" render={({ field }) => (<FormItem><FormLabel className="text-xs">Max Response Length (chars)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                          <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-xs">Escalate on repeated negative sentiment</Label><Switch checked={watchedValues.channelConfig?.sms?.escalation?.sentiment ?? true} onCheckedChange={(val) => form.setValue('channelConfig.sms.escalation.sentiment', val)} /></div>
                        </div>
                      </div>
                    )}

                    {activeChannel === 'phone' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Phone</Label><Switch checked={watchedValues.channelConfig?.phone?.enabled ?? false} onCheckedChange={(val) => form.setValue('channelConfig.phone.enabled', val)} /></div>
                        <div className={cn("space-y-8", !watchedValues.channelConfig?.phone?.enabled && "opacity-40 pointer-events-none")}>
                          <FormField control={form.control} name="channelConfig.phone.mode" render={({ field }) => (<FormItem><FormLabel className="text-xs">Call Mode</FormLabel><Select onValueChange={field.onChange} value={field.value || 'triage'}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="full_ai">Full AI</SelectItem><SelectItem value="triage">AI Triage + Handoff</SelectItem><SelectItem value="receptionist">Receptionist Only</SelectItem></SelectContent></Select></FormItem>)} />
                          <FormField control={form.control} name="channelConfig.phone.scripts.greeting" render={({ field }) => (<FormItem><FormLabel className="text-xs">AI Greeting Script</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>)} />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]"><Label className="text-xs">Voicemail Fallback</Label><Switch checked={watchedValues.channelConfig?.phone?.behaviour?.voicemailFallback ?? true} onCheckedChange={(val) => form.setValue('channelConfig.phone.behaviour.voicemailFallback', val)} /></div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]"><Label className="text-xs">Transcribe All Calls</Label><Switch checked={watchedValues.channelConfig?.phone?.behaviour?.transcribe ?? true} onCheckedChange={(val) => form.setValue('channelConfig.phone.behaviour.transcribe', val)} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeChannel === 'email' && (
                      <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Email</Label><Switch checked={watchedValues.channelConfig?.email?.enabled ?? false} onCheckedChange={(val) => form.setValue('channelConfig.email.enabled', val)} /></div>
                        <div className={cn("grid grid-cols-2 gap-10", !watchedValues.channelConfig?.email?.enabled && "opacity-40 pointer-events-none")}>
                          <section className="space-y-6">
                            <FormField control={form.control} name="channelConfig.email.workflow.approval" render={({ field }) => (<FormItem><FormLabel className="text-xs">Approval Workflow</FormLabel><Select onValueChange={field.onChange} value={field.value || 'auto_exceptions'}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="auto">Auto-send</SelectItem><SelectItem value="auto_exceptions">Flag Exceptions</SelectItem><SelectItem value="manual">Manual Approval</SelectItem></SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="channelConfig.email.workflow.delay" render={({ field }) => (<FormItem><FormLabel className="text-xs">Reply Delay</FormLabel><Select onValueChange={field.onChange} value={field.value || '2-5'}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="immediate">Immediate</SelectItem><SelectItem value="2-5">2–5 min</SelectItem><SelectItem value="15-30">15–30 min</SelectItem></SelectContent></Select></FormItem>)} />
                          </section>
                          <section className="space-y-6">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]"><Label className="text-xs">Hold for orders</Label><Switch checked={watchedValues.channelConfig?.email?.escalation?.holdForValue ?? true} onCheckedChange={(val) => form.setValue('channelConfig.email.escalation.holdForValue', val)} /></div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-white/[0.02]"><Label className="text-xs">Hold for attachments</Label><Switch checked={watchedValues.channelConfig?.email?.escalation?.holdForAttachment ?? true} onCheckedChange={(val) => form.setValue('channelConfig.email.escalation.holdForAttachment', val)} /></div>
                          </section>
                        </div>
                      </div>
                    )}
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
