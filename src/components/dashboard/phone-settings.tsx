
'use client';

import React, { useState, useEffect } from 'react';
import { Space, Hub } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Phone, MessageSquare, ShieldAlert, Check, ChevronRight, Search, Settings } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import * as db from '@/lib/db';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

interface PhoneSettingsProps {
  space: Space;
  allHubs: Hub[];
}

export default function PhoneSettings({ space, allHubs }: PhoneSettingsProps) {
  const { toast } = useToast();
  const [provisioning, setProvisioning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  
  const [numbers, setNumbers] = useState<any[]>([]);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [countryCode, setCountryCode] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  const [targetHubId, setTargetHubId] = useState('');
  const [enableSms, setEnableSms] = useState(true);
  const [enableVoice, setEnableVoice] = useState(true);
  const [forwardTo, setForwardTo] = useState('');
  const [enableVoicemail, setEnableVoicemail] = useState(true);

  const twilioConfig = (space as any).comms?.twilio;
  const isProvisioned = twilioConfig?.status === 'active';

  useEffect(() => {
    if (isProvisioned) {
      return db.getCommsNumbersForSpace(space.id, setNumbers);
    }
  }, [isProvisioned, space.id]);

  const handleProvision = async () => {
    setProvisioning(true);
    try {
      const functions = getFunctions(getApp());
      const provision = httpsCallable(functions, 'provisionTwilioSubaccount');
      await provision({ spaceId: space.id });
      toast({ title: "Twilio Provisioned", description: "A secure subaccount has been created for your space." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Provisioning Failed", description: e.message });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      const functions = getFunctions(getApp());
      const search = httpsCallable(functions, 'searchNumbers');
      const result = await search({ 
        spaceId: space.id,
        countryCode,
        areaCode: areaCode || undefined,
        type: 'local'
      });
      setAvailableNumbers((result.data as any).numbers);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Search Failed", description: e.message });
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async (phoneNumber: string) => {
    setBuyingNumber(phoneNumber);
    try {
      const functions = getFunctions(getApp());
      const buy = httpsCallable(functions, 'buyPhoneNumber');
      await buy({ spaceId: space.id, phoneNumber });
      toast({ title: "Number Purchased!", description: `${phoneNumber} is now owned by your space.` });
      setIsBuyModalOpen(false);
      setAvailableNumbers([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Purchase Failed", description: e.message });
    } finally {
      setBuyingNumber(null);
    }
  };

  const handleOpenAssign = (num: any) => {
    setSelectedNumber(num);
    setTargetHubId('');
    setForwardTo('');
    setEnableSms(true);
    setEnableVoice(true);
    setEnableVoicemail(true);
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!targetHubId || !selectedNumber) return;
    if (enableVoice && !forwardTo) {
      toast({ variant: 'destructive', title: "Forwarding required", description: "Please enter a destination phone number for calls." });
      return;
    }
    
    setAssigning(true);
    try {
      const functions = getFunctions(getApp());
      const assign = httpsCallable(functions, 'assignNumberToHub');
      
      const channelSettings: any = {};
      if (enableVoice) {
        channelSettings.defaultForwardToE164 = forwardTo;
        channelSettings.voicemailEnabled = enableVoicemail;
      }

      await assign({
        spaceId: space.id,
        hubId: targetHubId,
        number: selectedNumber,
        type: enableSms && enableVoice ? 'both' : (enableSms ? 'sms' : 'voice'),
        channelSettings
      });
      
      toast({ title: "Number Assigned", description: `${selectedNumber.phoneNumber} routing updated.` });
      setIsAssignModalOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Assignment Failed", description: e.message });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Phone & SMS</h1>
          <p className="text-muted-foreground">Manage your Twilio subaccount and phone numbers.</p>
        </div>
      </div>

      {!isProvisioned ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Get Started with Phone & SMS
            </CardTitle>
            <CardDescription>Provision a dedicated Twilio subaccount to start buying numbers and communicating with customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <Badge variant="secondary">1</Badge>
                <p className="text-sm">Provision a unique subaccount for this space.</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="secondary">2</Badge>
                <p className="text-sm">Search and buy local or toll-free numbers.</p>
              </div>
              <div className="flex gap-3">
                <Badge variant="secondary">3</Badge>
                <p className="text-sm">Route calls and SMS to any Hub in your workspace.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleProvision} disabled={provisioning}>
              {provisioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enable Phone & SMS
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Subaccount SID</CardDescription>
                <CardTitle className="text-sm font-mono truncate">{twilioConfig.subaccountSid}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Compliance</CardDescription>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Unregistered (A2P)</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>A2P 10DLC Registration Required</AlertTitle>
            <AlertDescription>
              To send SMS to US numbers, you must register this Space for A2P 10DLC. Unregistered traffic may be blocked by carriers.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Phone Numbers</CardTitle>
                <CardDescription>Numbers owned by this space.</CardDescription>
              </div>
              <Button onClick={() => setIsBuyModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Buy Number
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y border rounded-lg">
                {numbers.map(num => (
                  <div key={num.sid} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">{num.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground">{num.friendlyName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 mr-4">
                        {num.capabilities?.sms && <Badge variant="secondary" className="h-5 px-1 text-[10px]"><MessageSquare className="h-2 w-2 mr-1"/> SMS</Badge>}
                        {num.capabilities?.voice && <Badge variant="secondary" className="h-5 px-1 text-[10px]"><Phone className="h-2 w-2 mr-1"/> Voice</Badge>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleOpenAssign(num)}>
                        <Settings className="mr-2 h-3 w-3" /> Configure
                      </Button>
                    </div>
                  </div>
                ))}
                {numbers.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground italic">
                    No numbers purchased yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Buy Number Modal */}
      <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buy Phone Number</DialogTitle>
            <DialogDescription>Search for and purchase a new number for this space.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Area Code (Optional)</Label>
                <Input placeholder="e.g. 415" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSearch} disabled={searching} className="w-full">
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search Numbers
            </Button>

            <ScrollArea className="h-64 border rounded-md">
              <div className="divide-y">
                {availableNumbers.map(n => (
                  <div key={n.phoneNumber} className="p-3 flex items-center justify-between hover:bg-muted/50">
                    <div>
                      <p className="font-semibold">{n.phoneNumber}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{n.locality}, {n.region}</p>
                    </div>
                    <Button size="sm" onClick={() => handleBuy(n.phoneNumber)} disabled={buyingNumber === n.phoneNumber}>
                      {buyingNumber === n.phoneNumber ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Buy'}
                    </Button>
                  </div>
                ))}
                {availableNumbers.length === 0 && !searching && (
                  <p className="text-sm text-center text-muted-foreground py-12 italic">Search for numbers above.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Routing</DialogTitle>
            <DialogDescription>Route traffic from {selectedNumber?.phoneNumber} to a Hub.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Target Hub</Label>
              <Select value={targetHubId} onValueChange={setTargetHubId}>
                <SelectTrigger><SelectValue placeholder="Select Hub..." /></SelectTrigger>
                <SelectContent>
                  {allHubs.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable SMS</Label>
                  <p className="text-xs text-muted-foreground">Inbound texts will appear in this Hub's Inbox.</p>
                </div>
                <Switch checked={enableSms} onCheckedChange={setEnableSms} />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Voice</Label>
                    <p className="text-xs text-muted-foreground">Inbound calls will be forwarded to an agent.</p>
                  </div>
                  <Switch checked={enableVoice} onCheckedChange={setEnableVoice} />
                </div>

                {enableVoice && (
                  <div className="pl-6 space-y-4 border-l-2">
                    <div className="space-y-2">
                      <Label>Forward Calls To (E.164)</Label>
                      <Input placeholder="+14155551234" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground italic">The real phone number that will ring when this Twilio number is called.</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Voicemail Fallback</Label>
                      <Switch checked={enableVoicemail} onCheckedChange={setEnableVoicemail} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} disabled={assigning}>Cancel</Button>
            <Button onClick={handleConfirmAssign} disabled={!targetHubId || assigning || (enableVoice && !forwardTo)}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Routing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
