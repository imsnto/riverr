
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
    
    // Wire it up
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
            buttons[subIndex] = { ...buttons[buttons.length - 1], nextStepId: newNodeId };
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

    // Detect cycles to prevent infinite recursion
    if (renderedIds.has(nodeId)) {
        return (
            <div className="flex flex-col items-center">
                <div className="h-8 w-px bg-primary/30" />
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2">
                    <ArrowRight className="h-3 w-3" /> Recursive Link to Step {node.id.substring(0, 5)}
                </Badge>
            </div>
        );
    }
    renderedIds.add(nodeId);

    const isSelected = selectedNodeId === node.id;
    const typeInfo = NODE_TYPES.find(t => t.type === node.type);
    const isBranching = ['intent_router', 'quick_reply', 'condition', 'ai_step'].includes(node.type);

    return (
      <div className="flex flex-col items-center w-full min-w-max">
        {node.type !== 'start' && <div className="h-8 w-px bg-border shrink-0" />}
        
        <Card 
            className={cn(
                "w-80 border-2 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden shrink-0",
                isSelected ? "border-primary ring-4 ring-primary/10 shadow-xl" : "border-border shadow-sm",
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
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                        <p className="text-[10px] text-teal-600 font-mono">SAVE AS: {node.data.variableName}</p>
                    )}
                </div>
                {node.id !== 'start' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </Card>

        {/* Child Paths */}
        <div className="flex gap-12 mt-0">
            {node.type === 'intent_router' && (node.data.intents || []).map((intent, iIdx) => (
                <div key={intent.id} className="flex flex-col items-center min-w-[200px]">
                    <div className="h-8 w-px bg-border" />
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 px-2 py-1 text-[10px] uppercase font-bold tracking-tight shrink-0">
                        {intent.label}
                    </Badge>
                    {renderPath(node.id, 'intents', intent.nextStepId, iIdx)}
                </div>
            ))}

            {node.type === 'quick_reply' && (node.data.buttons || []).map((btn, bIdx) => (
                <div key={btn.id} className="flex flex-col items-center min-w-[200px]">
                    <div className="h-8 w-px bg-border" />
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 px-2 py-1 text-[10px] uppercase font-bold tracking-tight shrink-0">
                        BTN: {btn.label}
                    </Badge>
                    {renderPath(node.id, 'buttons', btn.nextStepId, bIdx)}
                </div>
            ))}

            {node.type === 'condition' && (
                <>
                    <div className="flex flex-col items-center min-w-[200px]">
                        <div className="h-8 w-px bg-border" />
                        <Badge className="bg-emerald-500 h-5 px-2 text-[9px] font-bold uppercase">TRUE</Badge>
                        {renderPath(node.id, 'matchNextStepId', node.data.matchNextStepId)}
                    </div>
                    <div className="flex flex-col items-center min-w-[200px]">
                        <div className="h-8 w-px bg-border" />
                        <Badge className="bg-rose-500 h-5 px-2 text-[9px] font-bold uppercase">FALSE</Badge>
                        {renderPath(node.id, 'fallbackNextStepId', node.data.fallbackNextStepId)}
                    </div>
                </>
            )}

            {node.type === 'ai_step' && (
                <>
                    <div className="flex flex-col items-center min-w-[200px]">
                        <div className="h-8 w-px bg-border" />
                        <Badge className="bg-teal-500 h-5 px-2 text-[9px] font-bold uppercase">RESOLVED</Badge>
                        <div className="h-8 w-px bg-border" />
                        <p className="text-[10px] text-muted-foreground italic font-medium">Continues naturally</p>
                    </div>
                    <div className="flex flex-col items-center min-w-[200px]">
                        <div className="h-8 w-px bg-border" />
                        <Badge className="bg-orange-500 h-5 px-2 text-[9px] font-bold uppercase">UNRESOLVED</Badge>
                        {renderPath(node.id, 'fallbackNextStepId', node.data.fallbackNextStepId)}
                    </div>
                </>
            )}

            {!isBranching && !['end', 'handoff'].includes(node.type) && renderPath(node.id, 'nextStepId', node.nextStepId)}
        </div>
      </div>
    );
  };

  const renderPath = (parentId: string, pathKey: string, nextStepId: string | undefined, subIndex?: number) => {
    if (nextStepId) {
        return (
            <div className="relative flex flex-col items-center w-full">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-1/2 translate-x-12 h-6 w-6 z-20 text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100 transition-opacity" 
                    onClick={(e) => { e.stopPropagation(); disconnectPath(parentId, pathKey, subIndex); }}
                    title="Disconnect"
                >
                    <Unlink className="h-3 w-3" />
                </Button>
                {renderNode(nextStepId)}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <div className="h-8 w-px bg-border" />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-full border-dashed px-4 text-xs hover:border-primary hover:text-primary transition-all">
                        <Plus className="h-3 w-3 mr-1.5" /> Add Step
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2">
                    {NODE_TYPES.filter(t => t.type !== 'start').map(t => (
                        <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type, parentId, pathKey, subIndex)} className="p-2 gap-3">
                            <t.icon className={cn("h-4 w-4 shrink-0", t.type === 'ai_step' ? 'text-violet-500' : 'text-primary')} />
                            <div className="space-y-0.5">
                                <p className="font-semibold text-xs">{t.label}</p>
                            </div>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <p className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase">Link Existing</p>
                    <ScrollArea className="h-40">
                        {nodes.filter(n => n.id !== parentId).map(n => (
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
                            }} className="p-2 gap-2">
                                <LinkIcon className="h-3 w-3" />
                                <span className="text-[10px] truncate">{n.type}: {n.id.substring(0, 8)}</span>
                            </DropdownMenuItem>
                        ))}
                    </ScrollArea>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
  };

  const startNode = nodes.find(n => n.type === 'start');
  const detachedNodes = nodes.filter(n => !renderedIds.has(n.id));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] p-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
                <DialogTitle>Automation Flow Map</DialogTitle>
                <DialogDescription className="text-xs">Recursive conversation tree • Every path is visible.</DialogDescription>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="builder" className="gap-2">
                <Settings2 className="h-4 w-4" /> Visual Map
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
              <div className="flex-1 bg-muted/20 overflow-auto p-12 relative flex flex-col items-center">
                {/* Main Tree */}
                <div className="inline-block">
                    {startNode && renderNode(startNode.id)}
                </div>

                {/* Detached Nodes */}
                {detachedNodes.length > 0 && (
                    <div className="mt-32 w-full max-w-4xl opacity-60 hover:opacity-100 transition-opacity">
                        <Separator className="mb-8" />
                        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                            <Unlink className="h-4 w-4" />
                            <h4 className="text-xs font-bold uppercase tracking-widest">Unconnected Nodes</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {detachedNodes.map(node => (
                                <Card 
                                    key={node.id} 
                                    className={cn("p-4 cursor-pointer border-2 hover:border-primary/50", selectedNodeId === node.id && "border-primary")}
                                    onClick={() => setSelectedNodeId(node.id)}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <Badge variant="outline" className="text-[10px]">{node.type}</Badge>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteNode(node.id)}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                    <p className="text-xs truncate text-muted-foreground">{node.data.text || node.data.prompt || '(Empty)'}</p>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
              </div>

              {/* Properties Panel */}
              <aside className="w-[400px] border-l bg-card flex flex-col shrink-0">
                <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Step Configuration
                    </h3>
                    {selectedNodeId && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedNodeId(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                
                <ScrollArea className="flex-1">
                    {nodes.find(n => n.id === selectedNodeId) ? (() => {
                        const selectedNode = nodes.find(n => n.id === selectedNodeId)!;
                        return (
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
                                    <div className="space-y-2">
                                        <Label>Classification Prompt</Label>
                                        <Input 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="e.g. How can we help today?"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>Intent Categories</Label>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                const newIntents = [...(selectedNode.data.intents || []), { id: `intent_${Date.now()}`, label: 'New Intent' }];
                                                updateNodeData(selectedNode.id, { intents: newIntents });
                                            }}>Add Intent</Button>
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

                            {selectedNode.type === 'quick_reply' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Question Text</Label>
                                        <Input 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="Ask something..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>Buttons</Label>
                                            <Button variant="outline" size="sm" onClick={() => {
                                                const newButtons = [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, label: 'New Button' }];
                                                updateNodeData(selectedNode.id, { buttons: newButtons });
                                            }}>Add Button</Button>
                                        </div>
                                        {selectedNode.data.buttons?.map((btn, bIndex) => (
                                            <div key={btn.id} className="flex items-center gap-2 p-2 border rounded-lg bg-background">
                                                <Input 
                                                    value={btn.label} 
                                                    onChange={(e) => {
                                                        const newButtons = [...(selectedNode.data.buttons || [])];
                                                        newButtons[bIndex].label = e.target.value;
                                                        updateNodeData(selectedNode.id, { buttons: newButtons });
                                                    }}
                                                    placeholder="Button Label"
                                                    className="h-8 text-xs border-none focus-visible:ring-0"
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                                    updateNodeData(selectedNode.id, { buttons: selectedNode.data.buttons?.filter(b => b.id !== btn.id) });
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
                        );
                    })() : (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground bg-muted/10">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6 border-2 border-dashed border-muted-foreground/20">
                                <Plus className="h-8 w-8 opacity-20" />
                            </div>
                            <h4 className="font-bold text-foreground mb-2">No Step Selected</h4>
                            <p className="text-sm">Click a step on the map to configure its behavior.</p>
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
            } else if (currentNode.type === 'intent_router') {
                // If it's a router and user typed free text, we simulate classification
                // In reality, this would call the AI
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
