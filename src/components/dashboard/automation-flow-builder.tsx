// src/components/dashboard/automation-flow-builder.tsx
'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  type NodeProps,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  AutomationFlow,
  AutomationNode,
  AutomationEdge,
  AutomationNodeType,
  User,
} from '@/lib/data';
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
  PlayCircle,
  Settings2,
  X,
  Send,
  Eye,
  Navigation,
  Check,
  ChevronRight,
  Edit,
  Search,
  Link,
  Zap,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '../ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';

const NODE_TYPES_META: Record<AutomationNodeType, { label: string; icon: any; color: string; description: string; category: 'conversation' | 'ai' | 'logic' | 'human' }> = {
  start: { label: 'Conversation Start', icon: PlayCircle, color: 'bg-emerald-500', description: 'Triggered when a new chat begins.', category: 'conversation' },
  message: { label: 'Send Message', icon: MessageSquare, color: 'bg-blue-500', description: 'Sends a static text message to the visitor.', category: 'conversation' },
  quick_reply: { label: 'Quick Replies', icon: MousePointerClick, color: 'bg-purple-500', description: 'Offers buttons for the visitor to click.', category: 'conversation' },
  intent_router: { label: 'Intent Router', icon: Navigation, color: 'bg-indigo-600', description: 'AI classifies text and routes to specific paths.', category: 'ai' },
  capture_input: { label: 'Capture Input', icon: Database, color: 'bg-teal-500', description: 'Asks a question and saves the response.', category: 'conversation' },
  ai_step: { label: 'AI Reasoning', icon: Bot, color: 'bg-violet-500', description: 'Conversational reasoning with knowledge base.', category: 'ai' },
  condition: { label: 'Condition', icon: Split, color: 'bg-amber-500', description: 'Branch based on data or identified state.', category: 'logic' },
  handoff: { label: 'Human Handoff', icon: UserCheck, color: 'bg-orange-500', description: 'Transfers the chat to a team member.', category: 'human' },
  end: { label: 'Wait for Visitor', icon: CircleStop, color: 'bg-gray-500', description: 'Pauses the flow until the visitor replies.', category: 'human' },
};

