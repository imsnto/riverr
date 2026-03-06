
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AutomationFlow, AutomationNode, AutomationNodeType, User } from '@/lib/data';
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
  Navigation,
  Check,
  ChevronDown,
  Link as LinkIcon,
  Unlink,
  ZoomIn,
  ZoomOut,
  Maximize,
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
  const [zoom, setZoom] = useState(1);

  // Initialize with a default flow if empty
  useEffect(() => {
    if (isOpen && (nodes.length === 0 || !nodes.find(n => n.type === 'start'))) {
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

  const handleAddNode = (type: AutomationNodeType, parentNodeId: string, pathKey?: string, subIndex?: number) => {
    const newNodeId = `node_${Date.now()}`;
    const newNode: AutomationNode = {
      id: newNodeId,
      type,
      data: type === 'quick_reply' ? { text: 'Choose an option:', buttons: [{ id: `btn_${Date.now()}`, label: 'Option 1' }] } : 
            type === 'message' ? { text: 'New message' } :
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email' } : 
            type === 'intent_router' ? { text: 'How can we help today?', intents: [{ id: `intent_${Date.now()}`, label: 'Support Request' }] } :
            type === 'condition' ? { conditionField: 'email' } : {},
    };
    
    const updatedNodes = [...nodes, newNode];
    
    const newNodes = updatedNodes.map(n => {
        if (n.id !== parentNodeId) return n;
        
        if (pathKey === 'nextStepId') return { ...n, nextStepId: newNodeId };
        if (pathKey === 'matchNextStepId') return { ...n, data: { ...n.data, matchNextStepId: newNodeId } };
        if (pathKey === 'fallbackNextStepId') return { ...n, data: { ...n.data, fallbackNextStepId: newNodeId } };
        if (pathKey === 'intents' && typeof subIndex === 'number') {
            const intents = [...(n.data.intents || [])];
            intents[subIndex] = { ...intents[subIndex], nextStepId: newNodeId };
            return { ...n, data: { ...n.data, intents } };
        }
        if (pathKey === 'buttons' && typeof subIndex === 'number') {
            const buttons = [...(n.data.buttons || [])];
            buttons[subIndex] = { ...buttons[subIndex], nextStepId: newNodeId };
            return { ...n, data: { ...n.data, buttons } };
        }
        return n;
    });

    setNodes(newNodes);
    setSelectedNodeId(newNodeId);
  };

  const handleDeleteNode = (id: string) => {
    if (id === 'start') return;
    setNodes(nodes.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNodeData = (id: string, data: any) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
  };

  const disconnectPath = (parentNodeId: string, pathKey: string, subIndex?: number) => {
    setNodes(nodes.map(n => {
        if (n.id !== parentNodeId) return n;
        if (pathKey === 'nextStepId') return { ...n, nextStepId: undefined };
        if (pathKey === 'matchNextStepId') return { ...n, data: { ...n.data, matchNextStepId: undefined } };
        if (pathKey === 'fallbackNextStepId') return { ...n, data: { ...n.data, fallbackNextStepId: undefined } };
        if (pathKey === 'intents' && typeof subIndex === 'number') {
            const intents = [...(n.data.intents || [])];
            intents[subIndex] = { ...intents[subIndex], nextStepId: undefined };
            return { ...n, data: { ...n.data, intents } };
        }
        if (pathKey === 'buttons' && typeof subIndex === 'number') {
            const buttons = [...(n.data.buttons || [])];
            buttons[subIndex] = { ...buttons[subIndex], nextStepId: undefined };
            return { ...n, data: { ...n.data, buttons } };
        }
        return n;
    }));
  };

  const handleSave = () => {
    onSave({ nodes });
    onOpenChange(false);
  };

  // --- RECURSIVE RENDERER ---
  const renderedIds = new Set<string>();

  const renderNode = (nodeId: string | undefined): React.ReactNode => {
    if (!nodeId) return null;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    if (renderedIds.has(nodeId)) {
        return (
            <div className="flex flex-col items-center">
                <div className="h-12 w-0.5 bg-border shrink-0" />
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-2 py-1.5 px-3">
                    <ArrowRight className="h-3 w-3" /> Circular path to {node.id.substring(0, 5)}
                </Badge>
            </div>
        );
    }
    renderedIds.add(nodeId);

    const isSelected = selectedNodeId === node.id;
    const typeInfo = NODE_TYPES.find(t => t.type === node.type);
    
    // Nodes that can branch out
    const isIntentRouter = node.type === 'intent_router';
    const isQuickReply = node.type === 'quick_reply';
    const isCondition = node.type === 'condition';
    const isAIStep = node.type === 'ai_step';
    const isBranching = isIntentRouter || isQuickReply || isCondition || isAIStep;

    return (
      <div className="flex flex-col items-center w-full min-w-max">
        {/* Inbound Line */}
        {node.type !== 'start' && <div className="h-12 w-0.5 bg-border shrink-0" />}
        
        {/* Node Card */}
        <Card 
            className={cn(
                "w-80 border-2 transition-all cursor-pointer hover:shadow-xl relative overflow-hidden shrink-0 z-10",
                isSelected ? "border-primary ring-4 ring-primary/10 shadow-2xl scale-[1.02]" : "border-border shadow-md",
                typeInfo?.color
            )}
            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
        >
            <div className="p-4 flex items-center gap-4">
                <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    node.type === 'start' ? "bg-emerald-500 text-white" : "bg-background border"
                )}>
                    {node.type === 'start' ? <PlayCircle className="h-5 w-5" /> :
                     typeInfo?.icon ? React.createElement(typeInfo.icon, { className: cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground") }) :
                     <Settings2 className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                            {node.type === 'start' ? 'TRIGGER' : node.type.replace('_', ' ')}
                        </p>
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
                        <p className="text-[10px] text-teal-600 font-mono mt-1 px-1.5 py-0.5 bg-teal-50 rounded-sm w-fit">SAVE AS: {node.data.variableName}</p>
                    )}
                </div>
                {node.id !== 'start' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </Card>

        {/* Branching Logic */}
        {isBranching ? (
            <div className="flex flex-col items-center w-full mt-0">
                {/* Trunk */}
                <div className="h-12 w-0.5 bg-border shrink-0" />
                
                {/* Branches Container */}
                <div className="relative flex justify-center w-full min-w-max px-12">
                    {(() => {
                        const branches = isIntentRouter ? (node.data.intents || []) :
                                         isQuickReply ? (node.data.buttons || []) :
                                         isCondition ? ['true', 'false'] :
                                         isAIStep ? ['resolved', 'unresolved'] : [];
                        const totalBranches = branches.length;
                        
                        return (
                            <>
                                {/* Robust Horizontal Bridge Line */}
                                {totalBranches > 1 && (
                                    <div 
                                        className="absolute top-0 h-0.5 bg-border" 
                                        style={{ 
                                            left: `${100 / (totalBranches * 2)}%`, 
                                            right: `${100 / (totalBranches * 2)}%` 
                                        }} 
                                    />
                                )}
                                
                                <div className="flex gap-16">
                                    {isIntentRouter && (node.data.intents || []).map((intent, iIdx) => (
                                        <div key={intent.id} className="flex flex-col items-center">
                                            <div className="h-12 w-0.5 bg-border shrink-0" />
                                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 px-3 py-1 text-[10px] uppercase font-bold tracking-tight shrink-0 mb-4 shadow-sm">
                                                {intent.label}
                                            </Badge>
                                            {renderPath(node.id, 'intents', intent.nextStepId, iIdx)}
                                        </div>
                                    ))}

                                    {isQuickReply && (node.data.buttons || []).map((btn, bIdx) => (
                                        <div key={btn.id} className="flex flex-col items-center">
                                            <div className="h-12 w-0.5 bg-border shrink-0" />
                                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 px-3 py-1 text-[10px] uppercase font-bold tracking-tight shrink-0 mb-4 shadow-sm">
                                                BTN: {btn.label}
                                            </Badge>
                                            {renderPath(node.id, 'buttons', btn.nextStepId, bIdx)}
                                        </div>
                                    ))}

                                    {isCondition && (
                                        <>
                                            <div className="flex flex-col items-center">
                                                <div className="h-12 w-0.5 bg-border shrink-0" />
                                                <Badge className="bg-emerald-500 h-6 px-3 text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm">TRUE</Badge>
                                                {renderPath(node.id, 'matchNextStepId', node.data.matchNextStepId)}
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-12 w-0.5 bg-border shrink-0" />
                                                <Badge className="bg-rose-500 h-6 px-3 text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm">FALSE</Badge>
                                                {renderPath(node.id, 'fallbackNextStepId', node.data.fallbackNextStepId)}
                                            </div>
                                        </>
                                    )}

                                    {isAIStep && (
                                        <>
                                            <div className="flex flex-col items-center">
                                                <div className="h-12 w-0.5 bg-border shrink-0" />
                                                <Badge className="bg-teal-500 h-6 px-3 text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm">RESOLVED</Badge>
                                                <div className="h-12 w-0.5 bg-border/50 border-dashed border-l-2" />
                                                <p className="text-[10px] text-muted-foreground italic font-medium mt-2">Continues naturally</p>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-12 w-0.5 bg-border shrink-0" />
                                                <Badge className="bg-orange-500 h-6 px-3 text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm">UNRESOLVED</Badge>
                                                {renderPath(node.id, 'fallbackNextStepId', node.data.fallbackNextStepId)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        ) : (
            // Linear Path
            !['end', 'handoff'].includes(node.type) && renderPath(node.id, 'nextStepId', node.nextStepId)
        )}
      </div>
    );
  };

  const renderPath = (parentId: string, pathKey: string, nextStepId: string | undefined, subIndex?: number) => {
    if (nextStepId) {
        return (
            <div className="relative flex flex-col items-center w-full group">
                {/* Disconnect Button floating above the line */}
                <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-4 left-1/2 -translate-x-1/2 h-7 w-7 z-[100] shadow-lg border opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white" 
                    onClick={(e) => { e.stopPropagation(); disconnectPath(parentId, pathKey, subIndex); }}
                    title="Disconnect path"
                >
                    <Unlink className="h-3.5 w-3.5" />
                </Button>
                <div className="w-full flex flex-col items-center">
                    {renderNode(nextStepId)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <div className="h-12 w-0.5 bg-border shrink-0" />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-full border-dashed px-6 text-xs bg-background hover:border-primary hover:text-primary transition-all shadow-sm">
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add Next Step
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2 shadow-2xl border-2">
                    <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conversation</p>
                    {NODE_TYPES.filter(t => ['message', 'quick_reply', 'handoff'].includes(t.type)).map(t => (
                        <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type, parentId, pathKey, subIndex)} className="p-2 gap-3 cursor-pointer">
                            <t.icon className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-semibold text-xs">{t.label}</span>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Logic & Intelligence</p>
                    {NODE_TYPES.filter(t => ['intent_router', 'ai_step', 'condition'].includes(t.type)).map(t => (
                        <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type, parentId, pathKey, subIndex)} className="p-2 gap-3 cursor-pointer">
                            <t.icon className={cn("h-4 w-4 shrink-0", t.type === 'ai_step' ? 'text-violet-500' : 'text-primary')} />
                            <span className="font-semibold text-xs">{t.label}</span>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connect Existing</p>
                    <ScrollArea className="h-48">
                        {nodes.filter(n => n.id !== parentId && n.type !== 'start').map(n => (
                            <DropdownMenuItem key={n.id} onClick={() => {
                                setNodes(nodes.map(node => {
                                    if (node.id !== parentId) return node;
                                    if (pathKey === 'nextStepId') return { ...node, nextStepId: n.id };
                                    if (pathKey === 'matchNextStepId') return { ...node, data: { ...node.data, matchNextStepId: n.id } };
                                    if (pathKey === 'fallbackNextStepId') return { ...node, data: { ...node.data, fallbackNextStepId: n.id } };
                                    if (pathKey === 'intents' && typeof subIndex === 'number') {
                                        const intents = [...(node.data.intents || [])];
                                        intents[subIndex] = { ...intents[subIndex], nextStepId: n.id };
                                        return { ...node, data: { ...node.data, intents } };
                                    }
                                    if (pathKey === 'buttons' && typeof subIndex === 'number') {
                                        const buttons = [...(node.data.buttons || [])];
                                        buttons[subIndex] = { ...buttons[subIndex], nextStepId: n.id };
                                        return { ...node, data: { ...node.data, buttons } };
                                    }
                                    return node;
                                }));
                            }} className="p-2 gap-2 cursor-pointer">
                                <LinkIcon className="h-3 w-3 opacity-50" />
                                <span className="text-[10px] font-mono truncate">{n.type.toUpperCase()}: {n.id.substring(0, 8)}</span>
                            </DropdownMenuItem>
                        ))}
                    </ScrollArea>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
  };

  const startNode = nodes.find(n => n.type === 'start');
  const detachedNodes = nodes.filter(n => !renderedIds.has(n.id) && n.type !== 'start');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-screen p-0 flex flex-col overflow-hidden rounded-none border-none">
        <div className="flex items-center justify-between p-4 border-b bg-background shrink-0 z-[200] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
                <DialogTitle className="text-lg">Automation Flow Builder</DialogTitle>
                <DialogDescription className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Recursive Conversation Tree • Graph View
                </DialogDescription>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
            <TabsList className="bg-muted/50 p-1 rounded-full border">
              <TabsTrigger value="builder" className="rounded-full gap-2 px-6">
                <Settings2 className="h-4 w-4" /> Map View
              </TabsTrigger>
              <TabsTrigger value="preview" className="rounded-full gap-2 px-6">
                <Eye className="h-4 w-4" /> Live Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-full mr-4 bg-muted/30 p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
                <div className="px-3 text-[11px] font-bold w-14 text-center tabular-nums">{Math.round(zoom * 100)}%</div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setZoom(Math.min(2, zoom + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 border-l ml-1 rounded-full" onClick={() => setZoom(1)}><Maximize className="h-4 w-4" /></Button>
            </div>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} className="rounded-full px-8">Save & Deploy</Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {activeTab === 'builder' ? (
            <>
              {/* Canvas Area */}
              <div className="flex-1 bg-[#090909] bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:24px_24px] overflow-auto relative flex flex-col items-center">
                {/* Large viewport container to allow extensive panning */}
                <div 
                    className="p-[2000px] inline-block transition-transform duration-300 ease-out origin-top"
                    style={{ transform: `scale(${zoom})` }}
                >
                    {/* Welcome Hint */}
                    <div className="text-center mb-12 max-w-sm mx-auto">
                        <Badge variant="secondary" className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            Build your flow by connecting steps below
                        </Badge>
                    </div>

                    {startNode && renderNode(startNode.id)}

                    {/* Detached Nodes */}
                    {detachedNodes.length > 0 && (
                        <div className="mt-48 w-full max-w-5xl px-12 pb-48 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="relative py-8">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-muted-foreground/30"></div></div>
                                <div className="relative flex justify-center">
                                    <span className="bg-[#090909] px-4 text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                                        <Unlink className="h-4 w-4" /> Unconnected Workflow Steps
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                {detachedNodes.map(node => (
                                    <Card 
                                        key={node.id} 
                                        className={cn("p-4 cursor-pointer border-2 transition-all hover:border-primary/50", selectedNodeId === node.id && "border-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]")}
                                        onClick={() => setSelectedNodeId(node.id)}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">{node.type}</Badge>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteNode(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                        <p className="text-xs truncate font-medium text-muted-foreground">
                                            {node.data.text || node.data.prompt || '(Empty Content)'}
                                        </p>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
              </div>

              {/* Contextual Sidebar */}
              {selectedNodeId && (
                <aside className="absolute right-0 top-0 bottom-0 w-[420px] bg-background border-l z-[250] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Settings2 className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="font-bold text-sm tracking-tight">Step Configuration</h3>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setSelectedNodeId(null)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    <ScrollArea className="flex-1">
                        {nodes.find(n => n.id === selectedNodeId) ? (() => {
                            const selectedNode = nodes.find(n => n.id === selectedNodeId)!;
                            return (
                            <div className="p-8 space-y-10 pb-32">
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.15em] opacity-60">Logic Engine</Label>
                                    <div className="p-5 rounded-2xl border-2 bg-muted/30 space-y-2">
                                        <span className="font-bold text-base capitalize tracking-tight text-primary flex items-center gap-2">
                                            {selectedNode.type.replace('_', ' ')}
                                        </span>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                            {NODE_TYPES.find(t => t.type === selectedNode.type)?.description}
                                        </p>
                                    </div>
                                </div>

                                <Separator className="opacity-50" />

                                {selectedNode.type === 'message' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Bot Message</Label>
                                            <Textarea 
                                                value={selectedNode.data.text || ''} 
                                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                                placeholder="What should the bot say?"
                                                rows={8}
                                                className="resize-none font-medium leading-relaxed bg-muted/20 border-2 rounded-xl focus-visible:ring-primary/20"
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'intent_router' && (
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Inbound Classification Prompt</Label>
                                            <Input 
                                                value={selectedNode.data.text || ''} 
                                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                                placeholder="e.g. How can we help today?"
                                                className="h-11 border-2 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Defined Routes</Label>
                                                <Button variant="outline" size="sm" className="rounded-full h-8 px-4" onClick={() => {
                                                    const newIntents = [...(selectedNode.data.intents || []), { id: `intent_${Date.now()}`, label: 'New Intent' }];
                                                    updateNodeData(selectedNode.id, { intents: newIntents });
                                                }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Intent</Button>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedNode.data.intents?.map((intent, iIndex) => (
                                                    <div key={intent.id} className="flex items-center gap-3 p-3 border-2 rounded-xl bg-background group/item shadow-sm">
                                                        <Navigation className="h-4 w-4 text-muted-foreground opacity-40 shrink-0" />
                                                        <Input 
                                                            value={intent.label} 
                                                            onChange={(e) => {
                                                                const newIntents = [...(selectedNode.data.intents || [])];
                                                                newIntents[iIndex].label = e.target.value;
                                                                updateNodeData(selectedNode.id, { intents: newIntents });
                                                            }}
                                                            placeholder="Route Label"
                                                            className="h-8 text-sm border-none shadow-none focus-visible:ring-0 font-semibold p-0"
                                                        />
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={() => {
                                                            updateNodeData(selectedNode.id, { intents: selectedNode.data.intents?.filter(i => i.id !== intent.id) });
                                                        }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'quick_reply' && (
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Prompt Text</Label>
                                            <Input 
                                                value={selectedNode.data.text || ''} 
                                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                                placeholder="Ask something..."
                                                className="h-11 border-2 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold text-purple-500 uppercase tracking-widest">Buttons</Label>
                                                <Button variant="outline" size="sm" className="rounded-full h-8 px-4" onClick={() => {
                                                    const newButtons = [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, label: 'New Button' }];
                                                    updateNodeData(selectedNode.id, { buttons: newButtons });
                                                }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Button</Button>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedNode.data.buttons?.map((btn, bIndex) => (
                                                    <div key={btn.id} className="flex items-center gap-3 p-3 border-2 rounded-xl bg-background group/item shadow-sm">
                                                        <MousePointerClick className="h-4 w-4 text-muted-foreground opacity-40 shrink-0" />
                                                        <Input 
                                                            value={btn.label} 
                                                            onChange={(e) => {
                                                                const newButtons = [...(selectedNode.data.buttons || [])];
                                                                newButtons[bIndex].label = e.target.value;
                                                                updateNodeData(selectedNode.id, { buttons: newButtons });
                                                            }}
                                                            placeholder="Button Label"
                                                            className="h-8 text-sm border-none shadow-none focus-visible:ring-0 font-semibold p-0"
                                                        />
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={() => {
                                                            updateNodeData(selectedNode.id, { buttons: selectedNode.data.buttons?.filter(b => b.id !== btn.id) });
                                                        }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'condition' && (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold">If this property is known:</Label>
                                            <Select 
                                                value={selectedNode.data.conditionField} 
                                                onValueChange={(val) => updateNodeData(selectedNode.id, { conditionField: val })}
                                            >
                                                <SelectTrigger className="h-11 border-2 rounded-xl"><SelectValue placeholder="Select data point" /></SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="email">Visitor Email</SelectItem>
                                                    <SelectItem value="name">Visitor Name</SelectItem>
                                                    <SelectItem value="identified">Secure Identity Found</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'capture_input' && (
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Bot Question</Label>
                                            <Input 
                                                value={selectedNode.data.prompt || ''} 
                                                onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                                placeholder="e.g. What is your email address?"
                                                className="h-11 border-2 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Database Mapping</Label>
                                            <div className="flex items-center gap-3 p-4 border-2 rounded-xl bg-teal-500/5 border-teal-500/20">
                                                <Database className="h-5 w-5 text-teal-600" />
                                                <Input 
                                                    value={selectedNode.data.variableName || ''} 
                                                    onChange={(e) => updateNodeData(selectedNode.id, { variableName: e.target.value })}
                                                    placeholder="e.g. user_email"
                                                    className="h-8 text-sm border-none shadow-none focus-visible:ring-0 font-mono text-teal-700 bg-transparent p-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'handoff' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold">Transfer Message</Label>
                                            <Textarea 
                                                value={selectedNode.data.text || ''} 
                                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                                placeholder="e.g. Transferring you to our support team..."
                                                rows={6}
                                                className="resize-none font-medium bg-muted/20 border-2 rounded-xl"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        })() : <div className="p-8 text-center text-muted-foreground italic">Select a node to configure its settings.</div>}
                    </ScrollArea>
                </aside>
              )}
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
            } else if (currentNode.type === 'intent_router') {
                const fallback = currentNode.data.fallbackNextStepId || currentNode.nextStepId;
                if (fallback) handleStep(fallback);
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
