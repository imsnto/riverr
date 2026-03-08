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
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  type NodeProps,
  type Connection,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  AutomationFlow,
  AutomationNode,
  AutomationEdge,
  AutomationNodeType,
  User,
  Bot as BotData,
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
  ArrowLeft,
  Clock,
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  MessageCircle,
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
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatbotSimulator from './chatbot-simulator';

const NODE_TYPES_META: Record<AutomationNodeType, { label: string; icon: any; color: string; description: string; category: 'conversation' | 'ai' | 'logic' | 'human' }> = {
  start: { label: 'Start', icon: PlayCircle, color: 'bg-emerald-500', description: 'Triggered when a new chat begins.', category: 'conversation' },
  message: { label: 'Send Message', icon: MessageSquare, color: 'bg-blue-500', description: 'Sends a static text message to the visitor.', category: 'conversation' },
  quick_reply: { label: 'Quick Replies', icon: MousePointerClick, color: 'bg-purple-500', description: 'Offers buttons for the visitor to click.', category: 'conversation' },
  ai_classifier: { label: 'AI Classifier', icon: Navigation, color: 'bg-indigo-600', description: 'Classifies what the visitor is asking and routes the conversation.', category: 'ai' },
  capture_input: { label: 'Capture Input', icon: Database, color: 'bg-teal-500', description: 'Asks a question and saves the response.', category: 'conversation' },
  identity_form: { label: 'Identity Form', icon: UserPlus, color: 'bg-teal-600', description: 'Shows an inline form for Name and Email capture.', category: 'conversation' },
  ai_step: { label: 'AI Reasoning', icon: Bot, color: 'bg-violet-500', description: 'Conversational reasoning with knowledge base.', category: 'ai' },
  condition: { label: 'Condition', icon: Split, color: 'bg-amber-500', description: 'Branch based on data or identified state.', category: 'logic' },
  handoff: { label: 'Human Handoff', icon: UserCheck, color: 'bg-orange-500', description: 'Transfers the chat to a team member.', category: 'human' },
  end: { label: 'Wait for Visitor', icon: CircleStop, color: 'bg-gray-500', description: 'Pauses the flow until the visitor replies.', category: 'human' },
};

