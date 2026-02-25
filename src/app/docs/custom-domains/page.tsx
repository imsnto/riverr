
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, Terminal, ShieldCheck, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';

export default function CustomDomainDocs() {
  const router = useRouter();

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
          className="group -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Settings
        </Button>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Custom Domain Setup</h1>
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Follow these instructions to host your Manowar Help Center on your own subdomain.
        </p>
      </header>

      <div className="grid gap-8">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">1</div>
            <h2 className="text-2xl font-bold">Configure your DNS</h2>
          </div>
          <p className="text-muted-foreground">
            Log in to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap) and add a new <strong>CNAME</strong> record for the subdomain you want to use.
          </p>
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Type</span>
                  <p className="font-mono bg-background p-2 rounded border">CNAME</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Name (Host)</span>
                  <p className="font-mono bg-background p-2 rounded border">help <span className="text-muted-foreground text-xs">(or your chosen subdomain)</span></p>
                </div>
                <div className="col-span-full space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Value (Points to)</span>
                  <p className="font-mono bg-background p-2 rounded border">proxy.manowar.cloud</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">2</div>
            <h2 className="text-2xl font-bold">Add domain in Manowar</h2>
          </div>
          <p className="text-muted-foreground">
            Go back to your Library Settings page and enter your subdomain (e.g., <code>help.yourcompany.com</code>) in the Custom Domain field.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">3</div>
            <h2 className="text-2xl font-bold">Verify & SSL</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 rounded-lg border bg-card space-y-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <h4 className="font-bold text-sm">Propagation</h4>
              <p className="text-xs text-muted-foreground">DNS changes can take up to 24 hours to propagate globally, though often much faster.</p>
            </div>
            <div className="p-4 rounded-lg border bg-card space-y-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              <h4 className="font-bold text-sm">Auto SSL</h4>
              <p className="text-xs text-muted-foreground">Once we detect your record, we automatically issue and renew a free Let's Encrypt SSL certificate.</p>
            </div>
            <div className="p-4 rounded-lg border bg-card space-y-2">
              <Globe className="h-5 w-5 text-blue-400" />
              <h4 className="font-bold text-sm">Redirection</h4>
              <p className="text-xs text-muted-foreground">Requests to your old Manowar subpath will be permanently redirected to your new custom domain.</p>
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-12 border-t text-sm text-muted-foreground">
        <p>Still having trouble? Reach out to our support team through the widget in your dashboard.</p>
      </footer>
    </div>
  );
}
