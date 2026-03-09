
'use client';

import React, { useState, useEffect } from 'react';
import { Hub, EmailConfig } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Loader2, ArrowRight, BrainCircuit } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import ConnectEmailDialog from './connect-email-dialog';
import EmailConfigDrawer from './email-config-drawer';
import { Alert, AlertDescription } from '../ui/alert';

interface HubEmailSettingsProps {
  activeHub: Hub;
  spaceId: string;
}

export default function HubEmailSettings({ activeHub, spaceId }: HubEmailSettingsProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<EmailConfig | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  const handleConfigure = (config: EmailConfig) => {
    setSelectedConfig(config);
    setIsDrawerOpen(true);
  };

  const handleConfigSave = (updated: EmailConfig) => {
    setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
    setIsDrawerOpen(false);
  };

  const handleDisconnect = async (configId: string) => {
    try {
      const res = await fetch(`/api/email/disconnect?spaceId=${spaceId}&hubId=${activeHub.id}&emailConfigId=${configId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Disconnect failed");
      toast({ title: "Email address disconnected" });
      setIsDrawerOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Failed to disconnect" });
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

      <Alert className="bg-primary/5 border-primary/10 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <AlertDescription className="text-xs font-medium">
            AI behavior and greeting scripts for these email addresses are now managed in your Agent settings.
          </AlertDescription>
        </div>
      </Alert>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {configs.map(config => (
            <Card key={config.id} className="relative group overflow-hidden border hover:border-primary/50 transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
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

                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => handleConfigure(config)}>
                      Configure
                    </Button>
                  </div>
                </div>
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

      {selectedConfig && (
        <EmailConfigDrawer 
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          config={selectedConfig}
          spaceId={spaceId}
          hubId={activeHub.id}
          onSave={handleConfigSave}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
