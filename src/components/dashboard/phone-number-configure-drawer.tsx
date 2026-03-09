'use client';

import React, { useState, useEffect } from 'react';
import { PhoneChannelLookup } from '@/lib/data';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Bot, UserCheck, Phone, Zap, Clock, Mic, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

interface PhoneNumberConfigureDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lookup: PhoneChannelLookup;
  onSave: (lookup: PhoneChannelLookup) => void;
}

export default function PhoneNumberConfigureDrawer({ isOpen, onOpenChange, lookup, onSave }: PhoneNumberConfigureDrawerProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<PhoneChannelLookup>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        aiCallMode: lookup.aiCallMode || 'agent_only',
        handoffTarget: lookup.handoffTarget || 'any',
        handoffTimeout: lookup.handoffTimeout || 30,
        handoffFallback: lookup.handoffFallback || 'voicemail',
        aiGreetingEnabled: lookup.aiGreetingEnabled ?? true,
        transcriptionEnabled: lookup.transcriptionEnabled ?? true,
        afterHoursAiOnly: lookup.afterHoursAiOnly ?? false,
        voicemailFallback: lookup.voicemailFallback ?? true,
        greetingScript: lookup.greetingScript || 'Hi! Thank you for calling. How can I help you today?',
        label: lookup.label || '',
      });
    }
  }, [isOpen, lookup]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.savePhoneChannelLookup(lookup.id, formData);
      onSave({ ...lookup, ...formData } as PhoneChannelLookup);
      toast({ title: "Configuration saved" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to save configuration" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Configure Number</SheetTitle>
              <SheetDescription>{lookup.channelAddress}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8 pb-20">
            {/* General Info */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Line Label</Label>
              <Input 
                value={formData.label} 
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Main Support Line"
                className="bg-muted/20 border-white/10"
              />
            </div>

            <Separator />

            {/* AI Call Handling Mode */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Call Handling Mode</Label>
              <RadioGroup 
                value={formData.aiCallMode} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, aiCallMode: val as any }))}
                className="grid grid-cols-1 gap-3"
              >
                <ModeCard 
                  id="mode-full"
                  value="full_ai"
                  icon={Bot}
                  title="Full AI Resolution"
                  desc="AI owns the call start to finish, only escalates if stuck."
                  active={formData.aiCallMode === 'full_ai'}
                />
                <ModeCard 
                  id="mode-triage"
                  value="triage"
                  icon={Zap}
                  title="AI Triage + Warm Handoff"
                  desc="AI greets and collects context, then transfers to an agent with a summary."
                  active={formData.aiCallMode === 'triage'}
                />
                <ModeCard 
                  id="mode-agent"
                  value="agent_only"
                  icon={UserCheck}
                  title="Agent Only"
                  desc="Calls ring straight through, AI is not involved."
                  active={formData.aiCallMode === 'agent_only'}
                />
              </RadioGroup>
            </div>

            {/* Warm Handoff Settings (Conditional) */}
            {formData.aiCallMode === 'triage' && (
              <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Zap className="h-4 w-4" />
                  <h4 className="text-sm font-bold uppercase tracking-tight">Warm Handoff Settings</h4>
                </div>

                <div className="space-y-4">
                  <Label className="text-xs">Route incoming calls to...</Label>
                  <Select 
                    value={formData.handoffTarget} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, handoffTarget: val as any }))}
                  >
                    <SelectTrigger className="bg-background border-indigo-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any available agent</SelectItem>
                      <SelectItem value="assigned">The assigned account owner</SelectItem>
                      <SelectItem value="team">A specific team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Agent answer timeout</Label>
                    <Badge variant="secondary" className="font-mono">{formData.handoffTimeout}s</Badge>
                  </div>
                  <Slider 
                    value={[formData.handoffTimeout || 30]} 
                    min={10} 
                    max={120} 
                    step={5} 
                    onValueChange={(vals) => setFormData(prev => ({ ...prev, handoffTimeout: vals[0] }))}
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-xs">If no agent answers...</Label>
                  <Select 
                    value={formData.handoffFallback} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, handoffFallback: val as any }))}
                  >
                    <SelectTrigger className="bg-background border-indigo-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voicemail">Take a voicemail</SelectItem>
                      <SelectItem value="ai_attempt">Have AI attempt resolution</SelectItem>
                      <SelectItem value="callback">Offer a scheduled callback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Separator />

            {/* AI Behaviour Toggles */}
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Behavior & Transcriptions</Label>
              <div className="grid grid-cols-1 gap-2">
                <ToggleRow 
                  icon={MessageSquare} 
                  label="AI Greeting" 
                  desc="AI will speak an initial greeting script when connected."
                  checked={formData.aiGreetingEnabled}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, aiGreetingEnabled: val }))}
                />
                <ToggleRow 
                  icon={Mic} 
                  label="Transcribe All Calls" 
                  desc="Save a searchable text transcript of every conversation."
                  checked={formData.transcriptionEnabled}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, transcriptionEnabled: val }))}
                />
                <ToggleRow 
                  icon={Clock} 
                  label="After-Hours AI Mode" 
                  desc="AI handles everything outside business hours automatically."
                  checked={formData.afterHoursAiOnly}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, afterHoursAiOnly: val }))}
                />
                <ToggleRow 
                  icon={ShieldAlert} 
                  label="Voicemail Fallback" 
                  desc="Create an inbox conversation automatically for voicemails."
                  checked={formData.voicemailFallback}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, voicemailFallback: val }))}
                />
              </div>
            </div>

            {/* AI Greeting Script */}
            {(formData.aiCallMode !== 'agent_only' || formData.aiGreetingEnabled) && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">AI Greeting Script</Label>
                <Textarea 
                  value={formData.greetingScript}
                  onChange={(e) => setFormData(prev => ({ ...prev, greetingScript: e.target.value }))}
                  placeholder="Type the exact words the AI should say..."
                  className="min-h-[100px] bg-muted/20 border-white/10 text-sm leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground italic">Avoid using complex formatting. The AI will read this text exactly as written.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 border-t bg-background shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="px-8 font-bold">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save Configuration
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ModeCard({ id, value, icon: Icon, title, desc, active }: { id: string, value: string, icon: any, title: string, desc: string, active: boolean }) {
  return (
    <label htmlFor={id} className={cn(
      "flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
      active ? "bg-primary/10 border-primary ring-4 ring-primary/5 shadow-md" : "bg-muted/20 border-white/5 hover:border-white/10"
    )}>
      <RadioGroupItem value={value} id={id} className="sr-only" />
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-sm", active ? "text-primary" : "text-foreground")}>{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </label>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onCheckedChange }: { icon: any, label: string, desc: string, checked?: boolean, onCheckedChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-bold leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
