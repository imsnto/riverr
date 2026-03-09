
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Mail, Loader2, AlertCircle } from 'lucide-react';

interface ConnectEmailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hubId: string;
  spaceId: string;
}

export default function ConnectEmailDialog({ isOpen, onOpenChange, hubId, spaceId }: ConnectEmailDialogProps) {
  const [label, setLabel] = useState('Support Inbox');
  const [provider, setProvider] = useState<'google' | 'microsoft' | 'imap'>('google');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Redirect to the connect API route which handles OAuth initiation
    const url = `/api/email/connect?spaceId=${spaceId}&hubId=${hubId}&provider=${provider}&label=${encodeURIComponent(label)}`;
    window.location.href = url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Support Email</DialogTitle>
          <DialogDescription>
            All inbound emails to this address will become conversations in this Hub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-label">Human-friendly label</Label>
            <Input 
              id="email-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Returns & Support"
            />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Visible only to your team</p>
          </div>

          <div className="space-y-3">
            <Label>Email Provider</Label>
            <RadioGroup value={provider} onValueChange={(val) => setProvider(val as any)} className="grid grid-cols-1 gap-2">
              <ProviderCard 
                id="prov-google"
                value="google"
                title="Google Workspace"
                desc="Gmail, G-Suite, and Google Business mailboxes."
                enabled={true}
                active={provider === 'google'}
              />
              <ProviderCard 
                id="prov-microsoft"
                value="microsoft"
                title="Microsoft 365"
                desc="Outlook and Exchange mailboxes."
                enabled={false}
                active={provider === 'microsoft'}
              />
              <ProviderCard 
                id="prov-imap"
                value="imap"
                title="Custom IMAP/SMTP"
                desc="Self-hosted or other private mail servers."
                enabled={false}
                active={provider === 'imap'}
              />
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConnect} disabled={isConnecting} className="font-bold px-8 shadow-lg shadow-primary/20">
            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Connect with {provider === 'google' ? 'Google' : 'Provider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderCard({ id, value, title, desc, enabled, active }: { id: string, value: string, title: string, desc: string, enabled: boolean, active: boolean }) {
  return (
    <label 
      htmlFor={id} 
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 transition-all relative",
        !enabled ? "opacity-50 grayscale cursor-not-allowed border-transparent" : "cursor-pointer",
        active && enabled ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-muted/50 border-transparent bg-muted/20"
      )}
    >
      <RadioGroupItem value={value} id={id} className="sr-only" disabled={!enabled} />
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", active && enabled ? "bg-primary text-primary-foreground" : "bg-card border")}>
        <Mail className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("font-bold text-sm", active && enabled ? "text-primary" : "text-foreground")}>{title}</p>
          {!enabled && <Badge variant="outline" className="text-[8px] h-4 uppercase font-black px-1">Coming Soon</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </label>
  );
}
