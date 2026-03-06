'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AutomationFlow, AutomationNode, AutomationNodeType, ChatMessage, User } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  MessageSquare, 
  MousePointerClick, 
  Database, 
  Split, 
  Bot, 
  UserCheck, 
  CircleStop, 
  ChevronRight, 
  PlayCircle,
  Settings2,
  AlertCircle,
  X,
  Send,
  Eye,
  ArrowRight,
  Terminal,
  HelpCircle,
  CheckCircle2,
  Navigation,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface AutomationFlowBuilderProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  flow: AutomationFlow;
  onSave: (flow: AutomationFlow) => void;
  allUsers?: User[];
}

const NODE_TYPES: { type: AutomationNodeType; label: string; icon: any; description: string; color: string; category: 'core' | 'advanced' }[] = [
  { type: 'message', label: 'Send Message', icon: MessageSquare, description: 'Send a static message to the visitor.', color: 'border-blue-500 bg-blue-500/5', category: 'core' },
  { type: 'quick_reply', label: 'Quick Replies', icon: MousePointerClick, description: 'Offer buttons for the visitor to click.', color: 'border-purple-500 bg-purple-500/5', category: 'core' },
  { type: 'intent_router', label: 'Intent Router', icon: Navigation, description: 'AI classifies user request and routes to specific path.', color: 'border-indigo-600 bg-indigo-600/5', category: 'core' },
  { type: 'capture_input', label: 'Capture Input', icon: Database, description: 'Ask a question and save the response.', color: 'border-teal-500 bg-teal-500/5', category: 'core' },
  { type: 'ai_step', label: 'AI Reasoning Node', icon: Bot, description: 'Conversational logic using Knowledge Base.', color: 'border-violet-500 bg-violet-500/5', category: 'core' },
  { type: 'condition', label: 'Condition', icon: Split, description: 'Branch based on user data or input.', color: 'border-amber-500 bg-amber-500/5', category: 'advanced' },
  { type: 'handoff', label: 'Human Handoff', icon: UserCheck, description: 'Escalate to a human support agent.', color: 'border-orange-500 bg-orange-500/5', category: 'core' },
  { type: 'end', label: 'Wait for Visitor', icon: CircleStop, description: 'Resolve the case or wait for reply.', color: 'border-gray-500 bg-gray-500/5', category: 'core' },
];