const CustomNodeComponent = ({ type, data, selected, id }: NodeProps) => {
  const { getEdges, getNodes } = useReactFlow();
  const edges = getEdges();
  const nodes = getNodes();
  const meta = NODE_TYPES_META[type as AutomationNodeType];
  
  if (!meta) return null;
  
  const Icon = meta.icon;

  const isHandleConnected = (handleId: string) => 
    edges.some(e => e.source === id && e.sourceHandle === handleId);

  const hasIdentityInPath = useMemo(() => {
    if (type !== 'handoff') return true;
    
    const checkPredecessors = (nodeId: string, visited = new Set<string>()): boolean => {
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const incomingEdges = edges.filter(e => e.target === nodeId);
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) continue;
            
            if (sourceNode.type === 'identity_form') return true;
            if (sourceNode.type === 'capture_input' && sourceNode.data.inputType === 'email') return true;
            
            if (checkPredecessors(sourceNode.id, visited)) return true;
        }
        return false;
    };

    return checkPredecessors(id);
  }, [type, id, edges, nodes]);

  const AddStepButton = ({ handleId, label }: { handleId: string, label?: string }) => {
    const connected = isHandleConnected(handleId);
    if (connected) return null;

    return (
      <div 
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button 
          className="h-7 w-7 rounded-full bg-background shadow-lg hover:bg-primary hover:text-primary-foreground border-2 border-primary/20 p-0 flex items-center justify-center transition-all"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenNodePicker?.(id, handleId);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
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

        {type === 'handoff' && !hasIdentityInPath && (
            <div className="mt-2 flex items-center gap-2 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-500 font-bold">
                <AlertCircle className="h-3 w-3" />
                REQUIRES ID CAPTURE
            </div>
        )}

        {type === 'capture_input' && data.variableName && (
          <div className="mt-2 p-1.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded text-[10px] font-mono text-teal-700 dark:text-teal-400 flex items-center justify-between">
            <span>{data.inputType?.toUpperCase() || 'TEXT'}: {data.variableName}</span>
            {data.saveToProfile && <Users className="h-2.5 w-2.5 opacity-50" />}
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
          ) : type === 'ai_classifier' || type === 'quick_reply' ? (
            <div className="flex gap-2">
              {(type === 'ai_classifier' ? (data.intents || []) : (data.buttons || [])).map((btn: any) => (
                <div key={btn.id} className="relative pointer-events-auto">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 px-1.5 whitespace-nowrap">
                    {btn.label}
                  </Badge>
                  <Handle type="source" position={Position.Bottom} id={`intent:${btn.id}`} className="w-2.5 h-2.5 bg-primary border-2 border-background" />
                  <AddStepButton handleId={`intent:${btn.id}`} label={btn.label} />
                </div>
              ))}
              <div className="relative pointer-events-auto">
                <Badge variant="outline" className="bg-muted text-muted-foreground text-[8px] h-5 px-1.5 uppercase font-bold">Fallback</Badge>
                <Handle type="source" position={Position.Bottom} id="fallback" className="w-2.5 h-2.5 bg-zinc-400 border-2 border-background" />
                <AddStepButton handleId="fallback" label="Fallback" />
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
  ai_classifier: CustomNodeComponent,
  capture_input: CustomNodeComponent,
  identity_form: CustomNodeComponent,
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
  aiEnabled?: boolean;
  botData?: Partial<BotData>;
  allUsers?: User[];
}

function FlowBuilderInner({ isOpen, onOpenChange, flow: initialFlow, onSave, aiEnabled = true, botData = {}, allUsers = [] }: AutomationFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [nodePickerInfo, setNodePickerInfo] = useState<{ sourceId: string, sourceHandle: string } | null>(null);
  const [isPickingExisting, setIsPickingExisting] = useState(false);
  
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
            type === 'capture_input' ? { prompt: 'What is your email?', variableName: 'email', inputType: 'email', saveToProfile: true } :
            type === 'identity_form' ? { prompt: 'Before we start, could we get your details?', variableName: 'identity' } :
            type === 'ai_classifier' ? { text: '', intents: [{ id: `i_${Date.now()}`, label: 'Support', description: 'Help needed' }] } :
            type === 'quick_reply' ? { text: '', buttons: [{ id: `b_${Date.now()}`, label: 'Pricing' }] } :
            type === 'condition' ? { conditionField: 'email', operator: 'exists' } :
            type === 'handoff' ? { text: 'Connecting you to an agent...', teamId: 'support', priority: 'medium' } :
            type === 'ai_step' ? { knowledgeSources: ['default'], fallbackBehavior: 'escalate' } :
            type === 'end' ? { waitBehavior: 'pause' } :
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
    setNodePickerInfo(null);
  }, [getNode, setNodes, setEdges]);

  const onPickExisting = useCallback((targetId: string) => {
    if (!nodePickerInfo) return;
    
    const newEdge = {
      id: `e_${nodePickerInfo.sourceId}_${targetId}`,
      source: nodePickerInfo.sourceId,
      target: targetId,
      sourceHandle: nodePickerInfo.sourceHandle,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      style: { strokeWidth: 2, stroke: '#3b82f6' }
    };

    setEdges((eds) => addEdge(newEdge, eds));
    setNodePickerInfo(null);
    setIsPickingExisting(false);
  }, [nodePickerInfo, setEdges]);

  const nodesWithActions = useMemo(() => 
    nodes.map(n => ({
      ...n,
      data: { 
        ...n.data, 
        onDelete: deleteNode,
        onAddNodeAndConnect: onAddNodeAndConnect,
        onOpenNodePicker: (sourceId: string, sourceHandle: string) => {
            setNodePickerInfo({ sourceId, sourceHandle });
            setIsPickingExisting(false);
        }
      }
    })), [nodes, deleteNode, onAddNodeAndConnect]
  );

  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      let finalNodes = initialFlow?.nodes ? [...initialFlow.nodes] : [];
      let finalEdges = initialFlow?.edges ? [...initialFlow.edges] : [];

      // Logic: If the flow is empty, initialize with a functional standard starter template
      if (finalNodes.length === 0) {
        const startId = 'start';
        const greetingId = 'greeting';
        const classifierId = 'classifier';
        const supportAiId = 'support_ai';
        const salesIdId = 'sales_identity';
        const handoffId = 'human_handoff';

        const starterNodes = [
          {
            id: startId,
            type: 'start',
            position: { x: 300, y: 50 },
            data: { label: 'Start' }
          },
          {
            id: greetingId,
            type: 'message',
            position: { x: 300, y: 200 },
            data: { text: botData.welcomeMessage || 'Hi! Welcome to our workspace. How can I help you today?' }
          },
          {
            id: classifierId,
            type: 'ai_classifier',
            position: { x: 300, y: 400 },
            data: { 
              text: '', // Classifier is silent logic, it waits for the reply to the message above
              intents: [
                { id: 'support', label: 'Support', description: 'Technical issues, product questions, or documentation' },
                { id: 'sales', label: 'Sales', description: 'Pricing, demos, or partnership requests' }
              ]
            }
          },
          {
            id: supportAiId,
            type: 'ai_step',
            position: { x: 50, y: 650 },
            data: { prompt: 'Help the user with their support query using the knowledge base.' }
          },
          {
            id: salesIdId,
            type: 'identity_form',
            position: { x: 550, y: 650 },
            data: { prompt: 'I would love to help you with that! Could you please share your name and email first?' }
          },
          {
            id: handoffId,
            type: 'handoff',
            position: { x: 300, y: 950 },
            data: { text: 'I am connecting you to one of our team members now.' }
          }
        ];

        const starterEdges = [
          { id: 'e1', source: startId, target: greetingId, sourceHandle: 'next', type: 'smoothstep', animated: true },
          { id: 'e2', source: greetingId, target: classifierId, sourceHandle: 'next', type: 'smoothstep', animated: true },
          { id: 'e3', source: classifierId, target: supportAiId, sourceHandle: 'intent:support', type: 'smoothstep', animated: true },
          { id: 'e4', source: classifierId, target: salesIdId, sourceHandle: 'intent:sales', type: 'smoothstep', animated: true },
          { id: 'e5', source: classifierId, target: handoffId, sourceHandle: 'fallback', type: 'smoothstep', animated: true },
          { id: 'e6', source: supportAiId, target: handoffId, sourceHandle: 'unresolved', type: 'smoothstep', animated: true },
          { id: 'e7', source: salesIdId, target: handoffId, sourceHandle: 'next', type: 'smoothstep', animated: true }
        ];

        finalNodes = starterNodes;
        finalEdges = starterEdges;
      }

      setNodes(finalNodes.map(n => ({ 
        ...n, 
        id: n.id, 
        data: { ...n.data }, 
        position: n.position || { x: 0, y: 0 } 
      })));
      setEdges(finalEdges);
      
      initializedRef.current = true;
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
    }
    
    if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen, initialFlow, setNodes, setEdges, fitView, botData.welcomeMessage]);

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
          <div className="flex flex-row items-center gap-4 space-y-0 pl-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">Automation Flow</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Visual Logic Map</DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 pr-2">
            <Button 
                type="button" 
                variant={isPreviewOpen ? "secondary" : "outline"} 
                size="sm" 
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className="rounded-full bg-white/5 border-white/10 h-9 px-4 text-xs font-bold gap-2"
            >
                <Eye className="h-3.5 w-3.5" />
                {isPreviewOpen ? "Hide Preview" : "Preview Flow"}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="rounded-full px-6">Save Changes</Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
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

          {(selectedNodeId && selectedNode) ? (
            <aside className="w-[420px] bg-background border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", (NODE_TYPES_META[selectedNode!.type as AutomationNodeType] || NODE_TYPES_META.start).color)}>
                    {React.createElement((NODE_TYPES_META[selectedNode!.type as AutomationNodeType] || NODE_TYPES_META.start).icon, { className: 'h-4 w-4' })}
                    </div>
                    <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest">{(NODE_TYPES_META[selectedNode!.type as AutomationNodeType] || NODE_TYPES_META.start).label}</h3>
                    <p className="text-[10px] text-muted-foreground">ID: {selectedNode!.id.substring(0, 8)}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedNodeId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8 pb-32">
                {(selectedNode.type === 'message' || selectedNode.type === 'capture_input' || selectedNode.type === 'identity_form' || selectedNode.type === 'handoff') && (
                    <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase">
                        {selectedNode.type === 'message' || selectedNode.type === 'handoff' ? 'Bot Message' : 'Prompt'}
                    </Label>
                    <Textarea 
                        value={selectedNode.data.text || selectedNode.data.prompt || ''} 
                        onChange={(e) => updateNodeData(selectedNode.id, (selectedNode.type === 'message' || selectedNode.type === 'handoff') ? { text: e.target.value } : { prompt: e.target.value })}
                        placeholder={selectedNode.type === 'message' ? "Bot: Hi there!" : "How can I help?"}
                        rows={6}
                        className="bg-muted/30 border-2 font-medium"
                    />
                    </div>
                )}

                {selectedNode.type === 'ai_classifier' && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-xs font-bold uppercase">Intro Text (Optional)</Label>
                            <Input 
                                value={selectedNode.data.text || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                placeholder="Leave empty for silent background routing"
                                className="bg-muted/30 border-2"
                            />
                            <p className="text-[10px] text-muted-foreground">If left empty, the bot will silently wait for the visitor to reply to the previous message before routing.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase">Intent Paths</Label>
                                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                                    const newIntents = [...(selectedNode.data.intents || []), { id: `i_${Date.now()}`, label: 'New Intent', description: '' }];
                                    updateNodeData(selectedNode.id, { intents: newIntents });
                                }}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Path
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {(selectedNode.data.intents || []).map((intent: any, idx: number) => (
                                    <div key={intent.id} className="p-3 rounded-lg border bg-muted/20 space-y-2 relative group/intent">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 absolute -top-2 -right-2 opacity-0 group-hover/intent:opacity-100 transition-opacity" onClick={() => {
                                            const newIntents = selectedNode.data.intents.filter((_: any, i: number) => i !== idx);
                                            updateNodeData(selectedNode.id, { intents: newIntents });
                                        }}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                        <Input 
                                            value={intent.label} 
                                            onChange={(e) => {
                                                const newIntents = [...selectedNode.data.intents];
                                                newIntents[idx].label = e.target.value;
                                                updateNodeData(selectedNode.id, { intents: newIntents });
                                            }}
                                            placeholder="Label (e.g. Sales)"
                                            className="h-8 text-xs font-bold"
                                        />
                                        <Textarea 
                                            value={intent.description} 
                                            onChange={(e) => {
                                                const newIntents = [...selectedNode.data.intents];
                                                newIntents[idx].description = e.target.value;
                                                updateNodeData(selectedNode.id, { intents: newIntents });
                                            }}
                                            placeholder="Description for AI..."
                                            className="text-[10px] h-12 min-h-0 bg-transparent"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                </div>
              </ScrollArea>
            </aside>
          ) : null}

          <Sheet open={!!nodePickerInfo} onOpenChange={(open) => !open && setNodePickerInfo(null)}>
            <SheetContent side="right" className="w-[440px] p-0 flex flex-col sm:max-w-[440px]">
                <SheetHeader className="p-6 pb-4 border-b shrink-0 text-left">
                    <SheetTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Add Step to Path</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-8">
                        {!isPickingExisting ? (
                            <>
                                {[
                                    { key: 'conversation', label: 'Conversation' },
                                    { key: 'ai', label: 'Intelligence', hidden: !aiEnabled },
                                    { key: 'logic', label: 'Logic' },
                                    { key: 'human', label: 'Human' }
                                ].filter(c => !c.hidden).map(cat => (
                                    <div key={cat.key} className="space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1 opacity-60">{cat.label}</p>
                                        <div className="grid gap-2">
                                            {Object.entries(NODE_TYPES_META)
                                                .filter(([t, m]) => t !== 'start' && m.category === cat.key)
                                                .map(([t, m]) => (
                                                    <button 
                                                        key={t}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (nodePickerInfo) {
                                                                onAddNodeAndConnect(t as AutomationNodeType, nodePickerInfo.sourceId, nodePickerInfo.sourceHandle);
                                                            }
                                                        }} 
                                                        className="flex items-center gap-4 w-full p-3 hover:bg-accent rounded-xl transition-all border border-transparent hover:border-border group"
                                                    >
                                                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md", m.color)}>
                                                            {React.createElement(m.icon, { className: 'h-5 w-5' })}
                                                        </div>
                                                        <div className="flex flex-col text-left overflow-hidden">
                                                            <span className="text-sm font-bold group-hover:text-primary transition-colors">{m.label}</span>
                                                            <span className="text-[11px] text-muted-foreground line-clamp-1">{m.description}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                                <Separator className="my-2" />
                                <button onClick={() => setIsPickingExisting(true)} className="flex items-center gap-4 w-full p-4 bg-muted/30 hover:bg-muted rounded-2xl transition-all border-2 border-dashed border-border group">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-background text-foreground shrink-0 border shadow-sm"><Link className="h-5 w-5" /></div>
                                    <div className="flex flex-col text-left"><span className="text-sm font-bold">Connect Existing Step...</span><span className="text-[11px] text-muted-foreground">Link this path to a node already on the map.</span></div>
                                </button>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Button variant="ghost" size="sm" onClick={() => setIsPickingExisting(false)} className="-ml-2 h-8"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                                    <span className="text-xs font-bold uppercase tracking-widest">Select Target</span>
                                </div>
                                <Command className="border rounded-xl shadow-sm">
                                    <CommandInput placeholder="Search existing steps..." />
                                    <CommandList>
                                        <CommandEmpty>No steps found.</CommandEmpty>
                                        <CommandGroup heading="Nodes on Canvas">
                                            {nodes.filter(n => n.id !== nodePickerInfo?.sourceId).map(n => {
                                                const m = NODE_TYPES_META[n.type as AutomationNodeType] || NODE_TYPES_META.start;
                                                return (
                                                    <CommandItem key={n.id} onSelect={() => onPickExisting(n.id)} className="gap-4 p-3 cursor-pointer">
                                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0", m.color)}>{React.createElement(m.icon, { className: 'h-4 w-4' })}</div>
                                                        <div className="flex flex-col min-w-0"><span className="text-sm font-bold truncate">{n.data.text || n.data.prompt || n.data.name || m.label}</span><span className="text-[10px] text-muted-foreground uppercase">{m.label}</span></div>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
          </Sheet>

          <ChatbotSimulator 
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            botData={botData}
            flow={{ 
                nodes: nodes.map(n => ({ id: n.id, type: n.type as AutomationNodeType, data: n.data, position: n.position })),
                edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })) as AutomationEdge[]
            }}
            agents={allUsers.filter(u => botData.agentIds?.includes(u.id))}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AutomationFlowBuilder(props: AutomationFlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}