const CustomNodeComponent = ({ type, data, selected, id }: NodeProps) => {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const meta = NODE_TYPES_META[type as AutomationNodeType];
  const Icon = meta.icon;

  const isHandleConnected = (handleId: string) => 
    edges.some(e => e.source === id && e.sourceHandle === handleId);

  const AddStepButton = ({ handleId, label }: { handleId: string, label?: string }) => {
    const connected = isHandleConnected(handleId);
    if (connected) return null;

    return (
      <div 
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-7 w-7 rounded-full bg-background shadow-lg hover:bg-primary hover:text-primary-foreground border-primary/20 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="center" className="w-72 p-0 shadow-2xl border-2">
            <ScrollArea className="max-h-[450px]">
              <div className="p-2">
                <p className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Connect to Step</p>
                
                <div className="space-y-4 py-2">
                    {[
                        { key: 'conversation', label: 'Conversation' },
                        { key: 'ai', label: 'AI' },
                        { key: 'logic', label: 'Logic' },
                        { key: 'human', label: 'Human' }
                    ].map(cat => (
                        <div key={cat.key}>
                            <p className="px-2 mb-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
                            <div className="grid gap-1">
                                {Object.entries(NODE_TYPES_META)
                                    .filter(([t, m]) => t !== 'start' && m.category === cat.key)
                                    .map(([t, m]) => (
                                        <DropdownMenuItem key={t} onClick={(e) => {
                                            e.stopPropagation();
                                            data.onAddNodeAndConnect?.(t as AutomationNodeType, id, handleId);
                                        }} className="gap-3 p-2 cursor-pointer">
                                            <div className={cn("h-6 w-6 rounded flex items-center justify-center text-white", m.color)}>
                                                {React.createElement(m.icon, { className: 'h-3 w-3' })}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold">{m.label}</span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  data.onPickExisting?.(id, handleId);
                }} className="gap-3 p-2.5 cursor-pointer">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-zinc-700 text-white">
                    <Link className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Connect Existing Step...</span>
                    <span className="text-[9px] text-muted-foreground">Link to a node already on the map.</span>
                  </div>
                </DropdownMenuItem>
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
        {label && <span className="mt-1 text-[8px] font-black uppercase text-muted-foreground/50 tracking-tighter whitespace-nowrap">{label}</span>}
      </div>
    );
  };

  return (
    <Card className={cn(
      "w-64 border-2 shadow-sm relative transition-all group",
      selected ? "border-primary ring-4 ring-primary/10 scale-[1.02] shadow-xl z-50" : "border-border"
    )}>
      {type !== 'start' && (
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <Button
            variant="destructive"
            size="icon"
            className="h-6 w-6 rounded-full shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-inner", meta.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 leading-none">
              {meta.label}
            </p>
            <h4 className="font-bold text-xs truncate mt-1">
              {data.text || data.prompt || data.name || (type === 'start' ? 'Conversation Start' : 'Step')}
            </h4>
          </div>
        </div>

        {type !== 'start' && (
          <Handle type="target" position={Position.Top} className="w-3 h-3 bg-zinc-400 border-2 border-background" />
        )}

        {type === 'capture_input' && data.variableName && (
          <div className="mt-2 p-1.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded text-[10px] font-mono text-teal-700 dark:text-teal-400">
            SAVE AS: {data.variableName}
          </div>
        )}

        <div className="absolute -bottom-3 left-0 right-0 flex justify-center gap-12 px-4 pointer-events-none">
          {type === 'condition' ? (
            <>
              <div className="relative pointer-events-auto">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[9px] h-5 px-2 uppercase font-black">True</Badge>
                <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-emerald-500 border-2 border-background" />
                <AddStepButton handleId="true" label="If True" />
              </div>
              <div className="relative pointer-events-auto">
                <Badge className="bg-rose-500 hover:bg-rose-500 text-[9px] h-5 px-2 uppercase font-black">False</Badge>
                <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-rose-500 border-2 border-background" />
                <AddStepButton handleId="false" label="If False" />
              </div>
            </>
          ) : type === 'ai_step' ? (
            <>
              <div className="relative pointer-events-auto">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[9px] h-5 px-2 uppercase font-black">Resolved</Badge>
                <Handle type="source" position={Position.Bottom} id="resolved" className="w-3 h-3 bg-emerald-500 border-2 border-background" />
                <AddStepButton handleId="resolved" label="Answered" />
              </div>
              <div className="relative pointer-events-auto">
                <Badge className="bg-orange-500 hover:bg-orange-500 text-[9px] h-5 px-2 uppercase font-black">Unresolved</Badge>
                <Handle type="source" position={Position.Bottom} id="unresolved" className="w-3 h-3 bg-orange-500 border-2 border-background" />
                <AddStepButton handleId="unresolved" label="Fallback" />
              </div>
            </>
          ) : type === 'intent_router' || type === 'quick_reply' ? (
            <div className="flex gap-2">
              {(type === 'intent_router' ? (data.intents || []) : (data.buttons || [])).map((btn: any) => (
                <div key={btn.id} className="relative pointer-events-auto">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 px-1.5 whitespace-nowrap">
                    {btn.label}
                  </Badge>
                  <Handle type="source" position={Position.Bottom} id={`intent:${btn.id}`} className="w-2.5 h-2.5 bg-primary border-2 border-background" />
                  <AddStepButton handleId={`intent:${btn.id}`} label={btn.label} />
                </div>
              ))}
              <div className="relative pointer-events-auto">
                <Badge variant="outline" className="bg-muted text-muted-foreground text-[8px] h-5 px-1.5">UNKNOWN</Badge>
                <Handle type="source" position={Position.Bottom} id="unknown" className="w-2.5 h-2.5 bg-zinc-400 border-2 border-background" />
                <AddStepButton handleId="unknown" label="Unknown" />
              </div>
            </div>
          ) : (
            <div className="relative pointer-events-auto">
              <Handle type="source" position={Position.Bottom} id="next" className="w-3 h-3 bg-primary border-2 border-background" />
              <AddStepButton handleId="next" label="Next Step" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const nodeTypes = {
  start: CustomNodeComponent,
  message: CustomNodeComponent,
  quick_reply: CustomNodeComponent,
  intent_router: CustomNodeComponent,
  capture_input: CustomNodeComponent,
  ai_step: CustomNodeComponent,
  condition: CustomNodeComponent,
  handoff: CustomNodeComponent,
  end: CustomNodeComponent,
};

interface AutomationFlowBuilderProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  flow: AutomationFlow;
  onSave: (flow: AutomationFlow) => void;
}

function FlowBuilderInner({ isOpen, onOpenChange, flow: initialFlow, onSave }: AutomationFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');
  const [pickingTarget, setPickingTarget] = useState<{ sourceId: string, sourceHandle: string } | null>(null);
  const { fitView, getNode } = useReactFlow();
  
  const initializedRef = useRef(false);

  const deleteNode = useCallback((id: string) => {
    if (id === 'start') return;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((prev) => prev === id ? null : prev);
  }, [setNodes, setEdges]);

  const onAddNodeAndConnect = useCallback((type: AutomationNodeType, sourceId: string, sourceHandle: string) => {
    const parentNode = getNode(sourceId);
    if (!parentNode) return;

    const id = `node_${Date.now()}`;
    const position = { 
      x: parentNode.position.x, 
      y: parentNode.position.y + 250 
    };

    const newNode = {
      id,
      type,
      position,
      data: type === 'message' ? { text: 'Bot: Hi there!' } :
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email' } :
            type === 'intent_router' ? { text: 'How can we help?', intents: [{ id: `i_${Date.now()}`, label: 'Support' }] } :
            type === 'quick_reply' ? { text: 'Choose an option:', buttons: [{ id: `b_${Date.now()}`, label: 'Pricing' }] } :
            {},
    };

    const newEdge = {
      id: `e_${sourceId}_${id}`,
      source: sourceId,
      target: id,
      sourceHandle,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      style: { strokeWidth: 2, stroke: '#3b82f6' }
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    setSelectedNodeId(id);
  }, [getNode, setNodes, setEdges]);

  const onPickExisting = useCallback((sourceId: string, sourceHandle: string) => {
    setPickingTarget({ sourceId, sourceHandle });
  }, []);

  const handlePickTargetNode = (targetId: string) => {
    if (!pickingTarget) return;
    
    const newEdge = {
      id: `e_${pickingTarget.sourceId}_${targetId}`,
      source: pickingTarget.sourceId,
      target: targetId,
      sourceHandle: pickingTarget.sourceHandle,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      style: { strokeWidth: 2, stroke: '#3b82f6' }
    };

    setEdges((eds) => addEdge(newEdge, eds));
    setPickingTarget(null);
  };

  const nodesWithActions = useMemo(() => 
    nodes.map(n => ({
      ...n,
      data: { 
        ...n.data, 
        onDelete: deleteNode,
        onAddNodeAndConnect: onAddNodeAndConnect,
        onPickExisting: onPickExisting
      }
    })), [nodes, deleteNode, onAddNodeAndConnect, onPickExisting]
  );

  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      if (!initialFlow.nodes || initialFlow.nodes.length === 0) {
        const defaultNodes: any[] = [
          { id: 'start', type: 'start', position: { x: 120, y: 40 }, data: {} },
          { id: 'greeting', type: 'message', position: { x: 120, y: 180 }, data: { text: 'Hi there! How can we help you today?' } },
          { id: 'router', type: 'intent_router', position: { x: 420, y: 180 }, data: { 
              text: 'How can we help today?', 
              intents: [
                { id: 'i1', label: 'Support' },
                { id: 'i2', label: 'Pricing' },
                { id: 'i3', label: 'Features' },
                { id: 'i4', label: 'Human' }
              ] 
          }},
          { id: 'ai', type: 'ai_step', position: { x: 820, y: 80 }, data: {} },
          { id: 'pricing_msg', type: 'message', position: { x: 820, y: 260 }, data: { text: "We'd be happy to help with pricing and plans.\n\nTell us what you're looking for, or ask to speak with sales." } },
          { id: 'handoff', type: 'handoff', position: { x: 820, y: 440 }, data: { text: 'Connecting you to our team. Someone will be with you shortly.' } },
          { id: 'wait', type: 'end', position: { x: 1180, y: 220 }, data: {} }
        ];

        const defaultEdges: any[] = [
          { id: 'e1', source: 'start', target: 'greeting', sourceHandle: 'next', type: 'smoothstep' },
          { id: 'e2', source: 'greeting', target: 'router', sourceHandle: 'next', type: 'smoothstep' },
          { id: 'e3', source: 'router', target: 'ai', sourceHandle: 'intent:i1', type: 'smoothstep' },
          { id: 'e4', source: 'router', target: 'pricing_msg', sourceHandle: 'intent:i2', type: 'smoothstep' },
          { id: 'e5', source: 'router', target: 'ai', sourceHandle: 'intent:i3', type: 'smoothstep' },
          { id: 'e6', source: 'router', target: 'handoff', sourceHandle: 'intent:i4', type: 'smoothstep' },
          { id: 'e7', source: 'router', target: 'ai', sourceHandle: 'unknown', type: 'smoothstep' },
          { id: 'e8', source: 'ai', target: 'wait', sourceHandle: 'resolved', type: 'smoothstep' },
          { id: 'e9', source: 'ai', target: 'handoff', sourceHandle: 'unresolved', type: 'smoothstep' },
          { id: 'e10', source: 'pricing_msg', target: 'wait', sourceHandle: 'next', type: 'smoothstep' },
          { id: 'e11', source: 'handoff', target: 'wait', sourceHandle: 'next', type: 'smoothstep' }
        ];

        setNodes(defaultNodes);
        setEdges(defaultEdges);
      } else {
        setNodes(initialFlow.nodes.map(n => ({ ...n, id: n.id, data: { ...n.data }, position: n.position || { x: 0, y: 0 } })));
        setEdges(initialFlow.edges || []);
      }
      initializedRef.current = true;
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    }
    
    if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen, fitView, initialFlow, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep', 
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      style: { strokeWidth: 2, stroke: '#3b82f6' }
    }, eds));
  }, [setEdges]);

  const handleNodeClick = (_: any, node: any) => setSelectedNodeId(node.id);

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n)));
  };

  const handleSave = () => {
    const flowData: AutomationFlow = {
      nodes: nodes.map(n => ({ id: n.id, type: n.type as AutomationNodeType, data: n.data, position: n.position })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })) as AutomationEdge[],
    };
    onSave(flowData);
    onOpenChange(false);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-screen p-0 flex flex-col overflow-hidden rounded-none border-none">
        <header className="flex items-center justify-between p-3 border-b bg-background shrink-0 z-[200] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <DialogTitle className="text-sm font-bold">Automation Flow</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Visual Logic Map</DialogDescription>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
            <TabsList className="bg-muted/50 p-1 rounded-full border h-9">
              <TabsTrigger value="builder" className="rounded-full gap-2 px-6 h-7 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Map
              </TabsTrigger>
              <TabsTrigger value="preview" className="rounded-full gap-2 px-6 h-7 text-xs">
                <Eye className="h-3.5 w-3.5" /> Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="rounded-full px-6">Save Changes</Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'builder' ? (
            <>
              <div className="flex-1 bg-[#090909] bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:24px_24px] relative">
                <ReactFlow
                  nodes={nodesWithActions}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={handleNodeClick}
                  nodeTypes={nodeTypes}
                  fitView
                  colorMode="dark"
                  defaultEdgeOptions={{ 
                    type: 'smoothstep', 
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                    style: { strokeWidth: 2, stroke: '#3b82f6' }
                  }}
                >
                  <Background />
                  <Controls className="bg-card border-border shadow-2xl rounded-lg overflow-hidden fill-foreground" />
                </ReactFlow>
              </div>

              {(selectedNodeId && selectedNode) || pickingTarget ? (
                <aside className="w-[420px] bg-background border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                    <div className="flex items-center gap-3">
                      {pickingTarget ? (
                        <>
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-zinc-700 text-white">
                            <Link className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest">Pick Target Node</h3>
                            <p className="text-[10px] text-muted-foreground">Select a node to connect to</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", NODE_TYPES_META[selectedNode!.type as AutomationNodeType].color)}>
                            {React.createElement(NODE_TYPES_META[selectedNode!.type as AutomationNodeType].icon, { className: 'h-4 w-4' })}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest">{NODE_TYPES_META[selectedNode!.type as AutomationNodeType].label}</h3>
                            <p className="text-[10px] text-muted-foreground">ID: {selectedNode!.id.substring(0, 8)}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setSelectedNodeId(null); setPickingTarget(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    {pickingTarget ? (
                      <div className="p-4">
                        <Command className="border rounded-md shadow-sm">
                          <CommandInput placeholder="Search existing nodes..." />
                          <CommandList>
                            <CommandEmpty>No nodes found.</CommandEmpty>
                            <CommandGroup heading="Nodes on Map">
                              {nodes.filter(n => n.id !== pickingTarget.sourceId).map(n => {
                                const meta = NODE_TYPES_META[n.type as AutomationNodeType];
                                return (
                                  <CommandItem key={n.id} onSelect={() => handlePickTargetNode(n.id)} className="gap-3 p-3 cursor-pointer">
                                    <div className={cn("h-6 w-6 rounded flex items-center justify-center text-white shrink-0", meta.color)}>
                                      {React.createElement(meta.icon, { className: 'h-3 w-3' })}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-bold truncate">{n.data.text || n.data.prompt || n.data.name || meta.label}</span>
                                      <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        <Button variant="ghost" className="w-full mt-4" onClick={() => setPickingTarget(null)}>Cancel</Button>
                      </div>
                    ) : selectedNode && (
                      <div className="p-6 space-y-8 pb-32">
                        {selectedNode.type === 'message' && (
                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">Bot Message</Label>
                            <Textarea 
                              value={selectedNode.data.text || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                              placeholder="Bot: Hi there!"
                              rows={10}
                              className="bg-muted/30 border-2 font-medium"
                            />
                          </div>
                        )}

                        {selectedNode.type === 'intent_router' && (
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Classification Question</Label>
                              <Input 
                                value={selectedNode.data.text || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                placeholder="e.g. How can we help today?"
                                className="border-2"
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase text-indigo-500">Intents (AI Classification)</Label>
                                <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-bold" onClick={() => {
                                  const newIntents = [...(selectedNode.data.intents || []), { id: `intent_${Date.now()}`, label: 'New Intent' }];
                                  updateNodeData(selectedNode.id, { intents: newIntents });
                                }}><Plus className="h-3 w-3 mr-1" /> Add Intent</Button>
                              </div>
                              <div className="space-y-2">
                                {(selectedNode.data.intents || []).map((intent: any, idx: number) => (
                                  <div key={intent.id} className="flex items-center gap-2 p-2 border-2 rounded-xl bg-background group">
                                    <Navigation className="h-3 w-3 text-muted-foreground opacity-40 shrink-0" />
                                    <Input 
                                      value={intent.label} 
                                      onChange={(e) => {
                                        const newIntents = [...selectedNode.data.intents];
                                        newIntents[idx].label = e.target.value;
                                        updateNodeData(selectedNode.id, { intents: newIntents });
                                      }}
                                      className="h-7 text-xs border-none shadow-none focus-visible:ring-0 font-bold p-0"
                                    />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => {
                                      updateNodeData(selectedNode.id, { intents: selectedNode.data.intents.filter((i: any) => i.id !== intent.id) });
                                    }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedNode.type === 'quick_reply' && (
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Prompt Text</Label>
                              <Input 
                                value={selectedNode.data.text || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                placeholder="e.g. Choose an option:"
                                className="border-2"
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase text-purple-500">Buttons</Label>
                                <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-bold" onClick={() => {
                                  const newButtons = [...(selectedNode.data.buttons || []), { id: `btn_${Date.now()}`, label: 'New Button' }];
                                  updateNodeData(selectedNode.id, { buttons: newButtons });
                                }}><Plus className="h-3 w-3 mr-1" /> Add Button</Button>
                              </div>
                              <div className="space-y-2">
                                {(selectedNode.data.buttons || []).map((btn: any, idx: number) => (
                                  <div key={btn.id} className="flex items-center gap-2 p-2 border-2 rounded-xl bg-background group">
                                    <MousePointerClick className="h-3 w-3 text-muted-foreground opacity-40 shrink-0" />
                                    <Input 
                                      value={btn.label} 
                                      onChange={(e) => {
                                        const newButtons = [...selectedNode.data.buttons];
                                        newButtons[idx].label = e.target.value;
                                        updateNodeData(selectedNode.id, { buttons: newButtons });
                                      }}
                                      className="h-7 text-xs border-none shadow-none focus-visible:ring-0 font-bold p-0"
                                    />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => {
                                      updateNodeData(selectedNode.id, { buttons: selectedNode.data.buttons.filter((b: any) => b.id !== btn.id) });
                                    }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedNode.type === 'capture_input' && (
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Question Prompt</Label>
                              <Input 
                                value={selectedNode.data.prompt || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                placeholder="e.g. What is your email address?"
                                className="border-2"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-teal-600">Save As Variable</Label>
                              <div className="flex items-center gap-3 p-3 border-2 rounded-xl bg-teal-500/5 border-teal-500/20">
                                <Database className="h-4 w-4 text-teal-600" />
                                <Input 
                                  value={selectedNode.data.variableName || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { variableName: e.target.value })}
                                  placeholder="e.g. visitor_email"
                                  className="h-7 text-xs border-none shadow-none focus-visible:ring-0 font-mono text-teal-700 bg-transparent p-0"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedNode.type === 'ai_step' && (
                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">AI Behavior / Instructions</Label>
                            <Textarea 
                              value={selectedNode.data.prompt || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                              placeholder="e.g. Act as a technical support agent. Use the knowledge base to answer questions."
                              rows={10}
                              className="bg-muted/30 border-2 font-medium"
                            />
                          </div>
                        )}

                        {selectedNode.type === 'condition' && (
                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">Check Property</Label>
                            <Select 
                              value={selectedNode.data.conditionField} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { conditionField: val })}
                            >
                              <SelectTrigger className="h-11 border-2 rounded-xl"><SelectValue placeholder="Select property..." /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="email">Visitor Email</SelectItem>
                                <SelectItem value="name">Visitor Name</SelectItem>
                                <SelectItem value="identified">Secure Identity Token</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {selectedNode.type === 'handoff' && (
                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">Transfer Message</Label>
                            <Textarea 
                              value={selectedNode.data.text || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                              placeholder="e.g. Connecting you to our team. Someone will be with you shortly."
                              className="bg-muted/30 border-2 font-medium"
                              rows={6}
                            />
                          </div>
                        )}

                        {selectedNode.type === 'end' && (
                          <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">Wait Behavior</Label>
                            <p className="text-xs text-muted-foreground">The bot will pause here and resume the flow when the visitor sends their next message.</p>
                          </div>
                        )}

                        <Separator />
                        
                        <div className="space-y-4">
                          <Label className="text-xs font-bold uppercase text-destructive">Advanced Actions</Label>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-destructive border-destructive/20 hover:bg-destructive/5" 
                            onClick={() => deleteNode(selectedNode!.id)}
                            disabled={selectedNode!.id === 'start'}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete This Step
                          </Button>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </aside>
              ) : null}
            </>
          ) : (
            <PreviewArea nodes={nodes} edges={edges} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewArea({ nodes, edges }: { nodes: any[], edges: any[] }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [userInput, setUserInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleStep = useCallback(async (nodeId: string | null, handleId?: string) => {
    if (!nodeId) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);

    if (node.type === 'message' || node.type === 'start') {
      if (node.data.text) {
        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text, type: 'automation' }]);
      }
      const nextEdge = edges.find(e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'next'));
      if (nextEdge) setTimeout(() => handleStep(nextEdge.target), 800);
    } else if (node.type === 'quick_reply' || node.type === 'intent_router') {
      const intents = node.data.intents || [];
      const buttons = node.type === 'quick_reply' ? node.data.buttons : intents;
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || node.data.prompt || 'How can I help?', type: 'automation', buttons }]);
    } else if (node.type === 'capture_input') {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt, type: 'automation' }]);
    } else if (node.type === 'handoff') {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || 'Transferring...', type: 'automation' }]);
      setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: 'Escalated to human' }]);
    } else if (node.type === 'ai_step') {
      setIsThinking(true);
      setTimeout(() => {
        setIsThinking(false);
        const resolved = Math.random() > 0.4;
        if (resolved) {
          setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: "I've resolved your request using our knowledge base!", type: 'ai' }]);
          const nextEdge = edges.find(e => e.source === nodeId && e.sourceHandle === 'resolved');
          if (nextEdge) handleStep(nextEdge.target);
        } else {
          const nextEdge = edges.find(e => e.source === nodeId && e.sourceHandle === 'unresolved');
          if (nextEdge) handleStep(nextEdge.target);
        }
      }, 1500);
    } else if (node.type === 'condition') {
        const met = Math.random() > 0.5;
        const targetHandle = met ? 'true' : 'false';
        const nextEdge = edges.find(e => e.source === nodeId && e.sourceHandle === targetHandle);
        if (nextEdge) handleStep(nextEdge.target);
    } else if (node.type === 'end') {
        // Wait node, stop simulation
    }
  }, [nodes, edges]);

  useEffect(() => {
    setMessages([]);
    handleStep('start');
  }, [handleStep]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleInput = (text: string, buttonId?: string) => {
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);
    const currentEdge = edges.find(e => {
      if (e.source !== currentNodeId) return false;
      if (buttonId) return e.sourceHandle === `intent:${buttonId}`;
      return e.sourceHandle === 'next' || !e.sourceHandle;
    });
    if (currentEdge) handleStep(currentEdge.target);
    setUserInput('');
  };

  const handleReset = () => {
    setMessages([]);
    handleStep('start');
  };

  return (
    <div className="flex-1 bg-muted/30 flex flex-col items-center justify-center p-8">
      <div className="w-[450px] h-[750px] bg-background rounded-[3rem] shadow-2xl border-8 border-muted flex flex-col overflow-hidden relative">
        <div className="p-4 border-b bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Conversation Preview</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
        </div>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-6 space-y-6">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                {m.role === 'system' ? (
                  <Badge variant="outline" className="self-center bg-muted/50 uppercase text-[9px] font-black">{m.text}</Badge>
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
                {m.buttons && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.buttons.map((btn: any) => (
                      <Button 
                        key={btn.id} 
                        variant="outline" 
                        size="sm" 
                        className="rounded-full h-8 text-xs font-semibold"
                        onClick={() => handleInput(btn.label, btn.id)}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 bg-muted p-3 rounded-2xl rounded-bl-none w-fit">
                <Bot className="h-4 w-4 animate-pulse" />
                <span className="text-xs italic">Thinking...</span>
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
              onKeyDown={(e) => e.key === 'Enter' && handleInput(userInput)}
            />
            <Button size="icon" className="absolute right-1 top-1 h-9 w-9 rounded-full" onClick={() => handleInput(userInput)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AutomationFlowBuilder(props: AutomationFlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
