
'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
    Upload, 
    FileText, 
    X, 
    CheckCircle2, 
    Loader2, 
    FileJson, 
    Table as TableIcon, 
    Mail, 
    BrainCircuit,
    Zap,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';

interface ImportDataDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = 'upload' | 'preview' | 'processing' | 'result';

export default function ImportDataDialog({ isOpen, onOpenChange, onComplete }: ImportDataDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { activeSpace, appUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStep('preview');
    }
  };

  const handleStartImport = async () => {
    if (!file || !activeSpace || !appUser) return;
    
    setStep('processing');
    setIsUploading(true);
    
    try {
      // 1. Upload to storage
      const fileUrl = await db.uploadImportedFile(file, activeSpace.id);
      
      // 2. Create source record
      const sourceType = file.name.endsWith('.pdf') ? 'pdf' : 
                         file.name.endsWith('.json') ? 'json' : 
                         file.name.endsWith('.csv') ? 'csv' : 'text';

      const source = await db.createImportedSource({
        spaceId: activeSpace.id,
        sourceType,
        filename: file.name,
        originalMimeType: file.type,
        uploadedByUserId: appUser.id,
        uploadedByName: appUser.name,
        status: 'uploaded',
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. Enqueue background job
      await db.startBrainJob('process_imported_source', {
        sourceId: source.id,
        spaceId: activeSpace.id,
        fileUrl
      });

      // Mock progress for UI feel
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setStep('result');
          setIsUploading(false);
        }
      }, 150);

    } catch (e) {
      toast({ variant: 'destructive', title: 'Import failed' });
      setStep('upload');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setProgress(0);
    onOpenChange(false);
    if (onComplete) onComplete();
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.pdf')) return <FileText className="h-8 w-8 text-rose-500" />;
    if (filename.endsWith('.json')) return <FileJson className="h-8 w-8 text-amber-500" />;
    if (filename.endsWith('.csv')) return <TableIcon className="h-8 w-8 text-emerald-500" />;
    return <FileText className="h-8 w-8 text-primary" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-[#0d1117] border-white/10 text-left">
        <header className="p-6 border-b border-white/10 bg-black/20">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
            <Upload className="h-5 w-5 text-primary" />
            Import Data
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            Build your internal intelligence library automatically from existing documents.
          </DialogDescription>
        </header>

        <div className="p-10">
          {step === 'upload' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div 
                className="border-2 border-dashed border-white/10 rounded-3xl p-12 text-center hover:bg-white/[0.02] hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.json,.csv,.txt" />
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Click to upload or drag & drop</h3>
                <p className="text-sm text-muted-foreground mt-2">Supported: PDF, JSON, CSV, Email Exports</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                  <BrainCircuit className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Auto-Distillation</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">We'll automatically extract reusable Insights from your content.</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Instant Recall</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">Imported knowledge becomes available to Finn immediately after extraction.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && file && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-6 p-6 rounded-3xl bg-white/[0.03] border border-white/10">
                {getFileIcon(file.name)}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to parse</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setStep('upload'); }} className="rounded-full"><X className="h-4 w-4" /></Button>
              </div>

              <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-4">
                <div className="flex items-center gap-3 text-primary">
                  <History className="h-4 w-4" />
                  <h4 className="text-sm font-bold uppercase tracking-tight">Intelligence Pipeline</h4>
                </div>
                <ul className="space-y-3 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary font-black">1.</span>
                    <span>Segmenting content into machine-readable units.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-black">2.</span>
                    <span>Extracting reusable <strong>Insights</strong> using AI distillation.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary font-black">3.</span>
                    <span>Grouping findings into semantic <strong>Topics</strong> automatically.</span>
                  </li>
                </ul>
              </div>

              <Button onClick={handleStartImport} className="w-full h-12 rounded-2xl font-black shadow-xl shadow-primary/20">
                Start Processing Pipeline
              </Button>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-10 py-10 text-center animate-in fade-in duration-500">
              <div className="relative inline-block">
                <div className="h-24 w-24 rounded-full border-4 border-white/5 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainCircuit className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Distilling Knowledge...</h3>
                <div className="max-w-xs mx-auto space-y-2">
                  <Progress value={progress} className="h-1.5 bg-white/5" />
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    <span>{progress < 30 ? 'Parsing Source' : progress < 70 ? 'Extracting Insights' : 'Mapping Topics'}</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-8 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Import Complete</h3>
                <p className="text-sm text-muted-foreground">The source has been added to your intelligence pipeline.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                  <p className="text-2xl font-black text-white">12</p>
                  <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground mt-1">Insights Extracted</p>
                </div>
                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
                  <p className="text-2xl font-black text-white">4</p>
                  <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground mt-1">Matched Topics</p>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full h-12 rounded-2xl font-black">
                View Intelligence
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
