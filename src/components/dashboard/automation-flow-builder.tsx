'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AutomationFlow, AutomationNode, AutomationNodeType, ChatMessage, User } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

const NODE_TYPES: { type: AutomationNodeType; label: string; icon: any; description: string; color: string }[] = [
  { type: 'message', label: 'Send Message', icon: MessageSquare, description: 'Send a static message to the visitor.', color: 'border-blue-500 bg-blue-500/5' },
  { type: 'quick_reply', label: 'Quick Replies', icon: MousePointerClick, description: 'Offer buttons for the visitor to click.', color: 'border-purple-500 bg-purple-500/5' },
  { type: 'capture_input', label: 'Capture Input', icon: Database, description: 'Ask a question and save the response.', color: 'border-teal-500 bg-teal-500/5' },
  { type: 'ai_step', label: 'AI Response', icon: Bot, description: 'Attempt to resolve using AI knowledge base.', color: 'border-violet-500 bg-violet-500/5' },
  { type: 'condition', label: 'Condition', icon: Split, description: 'Branch based on user data or input.', color: 'border-indigo-500 bg-indigo-500/5' },
  { type: 'handoff', label: 'Human Handoff', icon: UserCheck, description: 'Escalate to a human support agent.', color: 'border-orange-500 bg-orange-500/5' },
  { type: 'end', label: 'End Flow', icon: CircleStop, description: 'Mark the automation flow as finished.', color: 'border-gray-500 bg-gray-500/5' },
];

