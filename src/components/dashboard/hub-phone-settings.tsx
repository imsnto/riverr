
'use client';

import React, { useState, useEffect } from 'react';
import { Hub, PhoneChannelLookup } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Phone, Smartphone, BrainCircuit, Loader2, MessageSquare, CheckCircle2, AlertCircle, Mic, UserCheck } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface HubPhoneSettingsProps {
  activeHub: Hub;
}

export default function HubPhoneSettings({ activeHub }: HubPhoneSettingsProps) {
  const { toast } = useToast();
  const [assignedNumbers, setAssignedNumbers] = useState<PhoneChannelLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeHub) {
      setIsLoading(true);
      db.getPhoneLookupsForHub(activeHub.id).then(lookups => {
        setAssignedNumbers(lookups);
        setIsLoading(false);
      });
    }
  }, [activeHub]);

  const handleUpdateLookup = async (id: string, data: Partial<PhoneChannelLookup>) => {
    try {
      await db.savePhoneChannelLookup(id, data);
      setAssignedNumbers(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
      toast({ title: "Settings updated" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to update settings" });
    }
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
        <p className="text-muted-foreground">Manage your Hub's assigned numbers and default behaviors.</p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Assigned Numbers
            <Badge variant="secondary" className="h-5">{assignedNumbers.length}</Badge>
          </h2>
        </div>

        <div className="space-y-4">
          {assignedNumbers.map(num => (
            <Card key={num.id} className="overflow-hidden border hover:border-primary/20 transition-all">
              <CardContent className="p-0">
                <div className="p-6 flex justify-between items-start border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{num.channelAddress}</p>
                      <p className="text-xs text-muted-foreground">{num.label || 'Support Line'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(editingId === num.id ? null : num.id)}>
                    {editingId === num.id ? 'Close Settings' : 'Configure'}
                  </Button>
                </div>

                {editingId === num.id && (
                  <div className="p-6 space-y-8 bg-muted/20 animate-in slide-in-from-top-2 duration-300">
                    {/* SMS Auto-Ack */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2">
                          <MessageSquare className="h-3 w-3" /> SMS Auto-Acknowledgment
                        </Label>
                        <Switch 
                          checked={num.autoAckEnabled} 
                          onCheckedChange={(val) => handleUpdateLookup(num.id, { autoAckEnabled: val })}
                        />
                      </div>
                      {num.autoAckEnabled && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                          <Textarea 
                            value={num.autoAckText}
                            onChange={(e) => handleUpdateLookup(num.id, { autoAckText: e.target.value })}
                            placeholder="Thanks for reaching out. Our team will get back to you shortly."
                            className="bg-background text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground italic">Fires once per new SMS conversation. Not AI-based.</p>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-white/5" />

                    {/* Basic Call Handling */}
                    <div className="space-y-6">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2">
                        <UserCheck className="h-3 w-3" /> Basic Call Handling
                      </Label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs">Behavior</Label>
                          <Select 
                            value={num.basicCallBehavior || 'ring'} 
                            onValueChange={(val) => handleUpdateLookup(num.id, { basicCallBehavior: val as any })}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ring">Ring to available agent</SelectItem>
                              <SelectItem value="voicemail">Voicemail only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5">
                          <div className="space-y-0.5">
                            <Label className="text-xs">Transcription</Label>
                            <p className="text-[10px] text-muted-foreground">Transcribe voicemails</p>
                          </div>
                          <Switch 
                            checked={num.voicemailTranscriptionEnabled ?? true} 
                            onCheckedChange={(val) => handleUpdateLookup(num.id, { voicemailTranscriptionEnabled: val })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Hold Message (TTS)</Label>
                        <Textarea 
                          value={num.basicCallHoldMessage}
                          onChange={(e) => handleUpdateLookup(num.id, { basicCallHoldMessage: e.target.value })}
                          placeholder="Please wait while we connect you to an agent..."
                          className="bg-background text-sm min-h-[80px]"
                        />
                        <p className="text-[10px] text-muted-foreground italic">Read aloud via text-to-speech when a caller connects.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {assignedNumbers.length === 0 && (
            <Card className="col-span-full border-dashed p-12 flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-muted-foreground opacity-20" />
              </div>
              <h3 className="font-bold">No numbers assigned</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Route a number to this Hub from the Space Inventory page to start managing it.
              </p>
            </Card>
          )}
        </div>
      </section>

      <div className="pt-8 border-t">
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <Smartphone className="h-8 w-8 text-muted-foreground opacity-40" />
            <div>
              <h4 className="font-bold">Need more numbers?</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                You can purchase and assign new phone numbers in your global Space Inventory.
              </p>
            </div>
            <Link href="/settings?view=phone" className={cn(buttonVariants({ variant: 'outline' }), "h-9")}>
              Go to Inventory
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