export default function AutomationFlowBuilder({ isOpen, onOpenChange, flow: initialFlow, onSave, allUsers = [] }: AutomationFlowBuilderProps) {
  const [nodes, setNodes] = useState<AutomationNode[]>(initialFlow.nodes || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');

  useEffect(() => {
    if (isOpen && (nodes.length === 0 || !nodes.find(n => n.type === 'start'))) {
      // Create Default Starter Flow
      const startId = 'start';
      const greetingId = 'greeting_msg';
      const routerId = 'main_router';
      const aiId = 'ai_logic';
      const pricingId = 'pricing_msg';
      const handoffId = 'human_handoff';

      setNodes([
        { id: startId, type: 'start', data: {}, nextStepId: greetingId },
        { id: greetingId, type: 'message', data: { text: 'Hi there! How can I help you today?' }, nextStepId: routerId },
        { id: routerId, type: 'intent_router', data: { 
            text: 'How can we help today?', 
            intents: [
                { id: 'i1', label: 'Order Help', nextStepId: aiId },
                { id: 'i2', label: 'Pricing', nextStepId: pricingId },
                { id: 'i3', label: 'Features', nextStepId: aiId },
                { id: 'i4', label: 'Talk to Human', nextStepId: handoffId },
            ]
        }},
        { id: aiId, type: 'ai_step', data: { fallbackNextStepId: handoffId } },
        { id: pricingId, type: 'message', data: { text: "We'd be happy to help with pricing and plans.\n\nLet us know what you're looking for, or ask to speak with sales." } },
        { id: handoffId, type: 'handoff', data: { text: 'Connecting you to our team. Someone will be with you shortly.' } }
      ]);
    }
  }, [isOpen, nodes]);

  const handleAddNode = (type: AutomationNodeType) => {
    const newNode: AutomationNode = {
      id: `node_${Date.now()}`,
      type,
      data: type === 'quick_reply' ? { text: 'Choose an option:', buttons: [{ id: `btn_${Date.now()}`, label: 'Option 1' }] } : 
            type === 'message' ? { text: 'New message' } :
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email' } : 
            type === 'intent_router' ? { text: 'How can we help today?', intents: [{ id: `intent_${Date.now()}`, label: 'Support Request' }] } :
            type === 'condition' ? { conditionField: 'email', matchNextStepId: '', fallbackNextStepId: '' } : {},
    };
    
    setNodes([...nodes, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleDeleteNode = (id: string) => {
    if (id === 'start') return;
    setNodes(nodes.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNodeData = (id: string, data: any) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
  };

  const updateNodeLink = (id: string, nextStepId: string | undefined) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, nextStepId } : n));
  };

  const handleSave = () => {
    onSave({ nodes });
    onOpenChange(false);
  };

  const getNodeTitle = (nodeId: string | undefined) => {
    if (!nodeId) return 'End Path';
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 'End Path';
    if (node.type === 'start') return 'Start';
    
    if (node.type === 'message') return `Msg: ${node.data.text?.slice(0, 15)}...`;
    if (node.type === 'capture_input') return `Cap: ${node.data.variableName}`;
    
    const typeInfo = NODE_TYPES.find(t => t.type === node.type);
    return typeInfo?.label || node.type;
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] p-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Split className="h-5 w-5 text-primary" />
            </div>
            <div>
                <DialogTitle>Automation Flow Builder</DialogTitle>
                <DialogDescription className="text-xs">Visual conversation graph • Connections determine routing.</DialogDescription>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="builder" className="gap-2">
                <Settings2 className="h-4 w-4" /> Builder
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" /> Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'builder' ? (
            <>
              {/* Canvas Area */}
              <div className="flex-1 bg-muted/20 overflow-y-auto p-12 scroll-smooth">
                <div className="max-w-2xl mx-auto space-y-0">
                    <div className="mb-12 p-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 text-center">
                        <p className="text-sm font-semibold text-primary">Build your chatbot by connecting steps together.</p>
                        <p className="text-xs text-primary/70 mt-1">Connections determine where the conversation goes next. Step settings control what each step says or does.</p>
                    </div>

                    {nodes.map((node, index) => {
                        const isSelected = selectedNodeId === node.id;
                        const typeInfo = NODE_TYPES.find(t => t.type === node.type);
                        const isBranching = ['intent_router', 'quick_reply', 'condition', 'ai_step'].includes(node.type);
                        const hasNoOutgoing = !isBranching && !node.nextStepId && !['end', 'handoff'].includes(node.type);

                        return (
                            <div key={node.id} className="w-full flex flex-col items-center group/node">
                                <Card 
                                    className={cn(
                                        "w-full border-2 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden",
                                        isSelected ? "border-primary ring-4 ring-primary/10 shadow-xl" : "border-border shadow-sm",
                                        typeInfo?.color
                                    )}
                                    onClick={() => setSelectedNodeId(node.id)}
                                >
                                    <div className="p-4 flex items-center gap-4">
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform",
                                            isSelected && "scale-110",
                                            node.type === 'start' ? "bg-emerald-500 text-white" : "bg-background border"
                                        )}>
                                            {node.type === 'start' ? <PlayCircle className="h-5 w-5" /> :
                                             typeInfo?.icon ? React.createElement(typeInfo.icon, { className: cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground") }) :
                                             <Settings2 className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                    {node.type === 'start' ? 'TRIGGER' : node.type.replace('_', ' ')}
                                                </p>
                                                {hasNoOutgoing && (
                                                    <Badge variant="destructive" className="h-4 px-1 text-[8px] animate-pulse">
                                                        <AlertCircle className="h-2 w-2 mr-1" /> No next step connected
                                                    </Badge>
                                                )}
                                            </div>
                                            <h4 className="font-bold truncate text-sm">
                                                {node.type === 'message' ? (node.data.text || 'Empty message...') : 
                                                 node.type === 'quick_reply' ? (node.data.text || 'Choose option...') :
                                                 node.type === 'intent_router' ? (node.data.text || 'Classifying intent...') :
                                                 node.type === 'capture_input' ? (node.data.prompt || 'Ask question...') :
                                                 node.type === 'start' ? 'Conversation Started' :
                                                 node.type === 'ai_step' ? 'AI Reasoning' :
                                                 node.type === 'condition' ? `Check: ${node.data.conditionField}` :
                                                 node.type === 'handoff' ? 'Connect to Agent' :
                                                 node.type === 'end' ? 'Wait for Visitor' : 'New Step'}
                                            </h4>
                                            
                                            {node.type === 'capture_input' && node.data.variableName && (
                                                <Badge variant="outline" className="mt-1 h-4 text-[9px] font-mono py-0 text-teal-600 bg-teal-50 border-teal-200">
                                                    SAVE AS: {node.data.variableName}
                                                </Badge>
                                            )}
                                        </div>
                                        {node.id !== 'start' && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover/node:opacity-100 transition-opacity" 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {/* VISUAL BRANCHING UI */}
                                    {node.type === 'quick_reply' && node.data.buttons && (
                                        <div className="px-4 pb-4 space-y-2 border-t pt-3 bg-white/50 dark:bg-black/5">
                                            {node.data.buttons.map((btn, bIdx) => (
                                                <div key={btn.id} className="flex items-center justify-between text-xs group/branch">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
                                                            <MousePointerClick className="h-3 w-3" />
                                                        </div>
                                                        <span className="font-semibold truncate">{btn.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                        <Select value={btn.nextStepId || 'none'} onValueChange={(val) => {
                                                            const newButtons = [...(node.data.buttons || [])];
                                                            newButtons[bIdx].nextStepId = val === 'none' ? undefined : val;
                                                            updateNodeData(node.id, { buttons: newButtons });
                                                        }}>
                                                            <SelectTrigger className="h-7 text-[10px] w-36 bg-background">
                                                                <SelectValue placeholder="End Path" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">End Path</SelectItem>
                                                                {nodes.filter(n => n.id !== node.id).map(n => (
                                                                    <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {node.type === 'intent_router' && node.data.intents && (
                                        <div className="px-4 pb-4 space-y-2 border-t pt-3 bg-indigo-600/5">
                                            {node.data.intents.map((intent, iIdx) => (
                                                <div key={intent.id} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Badge variant="outline" className="h-5 bg-indigo-600/10 text-indigo-600 border-indigo-600/20 px-1.5 text-[9px] uppercase font-bold tracking-tight shrink-0">INTENT</Badge>
                                                        <span className="font-semibold truncate">{intent.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                        <Select value={intent.nextStepId || 'none'} onValueChange={(val) => {
                                                            const newIntents = [...(node.data.intents || [])];
                                                            newIntents[iIdx].nextStepId = val === 'none' ? undefined : val;
                                                            updateNodeData(node.id, { intents: newIntents });
                                                        }}>
                                                            <SelectTrigger className="h-7 text-[10px] w-36 bg-background">
                                                                <SelectValue placeholder="End Path" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">End Path</SelectItem>
                                                                {nodes.filter(n => n.id !== node.id).map(n => (
                                                                    <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between text-xs pt-1 mt-1 border-t border-indigo-600/10 opacity-60">
                                                <div className="flex items-center gap-2">
                                                    <HelpCircle className="h-3 w-3" />
                                                    <span className="font-semibold italic">Unknown (AI Clarify)</span>
                                                </div>
                                                <span className="text-[10px]">Continues to AI Reasoning</span>
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'condition' && (
                                        <div className="px-4 pb-4 space-y-3 border-t pt-3 bg-amber-500/5 text-xs">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-emerald-500 h-5 px-1 text-[9px] font-bold">TRUE</Badge>
                                                    <span className="font-medium text-emerald-700">Matched path</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                    <Select value={node.data.matchNextStepId || 'none'} onValueChange={(val) => updateNodeData(node.id, { matchNextStepId: val === 'none' ? undefined : val })}>
                                                        <SelectTrigger className="h-7 text-[10px] w-36 bg-background border-emerald-500/20">
                                                            <SelectValue placeholder="End Path" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">End Path</SelectItem>
                                                            {nodes.filter(n => n.id !== node.id).map(n => (
                                                                <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-rose-500 h-5 px-1 text-[9px] font-bold">FALSE</Badge>
                                                    <span className="font-medium text-rose-700">Fallback path</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                    <Select value={node.data.fallbackNextStepId || 'none'} onValueChange={(val) => updateNodeData(node.id, { fallbackNextStepId: val === 'none' ? undefined : val })}>
                                                        <SelectTrigger className="h-7 text-[10px] w-36 bg-background border-rose-500/20">
                                                            <SelectValue placeholder="End Path" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">End Path</SelectItem>
                                                            {nodes.filter(n => n.id !== node.id).map(n => (
                                                                <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'ai_step' && (
                                        <div className="px-4 pb-3 pt-2 border-t bg-violet-500/5 text-xs space-y-2">
                                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-tighter">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    <span>RESOLVED / ANSWERED</span>
                                                </div>
                                                <span className="opacity-60 italic">Continues naturally</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-rose-500 font-bold text-[10px] uppercase tracking-tighter">
                                                    <HelpCircle className="h-3 w-3" />
                                                    <span>UNRESOLVED FALLBACK</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <ArrowRight className="h-3 w-3" />
                                                    <Select value={node.data.fallbackNextStepId || 'none'} onValueChange={(val) => updateNodeData(node.id, { fallbackNextStepId: val === 'none' ? undefined : val })}>
                                                        <SelectTrigger className="h-7 text-[10px] w-36 bg-background border-rose-500/20">
                                                            <SelectValue placeholder="End Path" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">End Path</SelectItem>
                                                            {nodes.filter(n => n.id !== node.id).map(n => (
                                                                <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* LINEAR CONNECTOR */}
                                    {!isBranching && !['end', 'handoff'].includes(node.type) && (
                                        <div className="px-4 py-2 border-t bg-muted/10 flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground font-medium uppercase tracking-widest text-[9px]">Connect to:</span>
                                            <div className="flex items-center gap-2">
                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                <Select value={node.nextStepId || 'none'} onValueChange={(val) => updateNodeLink(node.id, val === 'none' ? undefined : val)}>
                                                    <SelectTrigger className="h-7 text-[10px] w-36 bg-background">
                                                        <SelectValue placeholder="End Path" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">End Path</SelectItem>
                                                        {nodes.filter(n => n.id !== node.id).map(n => (
                                                            <SelectItem key={n.id} value={n.id}>{getNodeTitle(n.id)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                                
                                {/* Visual Connector Segment */}
                                <div className="h-10 w-px bg-border group-last/node:hidden relative" />
                            </div>
                        );
                    })}

                    <div className="pt-4 flex flex-col items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="rounded-full h-12 px-8 shadow-xl relative z-10 transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90">
                                    <Plus className="h-5 w-5 mr-2" /> Add Next Step
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-72 p-2">
                                <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Core Elements</p>
                                {NODE_TYPES.filter(t => t.category === 'core' && t.type !== 'start').map(t => (
                                    <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type)} className="p-3 gap-3">
                                        <t.icon className={cn("h-5 w-5 shrink-0", t.type === 'ai_step' ? 'text-violet-500' : 'text-primary')} />
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-sm">{t.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.description}</p>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Advanced Logic</p>
                                {NODE_TYPES.filter(t => t.category === 'advanced').map(t => (
                                    <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type)} className="p-3 gap-3">
                                        <t.icon className="h-5 w-5 text-amber-500 shrink-0" />
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-sm">{t.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.description}</p>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
              </div>

              {/* Properties Panel */}
              <aside className="w-[400px] border-l bg-card flex flex-col shrink-0">
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Step Settings
                    </h3>
                    {selectedNode && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedNodeId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                
                <ScrollArea className="flex-1">
                    {selectedNode ? (
                        <div className="p-6 space-y-8 pb-32">
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Behavior</Label>
                                <div className="p-4 rounded-xl border-2 bg-background shadow-sm space-y-1">
                                    <span className="font-bold text-sm capitalize">{selectedNode.type.replace('_', ' ')}</span>
                                    <p className="text-[10px] text-muted-foreground">{NODE_TYPES.find(t => t.type === selectedNode.type)?.description}</p>
                                </div>
                            </div>

                            <Separator />

                            {selectedNode.type === 'message' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Bot Message</Label>
                                        <Textarea 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="What should the bot say?"
                                            rows={6}
                                            className="resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'intent_router' && (
                                <div className="space-y-6">
                                    <div className="bg-indigo-500/10 p-4 rounded-xl border-2 border-indigo-500/20 mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Bot className="h-4 w-4 text-indigo-600" />
                                            <p className="text-xs font-bold text-indigo-900">Intelligent Routing</p>
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-indigo-800/70">
                                            AI handles synonyms and phrasing variations. You define the destination categories (intents) and connect them visually on the map.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Question or Prompt</Label>
                                        <Input 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="e.g. How can we help today?"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>Destinations (Intents)</Label>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                const newIntents = [...(selectedNode.data.intents || []), { id: `intent_${Date.now()}`, label: 'New Intent' }];
                                                updateNodeData(selectedNode.id, { intents: newIntents });
                                            }}>Add</Button>
                                        </div>
                                        {selectedNode.data.intents?.map((intent, iIndex) => (
                                            <div key={intent.id} className="flex items-center gap-2 p-2 border rounded-lg bg-background">
                                                <Input 
                                                    value={intent.label} 
                                                    onChange={(e) => {
                                                        const newIntents = [...(selectedNode.data.intents || [])];
                                                        newIntents[iIndex].label = e.target.value;
                                                        updateNodeData(selectedNode.id, { intents: newIntents });
                                                    }}
                                                    placeholder="Category Name"
                                                    className="h-8 text-xs border-none focus-visible:ring-0"
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                                    updateNodeData(selectedNode.id, { intents: selectedNode.data.intents?.filter(i => i.id !== intent.id) });
                                                }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'condition' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Check for property:</Label>
                                        <Select 
                                            value={selectedNode.data.conditionField} 
                                            onValueChange={(val) => updateNodeData(selectedNode.id, { conditionField: val })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select data point" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="email">Email exists</SelectItem>
                                                <SelectItem value="name">Name exists</SelectItem>
                                                <SelectItem value="identified">Visitor is identified</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="bg-amber-500/10 p-4 rounded-xl border-2 border-amber-500/20">
                                        <p className="text-[10px] text-amber-800 leading-relaxed italic">
                                            If this property exists, the flow follows the <strong>TRUE</strong> branch. Otherwise, it follows the <strong>FALSE</strong> branch.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'capture_input' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Bot Prompt</Label>
                                        <Input 
                                            value={selectedNode.data.prompt || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                            placeholder="e.g. What is your email address?"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Save value as variable:</Label>
                                        <Input 
                                            value={selectedNode.data.variableName || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { variableName: e.target.value })}
                                            placeholder="e.g. user_email"
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'ai_step' && (
                                <div className="space-y-6">
                                    <div className="bg-violet-500/10 border-2 border-violet-500/20 rounded-xl p-4 flex gap-3">
                                        <Bot className="h-5 w-5 text-violet-500 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Implicit AI Reasoning</p>
                                            <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70 leading-relaxed">
                                                AI automatically answers using knowledge or asks clarifying questions. FALLBACK path only triggers if it cannot help.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'handoff' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Transfer Message</Label>
                                        <Textarea 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="e.g. Transferring you to our support team..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground bg-muted/10">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6 border-2 border-dashed border-muted-foreground/20">
                                <Plus className="h-8 w-8 opacity-20" />
                            </div>
                            <h4 className="font-bold text-foreground mb-2">No Step Selected</h4>
                            <p className="text-sm">Click a step on the canvas to configure its behavior.</p>
                        </div>
                    )}
                </ScrollArea>
              </aside>
            </>
          ) : (
            <PreviewArea nodes={nodes} allUsers={allUsers} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewArea({ nodes, allUsers }: { nodes: AutomationNode[], allUsers: User[] }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [userInput, setUserInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const startNode = nodes.find(n => n.type === 'start');
        if (startNode?.nextStepId) {
            handleStep(startNode.nextStepId);
        }
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleStep = async (nodeId: string | null) => {
        if (!nodeId) return;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setCurrentNodeId(nodeId);

        if (node.type === 'message') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text, type: 'automation' }]);
            if (node.nextStepId) {
                setTimeout(() => handleStep(node.nextStepId!), 800);
            }
        } else if (node.type === 'quick_reply' || node.type === 'intent_router') {
            const buttons = node.type === 'quick_reply' ? node.data.buttons : node.data.intents;
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || node.data.prompt, type: 'automation', buttons: buttons }]);
        } else if (node.type === 'capture_input') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt, type: 'automation' }]);
        } else if (node.type === 'condition') {
            const matched = Math.random() > 0.5; // Simulate logic
            handleStep(matched ? node.data.matchNextStepId! : node.data.fallbackNextStepId!);
        } else if (node.type === 'ai_step') {
            setIsThinking(true);
            setTimeout(() => {
                setIsThinking(false);
                const resolved = Math.random() > 0.4;
                if (resolved) {
                    setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: "I found an answer using our knowledge base. Is there anything else I can help with?", type: 'ai' }]);
                } else {
                    if (node.data.fallbackNextStepId) {
                        handleStep(node.data.fallbackNextStepId!);
                    } else {
                        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: "I'm not sure about that. Let me connect you to a human.", type: 'ai' }]);
                    }
                }
            }, 1500);
        } else if (node.type === 'handoff') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || "Connecting you to an agent...", type: 'automation' }]);
            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: "Escalated to human" }]);
        } else if (node.type === 'end') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: "Waiting for visitor response" }]);
        }
    };

    const handleUserInput = (text: string, buttonId?: string) => {
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);
        
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (currentNode?.type === 'quick_reply' || currentNode?.type === 'intent_router') {
            const buttons = currentNode.type === 'quick_reply' ? currentNode.data.buttons : currentNode.data.intents;
            const btn = buttons?.find(b => b.id === buttonId);
            if (btn?.nextStepId) {
                handleStep(btn.nextStepId);
            } else if (currentNode.data.fallbackNextStepId) {
                handleStep(currentNode.data.fallbackNextStepId);
            }
        } else if (currentNode?.type === 'capture_input') {
            if (currentNode.nextStepId) {
                handleStep(currentNode.nextStepId);
            }
        }
        setUserInput('');
    };

    return (
        <div className="flex-1 bg-muted/30 flex flex-col items-center justify-center p-8">
            <div className="w-[450px] h-[750px] bg-background rounded-3xl shadow-2xl border-8 border-muted flex flex-col overflow-hidden relative">
                <div className="p-4 border-b bg-card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-bold text-sm">Flow Preview</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold" onClick={() => {
                        setMessages([]);
                        const startNode = nodes.find(n => n.type === 'start');
                        if (startNode?.nextStepId) handleStep(startNode.nextStepId);
                    }}>Reset</Button>
                </div>

                <ScrollArea className="flex-1" ref={scrollRef}>
                    <div className="p-6 space-y-6">
                        {messages.map((m) => (
                            <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                                {m.role === 'system' ? (
                                    <div className="w-full flex justify-center py-2">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight bg-muted/30 px-2 py-1 rounded">
                                            {m.text}
                                        </span>
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-br-none" : 
                                        m.type === 'ai' ? "bg-indigo-500/10 border-2 border-indigo-500/20 text-foreground rounded-bl-none" :
                                        "bg-muted text-foreground rounded-bl-none"
                                    )}>
                                        <p className="whitespace-pre-wrap">{m.text}</p>
                                    </div>
                                )}
                                {m.role === 'bot' && (
                                    <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground px-1">
                                        {m.type === 'ai' ? 'Manowar Assistant (AI)' : 'Support Assistant'}
                                    </span>
                                )}
                                {m.buttons && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {m.buttons.map((btn: any) => (
                                            <Button 
                                                key={btn.id} 
                                                variant="outline" 
                                                size="sm" 
                                                className="rounded-full h-8 text-xs font-semibold border-primary/30 hover:bg-primary/5 text-primary"
                                                onClick={() => handleUserInput(btn.label, btn.id)}
                                            >
                                                {btn.label}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex flex-col items-start gap-2">
                                <div className="bg-muted p-3 rounded-2xl rounded-bl-none flex items-center gap-2">
                                    <Bot className="h-4 w-4 animate-pulse" />
                                    <span className="text-sm italic">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-card shrink-0">
                    <div className="relative">
                        <Input 
                            placeholder="Type a message..." 
                            className="pr-12 rounded-full h-11" 
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUserInput(userInput)}
                        />
                        <Button 
                            size="icon" 
                            className="absolute right-1 top-1 h-9 w-9 rounded-full"
                            onClick={() => handleUserInput(userInput)}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
