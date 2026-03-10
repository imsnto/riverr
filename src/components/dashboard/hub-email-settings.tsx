
'use client';

import React, { useState, useEffect } from 'react';
import { Hub, EmailConfig } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Loader2, ArrowRight, BrainCircuit, CheckCircle2, Edit } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import ConnectEmailDialog from './connect-email-dialog';
import EmailConfigDrawer from './email-config-drawer';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';

interface HubEmailSettingsProps {
  activeHub: Hub;
  spaceId: string;
}

export default function HubEmailSettings({ activeHub, spaceId }: HubEmailSettingsProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);

  useEffect(() => {
    if (activeHub) {
      setIsLoading(true);
      const unsub = db.subscribeToEmailConfigs(spaceId, activeHub.id, (fetchedConfigs) => {
        setConfigs(fetchedConfigs);
        setIsLoading(false);
      });
      return () => unsub();
    }
  }, [activeHub, spaceId]);

  const handleUpdateConfig = async (id: string, data: Partial<EmailConfig>) => {
    try {
      await db.updateEmailConfig(spaceId, activeHub.id, id, data);
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
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
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Support Email</h1>
          <p className="text-muted-foreground text-sm">Receive and reply to customer emails directly from the Hub inbox.</p>
        </div>
        <Button onClick={() => setIsConnectDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Email Address
        </Button>
      </header>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {configs.map(config => (
            <Card key={config.id} className="overflow-hidden border hover:border-primary/20 transition-all">
              <CardContent className="p-0">
                <div className="p-6 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{config.label}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">
                          {config.provider === 'google' ? 'Gmail' : config.provider}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{config.emailAddress}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(editingId === config.id ? null : config.id)}>
                    {editingId === config.id ? 'Close Settings' : 'Configure'}
                  </Button>
                </div>

                {editingId === config.id && (
                  <div className="p-6 space-y-8 bg-muted/20 animate-in slide-in-from-top-2 duration-300">
                    {/* Auto-Ack Email */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" /> Auto-Acknowledgment Email
                        </Label>
                        <Switch 
                          checked={config.autoAckEnabled} 
                          onCheckedChange={(val) => handleUpdateConfig(config.id, { autoAckEnabled: val })}
                        />
                      </div>
                      
                      {config.autoAckEnabled && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="space-y-2">
                            <Label className="text-xs">Email Subject</Label>
                            <Input 
                              value={config.autoAckSubject || "We've received your message"}
                              onChange={(e) => handleUpdateConfig(config.id, { autoAckSubject: e.target.value })}
                              placeholder="We received your message"
                              className="bg-background text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Email Body</Label>
                            <Textarea 
                              value={config.autoAckBody}
                              onChange={(e) => handleUpdateConfig(config.id, { autoAckBody: e.target.value })}
                              placeholder="Thanks for reaching out! Our team will get back to you shortly."
                              className="bg-background text-sm min-h-[120px]"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">Fires once per new email thread. Static confirmation only.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {configs.length === 0 && (
            <Card className="border-dashed p-12 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="font-bold text-lg">No support emails connected</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Connect your work email to handle support tickets and inquiries in real-time.
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => setIsConnectDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Connect your first address
              </Button>
            </Card>
          )}
        </div>
      </section>

      <ConnectEmailDialog 
        isOpen={isConnectDialogOpen}
        onOpenChange={setIsConnectDialogOpen}
        hubId={activeHub.id}
        spaceId={spaceId}
      />
    </div>
  );
}
