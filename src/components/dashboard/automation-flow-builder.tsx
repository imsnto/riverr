'use client';

import React, { useState, useEffect } from 'react';
import { AutomationFlow, AutomationNode, AutomationNodeType } from '@/lib/data';
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
  ChevronDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
} from '@/components/ui/dropdown-menu';

interface AutomationFlowBuilderProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  flow: AutomationFlow;
  onSave: (flow: AutomationFlow) => void;
}

const NODE_TYPES: { type: AutomationNodeType; label: string; icon: any; description: string }[] = [
  { type: 'message', label: 'Send Message', icon: MessageSquare, description: 'Send a static message to the visitor.' },
  { type: 'quick_reply', label: 'Quick Replies', icon: MousePointerClick, description: 'Offer buttons for the visitor to click.' },
  { type: 'capture_input', label: 'Capture Input', icon: Database, description: 'Ask a question and save the response.' },
  { type: 'ai_step', label: 'AI Response', icon: Bot, description: 'Attempt to resolve using AI knowledge base.' },
  { type: 'handoff', label: 'Human Handoff', icon: UserCheck, description: 'Escalate to a human support agent.' },
  { type: 'end', label: 'End Flow', icon: CircleStop, description: 'Mark the automation flow as finished.' },
];

export default function AutomationFlowBuilder({ isOpen, onOpenChange, flow: initialFlow, onSave }: AutomationFlowBuilderProps) {
  const [nodes, setNodes] = useState<AutomationNode[]>(initialFlow.nodes || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && nodes.length === 0) {
      // Initialize with a start node if empty
      setNodes([{ id: 'start', type: 'start', data: {} }]);
    }
  }, [isOpen, nodes]);

  const handleAddNode = (type: AutomationNodeType) => {
    const newNode: AutomationNode = {
      id: `node_${Date.now()}`,
      type,
      data: type === 'quick_reply' ? { text: 'How can I help?', buttons: [{ id: 'btn_1', label: 'Option 1' }] } : 
            type === 'message' ? { text: 'Hello!' } :
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email' } : {},
    };
    
    // Link from previous node if it doesn't have a nextStepId
    const lastNode = nodes[nodes.length - 1];
    if (lastNode && !lastNode.nextStepId && lastNode.type !== 'end' && lastNode.type !== 'handoff') {
        const newNodes = [...nodes];
        newNodes[nodes.length - 1] = { ...lastNode, nextStepId: newNode.id };
        setNodes([...newNodes, newNode]);
    } else {
        setNodes([...nodes, newNode]);
    }
    
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

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] p-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Split className="h-5 w-5 text-primary" />
            </div>
            <div>
                <DialogTitle>Automation Flow Builder</DialogTitle>
                <DialogDescription className="text-xs">Define the execution logic for your chatbot.</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Flow</Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 bg-muted/20 overflow-y-auto p-12">
            <div className="max-w-md mx-auto space-y-8 relative">
                {/* Visual Connector Line */}
                <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-border -translate-x-1/2" />

                {nodes.map((node, index) => (
                    <div key={node.id} className="relative z-10 flex flex-col items-center">
                        <Card 
                            className={cn(
                                "w-full border-2 transition-all cursor-pointer hover:shadow-lg",
                                selectedNodeId === node.id ? "border-primary ring-4 ring-primary/10" : "border-border"
                            )}
                            onClick={() => setSelectedNodeId(node.id)}
                        >
                            <div className="p-4 flex items-center gap-4">
                                <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                    node.type === 'start' ? "bg-emerald-500/10 text-emerald-500" :
                                    node.type === 'handoff' ? "bg-amber-500/10 text-amber-500" :
                                    node.type === 'end' ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                                )}>
                                    {node.type === 'start' ? <PlayCircle className="h-5 w-5" /> :
                                     NODE_TYPES.find(t => t.type === node.type)?.icon ? 
                                     React.createElement(NODE_TYPES.find(t => t.type === node.type)!.icon, { className: "h-5 w-5" }) :
                                     <Settings2 className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                                        {node.type}
                                    </p>
                                    <h4 className="font-semibold truncate">
                                        {node.type === 'message' ? node.data.text : 
                                         node.type === 'quick_reply' ? node.data.text :
                                         node.type === 'capture_input' ? node.data.prompt :
                                         node.type === 'start' ? 'Conversation Start' :
                                         node.type === 'ai_step' ? 'Attempt AI Response' :
                                         node.type === 'handoff' ? 'Human Handoff' :
                                         node.type === 'end' ? 'Flow Finished' : 'New Step'}
                                    </h4>
                                </div>
                                {node.id !== 'start' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            
                            {node.type === 'quick_reply' && node.data.buttons && (
                                <div className="px-4 pb-4 flex flex-wrap gap-2">
                                    {node.data.buttons.map(btn => (
                                        <Badge key={btn.id} variant="secondary" className="px-2 py-1 rounded-md text-[10px]">
                                            {btn.label} <ChevronRight className="h-3 w-3 ml-1 opacity-50" />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </Card>
                        
                        {/* Add Step Button Between Nodes */}
                        {index < nodes.length - 1 && (
                            <div className="h-8 w-px bg-border my-2" />
                        )}
                    </div>
                ))}

                <div className="flex flex-col items-center pt-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="rounded-full h-12 px-6 shadow-xl">
                                <Plus className="h-5 w-5 mr-2" /> Add Next Step
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                            {NODE_TYPES.map(t => (
                                <DropdownMenuItem key={t.type} onClick={() => handleAddNode(t.type)} className="p-3">
                                    <div className="flex items-start gap-3">
                                        <t.icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                                        <div className="space-y-0.5">
                                            <p className="font-semibold text-sm">{t.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.description}</p>
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
          </div>

          {/* Properties Panel */}
          <aside className="w-96 border-l bg-card flex flex-col shrink-0">
            <div className="p-4 border-b">
                <h3 className="font-bold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Step Properties
                </h3>
            </div>
            
            <ScrollArea className="flex-1">
                {selectedNode ? (
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Step Type</Label>
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                {React.createElement(NODE_TYPES.find(t => t.type === selectedNode.type)?.icon || Settings2, { className: "h-5 w-5 text-primary" })}
                                <span className="font-bold capitalize">{selectedNode.type.replace('_', ' ')}</span>
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
                                        placeholder="Type message here..."
                                        rows={4}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedNode.type === 'quick_reply' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Instruction Text</Label>
                                    <Input 
                                        value={selectedNode.data.text || ''} 
                                        onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                        placeholder="e.g. Choose an option:"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label>Buttons</Label>
                                    {selectedNode.data.buttons?.map((btn, bIndex) => (
                                        <div key={btn.id} className="space-y-2 p-3 border rounded-lg bg-muted/20">
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    value={btn.label} 
                                                    onChange={(e) => {
                                                        const newButtons = [...(selectedNode.data.buttons || [])];
                                                        newButtons[bIndex].label = e.target.value;
                                                        updateNodeData(selectedNode.id, { buttons: newButtons });
                                                    }}
                                                    placeholder="Button Label"
                                                    className="h-8"
                                                />
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                                    updateNodeData(selectedNode.id, { buttons: selectedNode.data.buttons?.filter(b => b.id !== btn.id) });
                                                }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Next Step</Label>
                                                <Select value={btn.nextStepId || 'none'} onValueChange={(val) => {
                                                    const newButtons = [...(selectedNode.data.buttons || [])];
                                                    newButtons[bIndex].nextStepId = val === 'none' ? undefined : val;
                                                    updateNodeData(selectedNode.id, { buttons: newButtons });
                                                }}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Continue to..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Stop Flow</SelectItem>
                                                        {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                            <SelectItem key={n.id} value={n.id}>{n.type}: {n.data.text || n.data.prompt || n.id}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => {
                                        const newButtons = [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, label: 'New Option' }];
                                        updateNodeData(selectedNode.id, { buttons: newButtons });
                                    }}>
                                        <Plus className="h-3 w-3 mr-2" /> Add Button
                                    </Button>
                                </div>
                            </div>
                        )}

                        {selectedNode.type === 'capture_input' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Question to ask</Label>
                                    <Input 
                                        value={selectedNode.data.prompt || ''} 
                                        onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                        placeholder="e.g. What is your order number?"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Save to Variable</Label>
                                    <Select value={selectedNode.data.variableName || 'custom'} onValueChange={(val) => updateNodeData(selectedNode.id, { variableName: val })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">Email Address</SelectItem>
                                            <SelectItem value="name">Full Name</SelectItem>
                                            <SelectItem value="phone">Phone Number</SelectItem>
                                            <SelectItem value="custom">Custom Metadata</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {(selectedNode.type === 'message' || selectedNode.type === 'capture_input' || selectedNode.type === 'start') && (
                            <div className="space-y-2">
                                <Label>Next Step</Label>
                                <Select value={selectedNode.nextStepId || 'none'} onValueChange={(val) => updateNodeLink(selectedNode.id, val === 'none' ? undefined : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="End of flow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">End Flow</SelectItem>
                                        {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                            <SelectItem key={n.id} value={n.id}>{n.type}: {n.data.text || n.data.prompt || n.id}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {selectedNode.type === 'handoff' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Handoff Message</Label>
                                    <Textarea 
                                        value={selectedNode.data.text || ''} 
                                        onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                        placeholder="A ticket has been created..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 p-8 text-center text-muted-foreground">
                        <Plus className="h-8 w-8 mb-4 opacity-20" />
                        <p className="text-sm">Select a step on the canvas to configure its properties.</p>
                    </div>
                )}
            </ScrollArea>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
