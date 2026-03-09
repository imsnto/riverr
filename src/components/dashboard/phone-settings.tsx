'use client';

import React, { useState, useEffect } from 'react';
import { Space, Hub, PhoneChannelLookup } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Phone, MessageSquare, ShieldAlert, Check, ChevronRight, Search, Settings, Building2 } from 'lucide-react';
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
  const [lookups, setLookups] = useState<PhoneChannelLookup[]>([]);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [countryCode, setCountryCode] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<any | null>(null);
  const [targetHubId, setTargetHubId] = useState('');

  const twilioConfig = (space as any).comms?.twilio;
  const isProvisioned = twilioConfig?.status === 'active';

  useEffect(() => {
    if (isProvisioned) {
      const unsubNumbers = db.getCommsNumbersForSpace(space.id, setNumbers);
      db.getAllPhoneLookupsForSpace(space.id).then(setLookups);
      return () => unsubNumbers();
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
    const existingLookup = lookups.find(l => l.channelAddress === num.phoneNumber);
    setTargetHubId(existingLookup?.hubId || '');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async () => {
    if (!targetHubId || !selectedNumber) return;
    
    setAssigning(true);
    try {
      const functions = getFunctions(getApp());
      const assign = httpsCallable(functions, 'assignNumberToHub');
      
      await assign({
        spaceId: space.id,
        hubId: targetHubId,
        number: selectedNumber,
        type: 'both',
        channelSettings: {} // Behavior is configured at Hub level now
      });
      
      toast({ title: "Number Assigned", description: `${selectedNumber.phoneNumber} routing updated.` });
      db.getAllPhoneLookupsForSpace(space.id).then(setLookups);
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
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage Twilio subaccounts and purchased numbers for this Space.</p>
        </div>
      </div>

      {!isProvisioned ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Provision Twilio
            </CardTitle>
            <CardDescription>Get a dedicated Twilio subaccount to start buying and routing numbers.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleProvision} disabled={provisioning}>
              {provisioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enable Phone & SMS
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Subaccount SID</CardDescription>
                <CardTitle className="text-sm font-mono truncate">{twilioConfig.subaccountSid}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Twilio Status</CardDescription>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Phone Book</CardTitle>
                <CardDescription>All numbers owned by this space and their assignments.</CardDescription>
              </div>
              <Button onClick={() => setIsBuyModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Buy Number
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y border rounded-lg">
                {numbers.map(num => {
                  const lookup = lookups.find(l => l.channelAddress === num.phoneNumber);
                  const assignedHub = allHubs.find(h => h.id === lookup?.hubId);
                  
                  return (
                    <div key={num.sid} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold">{num.phoneNumber}</p>
                          <div className="flex gap-1 mt-0.5">
                            {num.capabilities?.sms && <Badge variant="secondary" className="h-4 px-1 text-[8px]">SMS</Badge>}
                            {num.capabilities?.voice && <Badge variant="secondary" className="h-4 px-1 text-[8px]">VOICE</Badge>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Assigned To</p>
                          {assignedHub ? (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              <Building2 className="h-3.5 w-3.5 text-primary" />
                              {assignedHub.name}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">Unassigned</span>
                          )}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleOpenAssign(num)}>
                          {assignedHub ? 'Re-assign' : 'Assign'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
            <DialogTitle>Assign Number to Hub</DialogTitle>
            <DialogDescription>Route traffic from {selectedNumber?.phoneNumber} to a specific workspace.</DialogDescription>
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
              <p className="text-xs text-muted-foreground mt-2 italic">A number can only be assigned to one Hub at a time to avoid conflicts.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} disabled={assigning}>Cancel</Button>
            <Button onClick={handleConfirmAssign} disabled={!targetHubId || assigning}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
