
'use client';

import React, { useState, useEffect } from 'react';
import { Hub, PhoneChannelLookup } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Smartphone, BrainCircuit, Loader2 } from 'lucide-react';
import * as db from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

interface HubPhoneSettingsProps {
  activeHub: Hub;
}

export default function HubPhoneSettings({ activeHub }: HubPhoneSettingsProps) {
  const { toast } = useToast();
  const [assignedNumbers, setAssignedNumbers] = useState<PhoneChannelLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeHub) {
      setIsLoading(true);
      db.getPhoneLookupsForHub(activeHub.id).then(lookups => {
        setAssignedNumbers(lookups);
        setIsLoading(false);
      });
    }
  }, [activeHub]);

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
        <p className="text-muted-foreground">Manage your Hub's assigned numbers and their capabilities.</p>
      </header>

      <Alert className="bg-primary/5 border-primary/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <AlertDescription className="text-xs font-medium">
            AI call handling and SMS response behaviors for these numbers are now configured globally in your Agent settings.
          </AlertDescription>
        </div>
      </Alert>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Assigned Numbers
            <Badge variant="secondary" className="h-5">{assignedNumbers.length}</Badge>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedNumbers.map(num => (
            <Card key={num.id} className="relative group overflow-hidden border hover:border-primary/20 transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{num.channelAddress}</p>
                      <p className="text-xs text-muted-foreground">{num.label || 'Support Line'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      {/* Capabilities display */}
                      <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">Voice</Badge>
                      <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">SMS</Badge>
                    </div>
                  </div>
                </div>
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
