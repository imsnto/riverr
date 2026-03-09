'use client';

import React, { useState, useEffect } from 'react';
import { Hub, PhoneChannelLookup } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Bot, Settings, Loader2, Sparkles } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import PhoneNumberConfigureDrawer from './phone-number-configure-drawer';
import { cn } from '@/lib/utils';

interface HubPhoneSettingsProps {
  activeHub: Hub;
}

export default function HubPhoneSettings({ activeHub }: HubPhoneSettingsProps) {
  const { toast } = useToast();
  const [assignedNumbers, setAssignedNumbers] = useState<PhoneChannelLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLookup, setSelectedLookup] = useState<PhoneChannelLookup | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [smsAiBehavior, setSmsAiBehavior] = useState<'off' | 'draft' | 'auto'>(activeHub.settings?.smsAiBehavior || 'off');

  useEffect(() => {
    if (activeHub) {
      setIsLoading(true);
      db.getPhoneLookupsForHub(activeHub.id).then(lookups => {
        setAssignedNumbers(lookups);
        setIsLoading(false);
      });
    }
  }, [activeHub]);

  const handleConfigure = (lookup: PhoneChannelLookup) => {
    setSelectedLookup(lookup);
    setIsDrawerOpen(true);
  };

  const handleSaveSmsBehavior = async (val: string) => {
    const behavior = val as 'off' | 'draft' | 'auto';
    setSmsAiBehavior(behavior);
    try {
      await db.updateHub(activeHub.id, {
        settings: {
          ...activeHub.settings,
          smsAiBehavior: behavior
        }
      });
      toast({ title: "SMS behavior updated" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to update settings" });
    }
  };

  const handleLookupSave = (updated: PhoneChannelLookup) => {
    setAssignedNumbers(prev => prev.map(l => l.id === updated.id ? updated : l));
    setIsDrawerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header>
        <h1 className="text-2xl font-bold">Phone & SMS</h1>
        <p className="text-muted-foreground">Manage communication behavior for this Hub's assigned numbers.</p>
      </header>

      {/* Assigned Numbers Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Assigned Numbers
            <Badge variant="secondary" className="h-5">{assignedNumbers.length}</Badge>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedNumbers.map(num => (
            <Card key={num.id} className="relative group overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Phone className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">
                    {num.aiCallMode === 'agent_only' ? 'Manual' : 'AI Enhanced'}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-bold">{num.channelAddress}</CardTitle>
                <CardDescription className="text-xs truncate">{num.label || 'Support Line'}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2 mt-4">
                  {num.aiCallMode === 'full_ai' && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      <Bot className="h-3 w-3" /> FULL AI RESOLUTION
                    </div>
                  )}
                  {num.aiCallMode === 'triage' && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      <Sparkles className="h-3 w-3" /> TRIAGE + WARM HANDOFF
                    </div>
                  )}
                  {num.aiCallMode === 'agent_only' && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      DIRECT AGENT ROUTING
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t bg-muted/30">
                <Button variant="ghost" size="sm" className="w-full justify-between h-9 px-2 hover:bg-white/5" onClick={() => handleConfigure(num)}>
                  <span className="text-xs font-semibold">Configure Behavior</span>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}

          {assignedNumbers.length === 0 && (
            <Card className="col-span-full border-dashed p-12 flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-muted-foreground opacity-20" />
              </div>
              <h3 className="font-bold">No numbers assigned</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Route a number to this Hub from the Space Inventory page to start configuring behavior.
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* SMS AI Behavior Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">SMS AI Behavior</h2>
        <Card className="bg-muted/30 border-2 border-transparent">
          <CardContent className="p-6">
            <RadioGroup value={smsAiBehavior} onValueChange={handleSaveSmsBehavior} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label htmlFor="sms-off" className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer bg-card flex flex-col items-center text-center gap-3",
                smsAiBehavior === 'off' ? "border-primary ring-4 ring-primary/10 shadow-lg" : "border-border hover:border-primary/20"
              )}>
                <RadioGroupItem value="off" id="sms-off" className="sr-only" />
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", smsAiBehavior === 'off' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">AI Off</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Direct messaging only. No AI involvement.</p>
                </div>
              </label>

              <label htmlFor="sms-draft" className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer bg-card flex flex-col items-center text-center gap-3",
                smsAiBehavior === 'draft' ? "border-primary ring-4 ring-primary/10 shadow-lg" : "border-border hover:border-primary/20"
              )}>
                <RadioGroupItem value="draft" id="sms-draft" className="sr-only" />
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", smsAiBehavior === 'draft' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">AI Drafts</p>
                  <p className="text-[10px] text-muted-foreground mt-1">AI generates drafts for agents to approve before sending.</p>
                </div>
              </label>

              <label htmlFor="sms-auto" className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer bg-card flex flex-col items-center text-center gap-3",
                smsAiBehavior === 'auto' ? "border-primary ring-4 ring-primary/10 shadow-lg" : "border-border hover:border-primary/20"
              )}>
                <RadioGroupItem value="auto" id="sms-auto" className="sr-only" />
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", smsAiBehavior === 'auto' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">AI Auto-Reply</p>
                  <p className="text-[10px] text-muted-foreground mt-1">AI handles inbound texts instantly based on knowledge base.</p>
                </div>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>
      </section>

      {selectedLookup && (
        <PhoneNumberConfigureDrawer 
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          lookup={selectedLookup}
          onSave={handleLookupSave}
        />
      )}
    </div>
  );
}
