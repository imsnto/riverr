
'use client';

import React, { useEffect, useState, useTransition } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const agentSettingsSchema = z.object({
  id: z.string().optional(),
  hubId: z.string().optional(),
  spaceId: z.string().optional(),
  type: z.literal('agent').default('agent'),
  
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

  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(false),
      greeting: z.object({ text: z.string() }),
      capture: z.object({ timing: z.enum(['before', 'after']), fields: z.object({ name: z.boolean(), email: z.boolean(), phone: z.boolean() }) }),
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      escalation: z.object({ keywords: z.array(z.string()), sentiment: z.boolean() }),
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      mode: z.string(),
      scripts: z.object({ greeting: z.string() }),
      behaviour: z.object({ transcribe: z.boolean(), voicemailFallback: z.boolean(), maxDuration: z.string() }),
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      workflow: z.object({ approval: z.string(), delay: z.string(), threading: z.string() }),
      format: z.object({ signOff: z.string(), length: z.string(), alwaysInclude: z.string(), subject: z.string() }),
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
    escalationRules: { frustrationEnabled: true, unansweredLoopEnabled: true, complexRequestEnabled: true, notifyEmail: '', orderValueThresholdEnabled: false },
    businessContext: {},
    products: [],
    faqs: [],
    objections: [],
    qualificationFlow: [
      { id: 'q1', question: 'What do you need?', goal: 'Provide information', pricingPolicy: 'Always request a quote' },
      { id: 'q2', question: 'How many?', goal: 'Provide information', pricingPolicy: 'Always request a quote' },
      { id: 'q3', question: 'Timeline?', goal: 'Provide information', pricingPolicy: 'Always request a quote' }
    ],
    pricingPolicy: 'Always request a quote — never state prices',
    channelConfig: {
      web: { enabled: false, greeting: { text: 'Hi! How can I help?' }, capture: { timing: 'after', fields: { name: true, email: true, phone: false } } },
      sms: { enabled: false, openingText: "Hi! How can I help?", maxLength: 160, escalation: { keywords: ['agent'], sentiment: true } },
      phone: { enabled: false, mode: 'triage', scripts: { greeting: 'Hi! How can I help?' }, behaviour: { transcribe: true, voicemailFallback: true, maxDuration: '5' } },
      email: { enabled: false, workflow: { approval: 'auto_exceptions', delay: '2-5', threading: 'thread' }, format: { signOff: '', length: 'standard', alwaysInclude: '', subject: '' }, escalation: { holdForValue: true, holdForFrustration: true, holdForLegal: false, holdForAttachment: false, holdForVip: false, keywords: ['urgent'], sentiment: true } }
    }
  };

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: defaultFormValues,
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct, replace: replaceProducts } = useFieldArray({ control: form.control, name: "products" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq, replace: replaceFaqs } = useFieldArray({ control: form.control, name: "faqs" });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" });

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        const merged = {
          ...defaultFormValues,
          ...bot,
          escalationRules: { 
            ...defaultFormValues.escalationRules, 
            ...(bot.escalationRules || {}) 
          },
          businessContext: { 
            ...defaultFormValues.businessContext, 
            ...(bot.businessContext || {}) 
          },
          channelConfig: {
            web: { ...defaultFormValues.channelConfig!.web, ...(bot.channelConfig?.web || {}) },
            sms: { ...defaultFormValues.channelConfig!.sms, ...(bot.channelConfig?.sms || {}) },
            phone: { ...defaultFormValues.channelConfig!.phone, ...(bot.channelConfig?.phone || {}) },
            email: { ...defaultFormValues.channelConfig!.email, ...(bot.channelConfig?.email || {}) },
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
    if (!/^https?:\/\//i.test(urlToCrawl)) urlToCrawl = `https://${urlToCrawl}`;
    
    startCrawlTransition(async () => {
      try {
        const result = await crawlWebsiteAction(urlToCrawl);
        if (result.businessContext) {
          Object.entries(result.businessContext).forEach(([key, value]) => {
            if (value) form.setValue(`businessContext.${key as any}`, value);
          });
        }
        if (result.products) replaceProducts(result.products.map(p => ({ ...p, id: `p-${Math.random()}` })));
        if (result.faqs) replaceFaqs(result.faqs.map(f => ({ ...f, id: `f-${Math.random()}` })));
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
        <DialogDescription className="sr-only">Logic and intelligence hub for the agent brain.</DialogDescription>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden text-left">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 shrink-0 text-left">
                  <div className={cn("h-2 w-2 rounded-full", watchedValues.isEnabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-600")} />
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">{watchedValues.name || 'AI Brain'}</h2>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Behavior Config</p>
                  </div>
                </div>

                <nav className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/5">
                  {[
                    { id: 'general', label: 'Intelligence', icon: Settings },
                    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
                    { id: 'channels', label: 'Channel Logic', icon: Globe }
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
              <div className="p-10 max-w-4xl mx-auto pb-32 space-y-12">
                {activeTab === 'general' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Core Settings</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="webAgentName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Agent Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="tone" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Tone</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="formal">Formal</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent></Select></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Escalation Triggers</h3>
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-xs font-bold">Frustration Detection</Label>
                          <Switch checked={watchedValues.escalationRules?.frustrationEnabled} onCheckedChange={(v) => form.setValue('escalationRules.frustrationEnabled', v)} />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                          <Label className="text-xs font-bold">Complexity Threshold</Label>
                          <Switch checked={watchedValues.escalationRules?.complexRequestEnabled} onCheckedChange={(v) => form.setValue('escalationRules.complexRequestEnabled', v)} />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Card className="bg-primary/5 border-primary/20 border-2 overflow-hidden">
                      <CardHeader className="py-4"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> Autopilot</CardTitle></CardHeader>
                      <CardContent><div className="flex gap-3"><Input placeholder="riverr.app" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} /><Button onClick={handleCrawlWebsite} disabled={isCrawling}>{isCrawling ? <Loader2 className="animate-spin h-4 w-4" /> : 'Crawl'}</Button></div></CardContent>
                    </Card>

                    <section className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Context</h3>
                      <FormField control={form.control} name="businessContext.whatYouDo" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">What you do</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl></FormItem>
                      )} />
                    </section>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Tabs value={activeChannel} onValueChange={setActiveChannel}>
                      <TabsList className="bg-white/5"><TabsTrigger value="web">Web</TabsTrigger><TabsTrigger value="sms">SMS</TabsTrigger><TabsTrigger value="phone">Phone</TabsTrigger><TabsTrigger value="email">Email</TabsTrigger></TabsList>
                      <TabsContent value="web" className="space-y-6 mt-6">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Web Channel</Label><Switch checked={watchedValues.channelConfig?.web?.enabled} onCheckedChange={v => form.setValue('channelConfig.web.enabled', v)} /></div>
                        {watchedValues.channelConfig?.web?.enabled && (
                          <div className="space-y-6 pl-4 border-l-2 border-primary/20 animate-in slide-in-from-left-2 duration-300">
                            <FormField control={form.control} name="channelConfig.web.greeting.text" render={({ field }) => (<FormItem><FormLabel className="text-xs">Greeting Script</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>)} />
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
