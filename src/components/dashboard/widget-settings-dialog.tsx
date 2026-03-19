
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
import { Input } from '@/components/ui/input';
import { Bot as BotData, User } from '@/lib/data';
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
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import ChatbotSimulator from './chatbot-simulator';
import { uploadBotLogo } from '@/lib/db';
import { Separator } from '../ui/separator';

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
    enabled: z.boolean().default(false),
    required: z.boolean().default(false),
    timing: z.enum(['before', 'after']).default('after'),
    captureMessage: z.string().optional(),
    fields: z.object({
      name: z.boolean().default(true),
      email: z.boolean().default(true),
      phone: z.boolean().default(false),
    }),
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
}

export default function WidgetSettingsDialog({
  isOpen,
  onOpenChange,
  bot,
  onSave,
  allUsers,
  hubAgents,
}: WidgetSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('style');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const defaultValues: WidgetSettingsFormValues = {
    name: 'New Web Chat',
    welcomeMessage: 'Hi! How can we help you today?',
    agentIds: [],
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
      enabled: false,
      required: false,
      timing: 'after',
      fields: { name: true, email: true, phone: false },
    },
  };

  const form = useForm<WidgetSettingsFormValues>({
    resolver: zodResolver(widgetSettingsSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isOpen) {
      if (bot) {
        // Deep merge with defaults to prevent undefined nested properties
        const mergedValues = {
          ...defaultValues,
          ...bot,
          styleSettings: {
            ...defaultValues.styleSettings,
            ...(bot.styleSettings || {})
          },
          identityCapture: {
            ...defaultValues.identityCapture,
            ...(bot.identityCapture || {}),
            fields: {
              ...defaultValues.identityCapture.fields,
              ...(bot.identityCapture?.fields || {})
            }
          }
        };
        form.reset(mergedValues as any);
      } else {
        form.reset(defaultValues);
      }
    }
  }, [bot, form, isOpen]);

  const watchedValues = form.watch();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bot?.id) return;
    setIsUploading(true);
    try {
      const url = await uploadBotLogo(file, bot.id);
      form.setValue('styleSettings.logoUrl', url);
      toast({ title: 'Logo uploaded' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (values: WidgetSettingsFormValues) => {
    onSave(values as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 flex flex-col overflow-hidden bg-[#0d1117] border-white/10">
        <DialogTitle className="sr-only">Web Chat Widget Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure visual branding and behavior fallbacks for the web stage.</DialogDescription>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden text-left">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c10] shrink-0 z-[100]">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 shrink-0 text-left">
                  <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">{watchedValues.name}</h2>
                    <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground opacity-50 mt-1">Web Stage</p>
                  </div>
                </div>

                <nav className="flex items-center bg-white/[0.03] rounded-full p-1 border border-white/5">
                  {[
                    { id: 'style', label: 'Style & Branding', icon: Palette },
                    { id: 'behavior', label: 'Chat Behavior', icon: BrainCircuit },
                    { id: 'team', label: 'Human Team', icon: Users }
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

            <div className="flex-1 flex overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-10 max-w-2xl mx-auto pb-32 space-y-12">
                  
                  {activeTab === 'style' && (
                    <div className="space-y-12 animate-in fade-in duration-300">
                      <section className="space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Branding & Visuals</h3>
                        <div className="flex items-center gap-6">
                          <Avatar className="h-20 w-20 ring-4 ring-primary/10">
                            <AvatarImage src={watchedValues.styleSettings?.logoUrl} />
                            <AvatarFallback className="text-xl">LG</AvatarFallback>
                          </Avatar>
                          <div className="space-y-2">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || !bot?.id}>
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                              Upload Widget Logo
                            </Button>
                            {!bot?.id && <p className="text-[10px] text-amber-500 font-bold">Save widget to enable uploads.</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
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
                          <h3 className="text-sm font-bold uppercase tracking-widest">Primary Behavior (AI Agent)</h3>
                        </div>
                        <FormField control={form.control} name="assignedAgentId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Assign an AI Agent Brain</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                              <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="No Agent Brain (Human Only)" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">None (Use Fallback Behavior)</SelectItem>
                                {hubAgents.map(agent => (
                                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>When an agent is selected, its personality and knowledge will override the stage fallbacks.</FormDescription>
                          </FormItem>
                        )} />
                      </section>

                      {watchedValues.assignedAgentId && watchedValues.assignedAgentId !== 'none' ? (
                        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 animate-in zoom-in-95 duration-300">
                          <div className="flex items-center gap-2 text-primary font-bold text-sm">
                            <Sparkles className="h-4 w-4" /> 
                            AI Behavior Active
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            This widget is currently using the instructions, personality, and logic from <span className="font-bold text-foreground">
                              {hubAgents.find(a => a.id === watchedValues.assignedAgentId)?.name || 'the selected agent'}
                            </span>. 
                          </p>
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5 opacity-50 cursor-not-allowed">
                              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">Greeting</p>
                              <p className="text-[11px] truncate">Inherited from Agent</p>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5 opacity-50 cursor-not-allowed">
                              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">Lead Capture</p>
                              <p className="text-[11px] truncate">Inherited from Agent</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-12 animate-in slide-in-from-top-2 duration-300">
                          <section className="space-y-6">
                            <div className="flex items-center gap-2 text-amber-500">
                              <Settings2 className="h-4 w-4" />
                              <h3 className="text-sm font-bold uppercase tracking-widest">Fallback Behavior (No Agent)</h3>
                            </div>
                            <FormField control={form.control} name="welcomeMessage" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Fallback Greeting</FormLabel>
                                <FormControl><Textarea rows={4} placeholder="Hi! How can we help you?" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          </section>

                          <section className="space-y-6">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fallback Lead Capture</h3>
                            <div className="flex items-center justify-between p-4 border rounded-xl bg-white/[0.02]">
                              <Label className="text-sm font-bold">Enable Lead Capture</Label>
                              <Switch checked={watchedValues.identityCapture?.enabled} onCheckedChange={(val) => form.setValue('identityCapture.enabled', val)} />
                            </div>

                            {watchedValues.identityCapture?.enabled && (
                              <div className="space-y-6 pl-4 border-l-2 border-primary/20 animate-in slide-in-from-left-2 duration-300">
                                <div className="space-y-3">
                                  <Label className="text-xs uppercase font-bold text-muted-foreground">Capture Timing</Label>
                                  <RadioGroup onValueChange={(v) => form.setValue('identityCapture.timing', v as 'before' | 'after')} value={watchedValues.identityCapture?.timing} className="flex gap-4">
                                    <div className="flex items-center gap-2"><RadioGroupItem value="before" id="t-before" /><Label htmlFor="t-before">Before chat</Label></div>
                                    <div className="flex items-center gap-2"><RadioGroupItem value="after" id="t-after" /><Label htmlFor="t-after">On request</Label></div>
                                  </RadioGroup>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="flex items-center gap-2">
                                    <Checkbox 
                                      checked={watchedValues.identityCapture?.fields?.name} 
                                      onCheckedChange={(v) => form.setValue('identityCapture.fields.name', !!v)} 
                                      id="f-name" 
                                    />
                                    <Label htmlFor="f-name">Name</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox 
                                      checked={watchedValues.identityCapture?.fields?.email} 
                                      onCheckedChange={(v) => form.setValue('identityCapture.fields.email', !!v)} 
                                      id="f-email" 
                                    />
                                    <Label htmlFor="f-email">Email</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox 
                                      checked={watchedValues.identityCapture?.fields?.phone} 
                                      onCheckedChange={(v) => form.setValue('identityCapture.fields.phone', !!v)} 
                                      id="f-phone" 
                                    />
                                    <Label htmlFor="f-phone">Phone</Label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'team' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Human Team (Hub Scoped)</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">Select which members of this Hub are responsible for responding to chats on this widget.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {allUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{user.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
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

                </div>
              </ScrollArea>

              {/* Preview Panel */}
              <aside className="hidden lg:flex w-[400px] border-l border-white/10 bg-[#090c10] flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Live Preview</span>
                </div>
                <div className="flex-1 relative">
                  <ChatbotSimulator 
                    isOpen={true} 
                    onClose={() => {}} 
                    botData={watchedValues as any} 
                    flow={{ nodes: [], edges: [] }} 
                    agents={allUsers.filter(u => watchedValues.agentIds?.includes(u.id))}
                  />
                </div>
              </aside>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ColorInput({ form, name, label }: { form: any, name: string, label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <div className="relative flex-1">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded shadow-inner border border-white/10" style={{ backgroundColor: field.value }} />
                <Input {...field} className="pl-9 font-mono text-xs h-9 uppercase" />
              </div>
            </FormControl>
            <input 
              type="color" 
              value={field.value} 
              onChange={(e) => field.onChange(e.target.value)} 
              className="w-9 h-9 rounded-md border border-white/10 bg-transparent p-1 cursor-pointer shrink-0" 
            />
          </div>
        </FormItem>
      )}
    />
  );
}