export default function AutomationFlowBuilder({ isOpen, onOpenChange, flow: initialFlow, onSave, allUsers = [] }: AutomationFlowBuilderProps) {
  const [nodes, setNodes] = useState<AutomationNode[]>(initialFlow.nodes || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');

  useEffect(() => {
    if (isOpen && (nodes.length === 0 || !nodes.find(n => n.type === 'start'))) {
      // Initialize with a start node + default greeting if empty
      const startId = 'start';
      const greetingId = 'greeting_msg';
      setNodes([
        { id: startId, type: 'start', data: {}, nextStepId: greetingId },
        { id: greetingId, type: 'message', data: { text: 'Hi there! How can I help you today?' } }
      ]);
    }
  }, [isOpen, nodes]);

  const handleAddNode = (type: AutomationNodeType) => {
    const newNode: AutomationNode = {
      id: `node_${Date.now()}`,
      type,
      data: type === 'quick_reply' ? { text: 'How can I help?', buttons: [{ id: `btn_${Date.now()}`, label: 'Option 1' }] } : 
            type === 'message' ? { text: 'New message' } :
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email' } : 
            type === 'condition' ? { conditionField: 'email', conditionValue: '', matchNextStepId: '', fallbackNextStepId: '' } : {},
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

  const getNodeTitle = (node: AutomationNode) => {
    const typeInfo = NODE_TYPES.find(t => t.type === node.type);
    if (node.type === 'start') return 'Conversation Started';
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
                <DialogDescription className="text-xs">Define execution paths for your chatbot.</DialogDescription>
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
                <div className="max-w-2xl mx-auto flex flex-col items-center">
                    {nodes.map((node, index) => {
                        const isSelected = selectedNodeId === node.id;
                        const typeInfo = NODE_TYPES.find(t => t.type === node.type);
                        const hasDeadEnd = !node.nextStepId && !['end', 'handoff'].includes(node.type) && 
                                          !(node.type === 'quick_reply' && node.data.buttons?.every(b => b.nextStepId)) &&
                                          !(node.type === 'condition' && node.data.matchNextStepId && node.data.fallbackNextStepId);

                        return (
                            <div key={node.id} className="w-full flex flex-col items-center group/node">
                                <Card 
                                    className={cn(
                                        "w-full border-2 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden",
                                        isSelected ? "border-primary ring-4 ring-primary/10" : "border-border",
                                        typeInfo?.color
                                    )}
                                    onClick={() => setSelectedNodeId(node.id)}
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
                                                {hasDeadEnd && (
                                                    <Badge variant="destructive" className="h-4 px-1 text-[8px] animate-pulse">
                                                        <AlertCircle className="h-2 w-2 mr-1" /> Dead End
                                                    </Badge>
                                                )}
                                            </div>
                                            <h4 className="font-semibold truncate text-sm">
                                                {node.type === 'message' ? (node.data.text || 'Empty message...') : 
                                                 node.type === 'quick_reply' ? (node.data.text || 'Choose option...') :
                                                 node.type === 'capture_input' ? (node.data.prompt || 'Ask question...') :
                                                 node.type === 'start' ? 'Conversation Start' :
                                                 node.type === 'ai_step' ? 'AI Resolution Phase' :
                                                 node.type === 'condition' ? `Check: ${node.data.conditionField}` :
                                                 node.type === 'handoff' ? 'Human Handoff' :
                                                 node.type === 'end' ? 'Flow Complete' : 'New Step'}
                                            </h4>
                                            
                                            {node.type === 'capture_input' && node.data.variableName && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Badge variant="outline" className="text-[9px] h-4 py-0 font-mono bg-background/50">
                                                        <Terminal className="h-2.5 w-2.5 mr-1" /> save as: {node.data.variableName}
                                                    </Badge>
                                                </div>
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
                                    
                                    {/* BRANCH VISUALIZATION */}
                                    {node.type === 'quick_reply' && node.data.buttons && (
                                        <div className="px-4 pb-4 space-y-2 border-t pt-3 bg-white/50 dark:bg-black/5">
                                            {node.data.buttons.map(btn => {
                                                const targetNode = nodes.find(n => n.id === btn.nextStepId);
                                                return (
                                                    <div key={btn.id} className="flex items-center justify-between text-xs group/branch">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
                                                                <MousePointerClick className="h-3 w-3" />
                                                            </div>
                                                            <span className="font-semibold truncate">{btn.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-4">
                                                            <ArrowRight className="h-3 w-3" />
                                                            {targetNode ? (
                                                                <Badge variant="secondary" className="text-[9px] h-4 max-w-[120px] truncate">
                                                                    {getNodeTitle(targetNode)}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[10px] text-destructive italic font-medium">No path selected</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            
                                            {/* Free Text Path */}
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed">
                                                <div className="flex items-center gap-2 text-muted-foreground italic">
                                                    <MessageSquare className="h-3 w-3" />
                                                    <span>Visitor types message...</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground shrink-0 pl-4">
                                                    <ArrowRight className="h-3 w-3" />
                                                    {node.data.defaultNextStepId ? (
                                                        <Badge variant="secondary" className="text-[9px] h-4">
                                                            {getNodeTitle(nodes.find(n => n.id === node.data.defaultNextStepId)!)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] italic">Flow stops</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {node.type === 'ai_step' && (
                                        <div className="px-4 pb-3 pt-2 border-t bg-violet-500/5 text-[10px] space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground uppercase font-bold tracking-tight">On Unresolved</span>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <ArrowRight className="h-2.5 w-2.5" />
                                                    {node.data.fallbackNextStepId ? (
                                                        <span className="text-foreground font-bold">{getNodeTitle(nodes.find(n => n.id === node.data.fallbackNextStepId)!)}</span>
                                                    ) : (
                                                        <span className="italic">No fallback</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                                
                                {/* Connector Line Area */}
                                <div className="h-10 w-px bg-border group-last/node:hidden relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 bg-background border rounded-full flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity">
                                        <Plus className="h-2.5 w-2.5 text-muted-foreground" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="pt-4 flex flex-col items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="rounded-full h-12 px-8 shadow-xl relative z-10 transition-transform hover:scale-105 active:scale-95">
                                    <Plus className="h-5 w-5 mr-2" /> Add Step
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-72 p-2">
                                <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Communication</p>
                                {NODE_TYPES.filter(t => ['message', 'quick_reply'].includes(t.type)).map(t => (
                                    <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type)} className="p-3 gap-3">
                                        <t.icon className="h-5 w-5 text-primary shrink-0" />
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-sm">{t.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.description}</p>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Logic & Data</p>
                                {NODE_TYPES.filter(t => !['message', 'quick_reply', 'start'].includes(t.type)).map(t => (
                                    <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type)} className="p-3 gap-3">
                                        <t.icon className="h-5 w-5 text-primary shrink-0" />
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
                        Step Configuration
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
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Step Type</Label>
                                <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-background">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        {React.createElement(NODE_TYPES.find(t => t.type === selectedNode.type)?.icon || Settings2, { className: "h-5 w-5 text-primary" })}
                                    </div>
                                    <div>
                                        <span className="font-bold text-sm capitalize">{selectedNode.type.replace('_', ' ')}</span>
                                        <p className="text-[10px] text-muted-foreground">{NODE_TYPES.find(t => t.type === selectedNode.type)?.description}</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {selectedNode.type === 'message' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Message Text</Label>
                                        <Textarea 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="Enter the message text to show to the visitor..."
                                            rows={6}
                                            className="resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'quick_reply' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Instructional Text</Label>
                                        <Input 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="e.g. Choose an option below:"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <Label>Buttons & Paths</Label>
                                        {selectedNode.data.buttons?.map((btn, bIndex) => (
                                            <div key={btn.id} className="space-y-3 p-4 border-2 rounded-xl bg-muted/20 relative group/btn-edit">
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        value={btn.label} 
                                                        onChange={(e) => {
                                                            const newButtons = [...(selectedNode.data.buttons || [])];
                                                            newButtons[bIndex].label = e.target.value;
                                                            updateNodeData(selectedNode.id, { buttons: newButtons });
                                                        }}
                                                        placeholder="Button Label"
                                                        className="h-9 font-medium"
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive opacity-0 group-hover/btn-edit:opacity-100 transition-opacity" onClick={() => {
                                                        updateNodeData(selectedNode.id, { buttons: selectedNode.data.buttons?.filter(b => b.id !== btn.id) });
                                                    }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">If clicked, continue to:</Label>
                                                    <Select value={btn.nextStepId || 'none'} onValueChange={(val) => {
                                                        const newButtons = [...(selectedNode.data.buttons || [])];
                                                        newButtons[bIndex].nextStepId = val === 'none' ? undefined : val;
                                                        updateNodeData(selectedNode.id, { buttons: newButtons });
                                                    }}>
                                                        <SelectTrigger className="h-9 text-xs bg-background">
                                                            <SelectValue placeholder="End conversation" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Stop Flow (Dead End)</SelectItem>
                                                            {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                                <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full border-dashed" onClick={() => {
                                            const newButtons = [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, label: 'New Option' }];
                                            updateNodeData(selectedNode.id, { buttons: newButtons });
                                        }}>
                                            <Plus className="h-4 w-4 mr-2" /> Add Button Option
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-3 pt-4 border-t">
                                        <Label className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                            If visitor types message instead
                                        </Label>
                                        <Select value={selectedNode.data.defaultNextStepId || 'none'} onValueChange={(val) => updateNodeData(selectedNode.id, { defaultNextStepId: val === 'none' ? undefined : val })}>
                                            <SelectTrigger className="h-9 text-xs bg-background">
                                                <SelectValue placeholder="Stop flow" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Stop Flow</SelectItem>
                                                {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                    <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'capture_input' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Question to ask visitor</Label>
                                        <Input 
                                            value={selectedNode.data.prompt || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                            placeholder="e.g. What is your order number?"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label>Store response as</Label>
                                        <Select value={selectedNode.data.variableName || 'custom'} onValueChange={(val) => updateNodeData(selectedNode.id, { variableName: val })}>
                                            <SelectTrigger className="bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="email">Email Address</SelectItem>
                                                <SelectItem value="name">Full Name</SelectItem>
                                                <SelectItem value="phone">Phone Number</SelectItem>
                                                <SelectItem value="order_number">Order Number</SelectItem>
                                                <SelectItem value="custom">General Metadata</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                            Storing this data allows subsequent nodes (like API Lookups or AI) to use this information.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'ai_step' && (
                                <div className="space-y-6">
                                    <div className="bg-violet-500/10 border-2 border-violet-500/20 rounded-xl p-4 flex gap-3">
                                        <Bot className="h-5 w-5 text-violet-500 shrink-0" />
                                        <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                                            The AI will attempt to answer the user&apos;s query using your connected knowledge bases.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">If AI cannot find an answer:</Label>
                                        <Select value={selectedNode.data.fallbackNextStepId || 'none'} onValueChange={(val) => updateNodeData(selectedNode.id, { fallbackNextStepId: val === 'none' ? undefined : val })}>
                                            <SelectTrigger className="bg-background h-10">
                                                <SelectValue placeholder="Stop flow" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Stop Flow</SelectItem>
                                                {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                    <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'condition' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Label>Logic Rule</Label>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-muted-foreground">If</span>
                                            <Select value={selectedNode.data.conditionField || 'email'} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionField: v })}>
                                                <SelectTrigger className="h-8 py-0"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="email">Email</SelectItem>
                                                    <SelectItem value="name">Name</SelectItem>
                                                    <SelectItem value="is_authenticated">Is Authenticated</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <span className="text-muted-foreground">exists...</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Match (True)</Label>
                                            <Select value={selectedNode.data.matchNextStepId || 'none'} onValueChange={(v) => updateNodeLink(selectedNode.id, v === 'none' ? undefined : v)}>
                                                <SelectTrigger className="bg-background h-9 text-xs"><SelectValue placeholder="Stop" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Stop Flow</SelectItem>
                                                    {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                        <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-rose-500 font-bold text-[10px] uppercase tracking-widest">Fallback (False)</Label>
                                            <Select value={selectedNode.data.fallbackNextStepId || 'none'} onValueChange={(v) => updateNodeData(selectedNode.id, { fallbackNextStepId: v === 'none' ? undefined : v })}>
                                                <SelectTrigger className="bg-background h-9 text-xs"><SelectValue placeholder="Stop" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Stop Flow</SelectItem>
                                                    {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                        <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(['message', 'capture_input', 'start'].includes(selectedNode.type)) && (
                                <div className="space-y-3 pt-4 border-t">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Continue to next step:</Label>
                                    <Select value={selectedNode.nextStepId || 'none'} onValueChange={(val) => updateNodeLink(selectedNode.id, val === 'none' ? undefined : val)}>
                                        <SelectTrigger className="h-10 bg-background">
                                            <SelectValue placeholder="End conversation" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Stop Flow (Wait for reply)</SelectItem>
                                            {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                <SelectItem key={n.id} value={n.id}>{getNodeTitle(n)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {selectedNode.type === 'handoff' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Handoff Confirmation Message</Label>
                                        <Textarea 
                                            value={selectedNode.data.text || ''} 
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            placeholder="e.g. I'm connecting you with an agent. They will reply here shortly..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground bg-muted/10">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                                <Plus className="h-8 w-8 opacity-20" />
                            </div>
                            <h4 className="font-bold text-foreground mb-2">No Step Selected</h4>
                            <p className="text-sm">Select a card on the canvas to configure its content and behavior.</p>
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

    // Initial flow start
    useEffect(() => {
        const startNode = nodes.find(n => n.type === 'start');
        if (startNode?.nextStepId) {
            handleStep(startNode.nextStepId);
        }
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
        } else if (node.type === 'quick_reply') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text, type: 'automation', buttons: node.data.buttons }]);
        } else if (node.type === 'capture_input') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt, type: 'automation' }]);
        } else if (node.type === 'ai_step') {
            setIsThinking(true);
            setTimeout(() => {
                setIsThinking(false);
                setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: "I found an answer in our knowledge base regarding that...", type: 'ai' }]);
            }, 1500);
        } else if (node.type === 'handoff') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || "Connecting you to an agent...", type: 'automation' }]);
            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: "Conversation escalated to human agent" }]);
        } else if (node.type === 'condition') {
            // Simulate random path for preview
            const next = Math.random() > 0.5 ? node.data.matchNextStepId : node.data.fallbackNextStepId;
            handleStep(next || null);
        } else if (node.type === 'end') {
            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: "Conversation resolved" }]);
        }
    };

    const handleUserInput = (text: string, buttonId?: string) => {
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);
        
        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (currentNode?.type === 'quick_reply') {
            const btn = currentNode.data.buttons?.find(b => b.id === buttonId);
            if (btn?.nextStepId) {
                handleStep(btn.nextStepId);
            } else if (currentNode.data.defaultNextStepId) {
                handleStep(currentNode.data.defaultNextStepId);
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
                            <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-bold text-sm">Flow Preview</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold" onClick={() => setMessages([])}>Reset</Button>
                </div>

                <ScrollArea className="flex-1" ref={scrollRef}>
                    <div className="p-6 space-y-6">
                        <div className="flex justify-center">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-muted/50 border-none">Preview Started</Badge>
                        </div>
                        
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
                                        "max-w-[85%] p-3 rounded-2xl text-sm",
                                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-br-none" : 
                                        m.type === 'ai' ? "bg-indigo-500/10 border-2 border-indigo-500/20 text-foreground rounded-bl-none" :
                                        "bg-muted text-foreground rounded-bl-none"
                                    )}>
                                        <p>{m.text}</p>
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
