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
  FileText,
  BrainCircuit,
  Users,
  Palette
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
  type: z.literal('agent').default('agent'),

  // Core identity
  name: z.string().min(1, 'Agent Name is required'),
  internalName: z.string().min(1, 'Internal Name is required'),
  roleTitle: z.string().optional(),

  // Personality
  tone: z.enum(['friendly', 'formal', 'expert', 'direct', 'warm']).default('friendly'),
  voiceNotes: z.string().optional(),

  // Goal
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  closingMessage: z.string().optional(),

  // Escalation
  escalation: z.object({
    enabled: z.boolean().default(true),
    notifyEmail: z.string().email('Valid email required').or(z.literal('')),
    highValue: z.object({
      enabled: z.boolean().default(false),
      threshold: z.coerce.number().default(1000),
    }),
    frustration: z.boolean().default(true),
    repeatedFailures: z.boolean().default(true),
    complexRequests: z.boolean().default(true),
  }),

  // Knowledge
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    customers: z.string().optional(),
    hours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiation: z.string().optional(),
    forbiddenTopics: z.string().optional(),
  }),

  // Knowledge Sources
  allowedHelpCenterIds: z.array(z.string()).default([]),

  // Lists
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

  pricingPolicy: z.string().optional(),

  // Channels
  channelConfig: z.object({
    web: z.object({
      enabled: z.boolean().default(false),
      greeting: z.string().optional(),
      returningGreeting: z.string().optional(),
      leadCapture: z.object({
        timing: z.enum(['before', 'after']).default('after'),
        name: z.boolean().default(true),
        email: z.boolean().default(true),
        phone: z.boolean().default(false),
      }),
      quickReplies: z.array(z.string()).default([]),
      afterHoursMessage: z.string().optional(),
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      openingText: z.string().optional(),
      maxLength: z.coerce.number().default(160),
      collectName: z.boolean().default(true),
      collectEmail: z.boolean().default(true),
      escalationKeywords: z.array(z.string()).default(['agent', 'human']),
      sentimentEscalation: z.boolean().default(true),
      afterHoursMessage: z.string().optional(),
    }),
    phone: z.object({
      enabled: z.boolean().default(false),
      mode: z.enum(['full_ai', 'handoff', 'receptionist']).default('handoff'),
      transferNumber: z.string().optional(),
      greetingScript: z.string().optional(),
      handoffScript: z.string().optional(),
      voicemailScript: z.string().optional(),
      transcribe: z.boolean().default(true),
      voicemailFallback: z.boolean().default(true),
      maxDuration: z.coerce.number().default(5),
      escalationKeywords: z.array(z.string()).default(['emergency', 'operator']),
      afterHoursRedirect: z.string().optional(),
    }),
    email: z.object({
      enabled: z.boolean().default(false),
      approvalMode: z.enum(['auto', 'auto_exceptions', 'manual']).default('auto_exceptions'),
      delay: z.coerce.number().default(5),
      threading: z.enum(['reply', 'new']).default('reply'),
      signoff: z.string().optional(),
      responseLength: z.enum(['short', 'medium', 'long']).default('medium'),
      alwaysInclude: z.string().optional(),
      subjectTemplate: z.string().optional(),
      escalation: z.object({
        highValue: z.boolean().default(true),
        frustration: z.boolean().default(true),
        legal: z.boolean().default(false),
        attachment: z.boolean().default(false),
        vip: z.boolean().default(true),
      }),
      escalationKeywords: z.array(z.string()).default(['legal', 'sue', 'refund']),
      sentimentEscalation: z.boolean().default(true),
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
  const [activeTab, setActiveTab] = useState('general');
  const [activeChannel, setActiveChannel] = useState('web');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, startCrawlTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
    defaultValues: {
      name: 'Assistant',
      internalName: 'Support Agent V1',
      tone: 'friendly',
      primaryGoal: 'Assist customers with their inquiries using the provided knowledge base.',
      escalation: { enabled: true, frustration: true, repeatedFailures: true, complexRequests: true, highValue: { enabled: false, threshold: 1000 }, notifyEmail: '' },
      businessContext: {},
      channelConfig: {
        web: { enabled: false, leadCapture: { timing: 'after', name: true, email: true, phone: false }, quickReplies: [] },
        sms: { enabled: false, maxLength: 160, collectName: true, collectEmail: true, escalationKeywords: ['agent'], sentimentEscalation: true },
        phone: { enabled: false, mode: 'handoff', transcribe: true, voicemailFallback: true, maxDuration: 5, escalationKeywords: ['operator'] },
        email: { enabled: false, approvalMode: 'auto_exceptions', delay: 5, threading: 'reply', responseLength: 'medium', escalation: { highValue: true, frustration: true, vip: true, legal: false, attachment: false }, escalationKeywords: ['legal'], sentimentEscalation: true }
      }
    },
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({ control: form.control, name: "products" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });
  const { fields: objectionFields, append: appendObjection, remove: removeObjection } = useFieldArray({ control: form.control, name: "objections" });
  const { fields: qualificationFields, append: appendQualification, remove: removeQualification } = useFieldArray({ control: form.control, name: "qualificationFlow" });

  useEffect(() => {
    if (isOpen && bot) {
      form.reset(bot as any);
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
    const webCapture = values.channelConfig?.web?.leadCapture;

    const payload: BotData | Omit<BotData, 'id' | 'hubId'> = {
      ...(bot || {}),
      ...values,
      type: 'agent',
      identityCapture: webCapture
        ? {
            enabled: true,
            required: false,
            timing: webCapture.timing,
            fields: {
              name: !!webCapture.name,
              email: !!webCapture.email,
              phone: !!webCapture.phone,
            },
          }
        : {
            enabled: false,
            required: false,
            timing: 'after',
            fields: {
              name: true,
              email: true,
              phone: false,
            },
          },
      welcomeMessage:
        values.channelConfig?.web?.greeting ||
        values.name ||
        'Hi! How can I help?',
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
                    <h2 className="text-sm font-bold text-white leading-none">{watchedValues.name || 'AI Brain'}</h2>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Behavior Config</p>
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
              <div className="p-10 max-w-4xl mx-auto pb-32 space-y-12">
                {activeTab === 'general' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Users className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Identity</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Agent Name (Public)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="internalName" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Internal ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="roleTitle" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Role Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Senior Support Specialist" /></FormControl></FormItem>
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
                          <FormItem><FormLabel className="text-xs">Tone of Voice</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="friendly">Friendly & Warm</SelectItem>
                                <SelectItem value="formal">Formal & Professional</SelectItem>
                                <SelectItem value="expert">Expert & Authoritative</SelectItem>
                                <SelectItem value="direct">Direct & Concise</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="voiceNotes" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">Voice & Style Notes</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="e.g. Always use 'we' instead of 'I'. Never use emojis." /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Target className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Goals & Closing</h3>
                      </div>
                      <div className="grid gap-6">
                        <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Primary Goal</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="What is the AI's main objective?" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="closingMessage" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Standard Closing Message</FormLabel><FormControl><Textarea rows={2} {...field} placeholder="How should the AI end conversations?" /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldAlert className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Escalation Controls</h3>
                      </div>
                      <div className="space-y-4">
                        <FormField control={form.control} name="escalation.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                            <div className="space-y-0.5"><FormLabel className="text-sm font-bold">Enable Escalation</FormLabel><FormDescription className="text-xs">Allow the AI to hand off to humans.</FormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        
                        {watchedValues.escalation?.enabled && (
                          <div className="grid gap-4 pl-6 border-l-2 border-primary/20">
                            <FormField control={form.control} name="escalation.notifyEmail" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Notification Email</FormLabel><FormControl><Input {...field} placeholder="alerts@yourcompany.com" /></FormControl></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="escalation.frustration" render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Frustration Detection</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name="escalation.complexRequests" render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-3 border rounded-lg bg-background/50"><FormLabel className="text-xs">Complex Requests</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                              )} />
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'knowledge' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <Card className="bg-primary/5 border-primary/20 border-2 overflow-hidden">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                          <Sparkles className="h-4 w-4" /> 
                          Knowledge Autopilot
                        </CardTitle>
                        <CardDescription className="text-xs">Extract your business info automatically from your website.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3">
                          <Input placeholder="e.g. yourwebsite.com" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} className="bg-background" />
                          <Button type="button" onClick={handleCrawlWebsite} disabled={isCrawling} className="shrink-0 font-bold">
                            {isCrawling ? <Loader2 className="animate-spin h-4 w-4" /> : 'Start Crawl'}
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
                          <FormItem><FormLabel className="text-xs">Official Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.location" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Location / Service Area</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.description" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">What You Do</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.customers" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Who Your Customers Are</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.hours" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Business Hours</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="businessContext.differentiation" render={({ field }) => (
                          <FormItem className="col-span-2"><FormLabel className="text-xs">What Makes You Different</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-2 text-primary">
                        <Plus className="h-4 w-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Knowledge Lists</h3>
                      </div>
                      
                      <Tabs defaultValue="products">
                        <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                          <TabsTrigger value="products">Products</TabsTrigger>
                          <TabsTrigger value="faqs">FAQs</TabsTrigger>
                          <TabsTrigger value="objections">Objections</TabsTrigger>
                          <TabsTrigger value="qualification">Qualification</TabsTrigger>
                        </TabsList>

                        <TabsContent value="products" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendProduct({ id: `p-${Date.now()}`, name: '', description: '', recommendationTriggers: '' })}>Add Product</Button></div>
                          {productFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <div className="grid grid-cols-2 gap-4">
                                <Input placeholder="Product Name" {...form.register(`products.${i}.name`)} className="bg-background font-bold" />
                                <Input placeholder="Price Range" {...form.register(`products.${i}.priceRange`)} className="bg-background" />
                              </div>
                              <Textarea placeholder="Description" {...form.register(`products.${i}.description`)} rows={2} className="bg-background" />
                              <Input placeholder="When to recommend..." {...form.register(`products.${i}.recommendationTriggers`)} className="bg-background text-xs" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="faqs" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendFaq({ id: `f-${Date.now()}`, question: '', answer: '' })}>Add FAQ</Button></div>
                          {faqFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeFaq(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Question" {...form.register(`faqs.${i}.question`)} className="bg-background font-bold" />
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
                              <Textarea placeholder="AI Response" {...form.register(`objections.${i}.response`)} rows={2} className="bg-background" />
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="qualification" className="space-y-4">
                          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => appendQualification({ id: `q-${Date.now()}`, question: '', note: '' })}>Add Question</Button></div>
                          {qualificationFields.map((f, i) => (
                            <div key={f.id} className="p-4 border rounded-xl bg-white/[0.02] space-y-3 relative group">
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeQualification(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></Button>
                              <Input placeholder="Qualification Question" {...form.register(`qualificationFlow.${i}.question`)} className="bg-background font-bold" />
                              <Input placeholder="Internal Note (Why we ask this)" {...form.register(`qualificationFlow.${i}.note`)} className="bg-background text-xs" />
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
                        <TabsTrigger value="web" className="text-xs font-bold gap-2"><MessageSquare className="h-3.5 w-3.5" /> Web</TabsTrigger>
                        <TabsTrigger value="sms" className="text-xs font-bold gap-2"><Smartphone className="h-3.5 w-3.5" /> SMS</TabsTrigger>
                        <TabsTrigger value="phone" className="text-xs font-bold gap-2"><Phone className="h-3.5 w-3.5" /> Voice</TabsTrigger>
                        <TabsTrigger value="email" className="text-xs font-bold gap-2"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="web" className="space-y-8">
                        <FormField control={form.control} name="channelConfig.web.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Web Channel</Label><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        {watchedValues.channelConfig?.web?.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-primary/20">
                            <FormField control={form.control} name="channelConfig.web.greeting" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Greeting Script</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                            )} />
                            <div className="space-y-4">
                              <Label className="text-xs uppercase font-bold text-muted-foreground">Lead Capture</Label>
                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={form.control} name="channelConfig.web.leadCapture.name" render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="text-xs">Name</Label></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.leadCapture.email" render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="text-xs">Email</Label></FormItem>
                                )} />
                                <FormField control={form.control} name="channelConfig.web.leadCapture.phone" render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="text-xs">Phone</Label></FormItem>
                                )} />
                              </div>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="sms" className="space-y-8">
                        <FormField control={form.control} name="channelConfig.sms.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable SMS Channel</Label><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        {watchedValues.channelConfig?.sms?.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-primary/20">
                            <FormField control={form.control} name="channelConfig.sms.openingText" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Opening SMS Text</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-6">
                              <FormField control={form.control} name="channelConfig.sms.maxLength" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Max Response Length</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                              )} />
                              <FormField control={form.control} name="channelConfig.sms.sentimentEscalation" render={({ field }) => (
                                <FormItem className="flex items-center justify-between p-3 border rounded-lg"><FormLabel className="text-xs">Sentiment Escalation</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                              )} />
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="phone" className="space-y-8">
                        <FormField control={form.control} name="channelConfig.phone.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Voice Channel</Label><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        {watchedValues.channelConfig?.phone?.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-primary/20">
                            <FormField control={form.control} name="channelConfig.phone.mode" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Operation Mode</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="full_ai">Full AI Assistant</SelectItem>
                                    <SelectItem value="handoff">AI Triage & Transfer</SelectItem>
                                    <SelectItem value="receptionist">AI Receptionist (Messages Only)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="channelConfig.phone.greetingScript" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">Greeting Script (TTS)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                            )} />
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="email" className="space-y-8">
                        <FormField control={form.control} name="channelConfig.email.enabled" render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]"><Label className="text-sm font-bold">Enable Email Channel</Label><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        {watchedValues.channelConfig?.email?.enabled && (
                          <div className="space-y-8 pl-6 border-l-2 border-primary/20">
                            <div className="grid grid-cols-2 gap-6">
                              <FormField control={form.control} name="channelConfig.email.approvalMode" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Draft Approval</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="auto">Auto-Reply (Risky)</SelectItem>
                                      <SelectItem value="auto_exceptions">Auto-Reply with Hold List</SelectItem>
                                      <SelectItem value="manual">Always Draft for Review</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="channelConfig.email.signoff" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Standard Sign-off</FormLabel><FormControl><Input {...field} placeholder="Best regards, {{agent_name}}" /></FormControl></FormItem>
                              )} />
                            </div>
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
