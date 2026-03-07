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
  const Icon = meta.icon;

  const isHandleConnected = (handleId: string) => 
    edges.some(e => e.source === id && e.sourceHandle === handleId);

  // Simple heuristic: check if path to this handoff contains an email capture
  const hasIdentityInPath = useMemo(() => {
    if (type !== 'handoff') return true;
    
    const checkPredecessors = (nodeId: string, visited = new Set<string>()): boolean => {
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const incomingEdges = edges.filter(e => e.target === nodeId);
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) continue;
            
            // Success if we hit an identity node or email capture
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
}

function FlowBuilderInner({ isOpen, onOpenChange, flow: initialFlow, onSave, aiEnabled = true }: AutomationFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');
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
            type === 'ai_classifier' ? { text: 'Classify response', intents: [{ id: `i_${Date.now()}`, label: 'Support', description: 'Help needed' }] } :
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
      if (!initialFlow.nodes || initialFlow.nodes.length === 0) {
        let defaultNodes: any[] = [];
        let defaultEdges: any[] = [];

        if (aiEnabled) {
          // AI DRIVEN DEFAULT FLOW
          defaultNodes = [
            { id: 'start', type: 'start', position: { x: 120, y: 40 }, data: {} },
            { id: 'greeting', type: 'message', position: { x: 120, y: 180 }, data: { text: 'Hi! Welcome to our site. How can we help you today?' } },
            { id: 'wait_input', type: 'end', position: { x: 120, y: 320 }, data: { waitBehavior: 'pause' } },
            { id: 'router', type: 'ai_classifier', position: { x: 420, y: 320 }, data: { 
                text: 'Analyze the visitor’s message and classify it into one of the following intents.', 
                intents: [
                  { id: 'i1', label: 'Support', description: 'Visitor needs technical help or reports a bug' },
                  { id: 'i2', label: 'Pricing', description: 'Visitor asks about costs, plans, or billing' },
                  { id: 'i3', label: 'Features', description: 'Visitor wants to know what the product does' },
                  { id: 'i4', label: 'Human', description: 'Visitor explicitly asks to speak to a person' }
                ] 
            }},
            { id: 'ai', type: 'ai_step', position: { x: 820, y: 180 }, data: { knowledgeSources: ['default'], fallbackBehavior: 'escalate' } },
            { id: 'pricing_msg', type: 'message', position: { x: 820, y: 360 }, data: { text: "We'd be happy to help with pricing and plans.\n\nTell us what you're looking for, or ask to speak with sales." } },
            { id: 'identity_form', type: 'identity_form', position: { x: 1180, y: 360 }, data: { prompt: 'Before I connect you to someone, could I get your name and email?', variableName: 'identity' } },
            { id: 'handoff', type: 'handoff', position: { x: 1540, y: 360 }, data: { text: 'Thanks! I\'m connecting you with someone from our team now.', teamId: 'support', priority: 'high' } },
            { id: 'terminal_wait', type: 'end', position: { x: 1900, y: 360 }, data: { waitBehavior: 'pause' } }
          ];

          defaultEdges = [
            { id: 'e1', source: 'start', target: 'greeting', sourceHandle: 'next', type: 'smoothstep' },
            { id: 'e2', source: 'greeting', target: 'wait_input', sourceHandle: 'next', type: 'smoothstep' },
            { id: 'e3', source: 'wait_input', target: 'router', sourceHandle: 'next', type: 'smoothstep' },
            { id: 'e4', source: 'router', target: 'ai', sourceHandle: 'intent:i1', type: 'smoothstep' },
            { id: 'e5', source: 'router', target: 'pricing_msg', sourceHandle: 'intent:i2', type: 'smoothstep' },
            { id: 'e6', source: 'router', target: 'ai', sourceHandle: 'intent:i3', type: 'smoothstep' },
            { id: 'e7', source: 'router', target: 'identity_form', sourceHandle: 'intent:i4', type: 'smoothstep' },
            { id: 'e8', source: 'router', target: 'ai', sourceHandle: 'fallback', type: 'smoothstep' },
            { id: 'e9', source: 'ai', target: 'terminal_wait', sourceHandle: 'resolved', type: 'smoothstep' },
            { id: 'e10', source: 'ai', target: 'identity_form', sourceHandle: 'unresolved', type: 'smoothstep' },
            { id: 'e11', source: 'pricing_msg', target: 'wait_input', sourceHandle: 'next', type: 'smoothstep' },
            { id: 'e12', source: 'identity_form', target: 'handoff', sourceHandle: 'next', type: 'smoothstep' },
            { id: 'e13', source: 'handoff', target: 'terminal_wait', sourceHandle: 'next', type: 'smoothstep' }
          ];
        } else {
          // DETERMINISTIC DEFAULT FLOW (ENFORCING ID CAPTURE)
          defaultNodes = [
            { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'greeting', type: 'message', position: { x: 0, y: 150 }, data: { text: 'Hi there! 👋\nHow can we help you today?' } },
            { id: 'main_menu', type: 'quick_reply', position: { x: 0, y: 350 }, data: { 
                text: '', 
                buttons: [
                  { id: 'b_support', label: 'Technical Support' },
                  { id: 'b_sales', label: 'Talk to Sales' },
                  { id: 'b_billing', label: 'Billing / Pricing' },
                  { id: 'b_other', label: 'Something Else' }
                ] 
            }},
            
            // Support Branch
            { id: 'support_menu', type: 'quick_reply', position: { x: -600, y: 550 }, data: { 
                text: 'What kind of technical issue are you having?',
                buttons: [
                  { id: 's_login', label: 'Login Issue' },
                  { id: 's_bug', label: 'Bug Report' },
                  { id: 's_account', label: 'Account Access' },
                  { id: 's_other', label: 'Other Issue' }
                ]
            }},
            { id: 'support_login_msg', type: 'message', position: { x: -800, y: 750 }, data: { text: 'Try resetting your password using the link below.\n\n[Reset Password Link]' } },
            { id: 'support_res_check', type: 'quick_reply', position: { x: -800, y: 950 }, data: { 
                text: 'Did that fix the issue?',
                buttons: [
                  { id: 'res_yes', label: 'Yes' },
                  { id: 'res_no', label: 'Still need help' }
                ]
            }},

            // Sales Branch
            { id: 'sales_greet', type: 'message', position: { x: -200, y: 550 }, data: { text: "Great! We'd love to help with that." } },
            { id: 'sales_interest', type: 'quick_reply', position: { x: -200, y: 750 }, data: { 
                text: 'What would you like to discuss?',
                buttons: [
                  { id: 'sl_demo', label: 'Product Demo' },
                  { id: 'sl_pricing', label: 'Pricing Information' },
                  { id: 'sl_custom', label: 'Custom Solution' }
                ]
            }},

            // Billing Branch
            { id: 'billing_menu', type: 'quick_reply', position: { x: 200, y: 550 }, data: { 
                text: 'How can we help with billing?',
                buttons: [
                  { id: 'bl_plans', label: 'View Pricing Plans' },
                  { id: 'bl_payment', label: 'Update Payment Method' },
                  { id: 'bl_cancel', label: 'Cancel Subscription' },
                  { id: 'bl_other', label: 'Other Billing Question' }
                ]
            }},
            { id: 'billing_price_msg', type: 'message', position: { x: 200, y: 750 }, data: { text: 'Here are our pricing plans.\n\n[Link to Pricing]' } },
            { id: 'billing_res_check', type: 'quick_reply', position: { x: 200, y: 950 }, data: { 
                text: 'Did this answer your question?',
                buttons: [
                  { id: 'bl_res_yes', label: 'Yes' },
                  { id: 'bl_res_no', label: 'Still need help' }
                ]
            }},

            // Other Branch
            { id: 'other_capture_msg', type: 'capture_input', position: { x: 600, y: 550 }, data: { prompt: 'Could you briefly describe what you need help with?', variableName: 'visitor_message', inputType: 'text' } },

            // SHARED MANDATORY ID CAPTURE BRIDGE (IDENTITY FORM)
            { id: 'identity_form', type: 'identity_form', position: { x: 0, y: 1300 }, data: { prompt: 'Before I connect you to someone, could I get your name and email?', variableName: 'identity' } },
            
            // Handoff Sequence
            { id: 'handoff_msg', type: 'message', position: { x: 0, y: 1500 }, data: { text: "Thanks! I'm connecting you with someone from our team now." } },
            { id: 'shared_handoff', type: 'handoff', position: { x: 0, y: 1700 }, data: { text: 'Connecting you now...', teamId: 'support' } },

            // Resolved End
            { id: 'resolved_msg', type: 'message', position: { x: -400, y: 1200 }, data: { text: 'Glad we could help! 👍\n\nIf you need anything else, just send another message.' } },
            
            // Final Wait
            { id: 'terminal_wait', type: 'end', position: { x: 0, y: 1900 }, data: { waitBehavior: 'pause' } }
          ];

          defaultEdges = [
            { id: 'e_start', source: 'start', target: 'greeting', sourceHandle: 'next' },
            { id: 'e_greet', source: 'greeting', target: 'main_menu', sourceHandle: 'next' },
            
            // Main menu connections
            { id: 'e_m_support', source: 'main_menu', target: 'support_menu', sourceHandle: 'intent:b_support' },
            { id: 'e_m_sales', source: 'main_menu', target: 'sales_greet', sourceHandle: 'intent:b_sales' },
            { id: 'e_m_billing', source: 'main_menu', target: 'billing_menu', sourceHandle: 'intent:b_billing' },
            { id: 'e_m_other', source: 'main_menu', target: 'other_capture_msg', sourceHandle: 'intent:b_other' },
            { id: 'e_m_fallback', source: 'main_menu', target: 'other_capture_msg', sourceHandle: 'fallback' },

            // Support path
            { id: 'e_s_login', source: 'support_menu', target: 'support_login_msg', sourceHandle: 'intent:s_login' },
            { id: 'e_s_bug', source: 'support_menu', target: 'identity_form', sourceHandle: 'intent:s_bug' },
            { id: 'e_s_acc', source: 'support_menu', target: 'identity_form', sourceHandle: 'intent:s_account' },
            { id: 'e_s_other', source: 'support_menu', target: 'identity_form', sourceHandle: 'intent:s_other' },
            { id: 'e_s_fall', source: 'support_menu', target: 'identity_form', sourceHandle: 'fallback' },
            { id: 'e_s_log_next', source: 'support_login_msg', target: 'support_res_check', sourceHandle: 'next' },
            { id: 'e_s_res_yes', source: 'support_res_check', target: 'resolved_msg', sourceHandle: 'intent:res_yes' },
            { id: 'e_s_res_no', source: 'support_res_check', target: 'identity_form', sourceHandle: 'intent:res_no' },
            { id: 'e_s_res_fall', source: 'support_res_check', target: 'identity_form', sourceHandle: 'fallback' },

            // Sales path
            { id: 'e_sl_greet', source: 'sales_greet', target: 'sales_interest', sourceHandle: 'next' },
            { id: 'e_sl_topic', source: 'sales_interest', target: 'identity_form', sourceHandle: 'next' },

            // Billing path
            { id: 'e_bl_menu', source: 'billing_menu', target: 'billing_price_msg', sourceHandle: 'next' },
            { id: 'e_bl_price_next', source: 'billing_price_msg', target: 'billing_res_check', sourceHandle: 'next' },
            { id: 'e_bl_res_yes', source: 'billing_res_check', target: 'resolved_msg', sourceHandle: 'intent:bl_res_yes' },
            { id: 'e_bl_res_no', source: 'billing_res_check', target: 'identity_form', sourceHandle: 'intent:bl_res_no' },
            { id: 'e_bl_res_fall', source: 'billing_res_check', target: 'identity_form', sourceHandle: 'fallback' },

            // Other path
            { id: 'e_ot_msg', source: 'other_capture_msg', target: 'identity_form', sourceHandle: 'next' },

            // SHARED ID CAPTURE & HANDOFF
            { id: 'e_ident_next', source: 'identity_form', target: 'handoff_msg', sourceHandle: 'next' },
            { id: 'e_hand_msg', source: 'handoff_msg', target: 'shared_handoff', sourceHandle: 'next' },
            { id: 'e_hand_next', source: 'shared_handoff', target: 'terminal_wait', sourceHandle: 'next' },
            { id: 'e_res_next', source: 'resolved_msg', target: 'terminal_wait', sourceHandle: 'next' },
          ];
        }

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
  }, [isOpen, fitView, initialFlow, setNodes, setEdges, aiEnabled]);

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

        <div className="flex-1 flex overflow-hidden relative">
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

              {(selectedNodeId && selectedNode) ? (
                <aside className="w-[420px] bg-background border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b flex items-center justify-between bg-muted/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", NODE_TYPES_META[selectedNode!.type as AutomationNodeType].color)}>
                        {React.createElement(NODE_TYPES_META[selectedNode!.type as AutomationNodeType].icon, { className: 'h-4 w-4' })}
                        </div>
                        <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest">{NODE_TYPES_META[selectedNode!.type as AutomationNodeType].label}</h3>
                        <p className="text-[10px] text-muted-foreground">ID: {selectedNode!.id.substring(0, 8)}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedNodeId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
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

                    {selectedNode.type === 'ai_classifier' && (
                        <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">AI Behavior / Instructions</Label>
                            <Textarea 
                            value={selectedNode.data.text || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                            placeholder="e.g. Classify the visitor’s message into one of the following intents."
                            className="border-2 bg-muted/30 font-medium"
                            rows={4}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Provide context for the AI classification engine.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase text-indigo-500">Intents (Branching paths)</Label>
                            <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-bold" onClick={() => {
                                const newIntents = [...(selectedNode.data.intents || []), { id: `intent_${Date.now()}`, label: 'New Intent', description: '' }];
                                updateNodeData(selectedNode.id, { intents: newIntents });
                            }}><Plus className="h-3 w-3 mr-1" /> Add Intent</Button>
                            </div>
                            <div className="space-y-4">
                            {(selectedNode.data.intents || []).map((intent: any, idx: number) => (
                                <div key={intent.id} className="p-3 border-2 rounded-xl bg-background group space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Navigation className="h-3 w-3 text-muted-foreground opacity-40 shrink-0" />
                                    <Input 
                                        value={intent.label} 
                                        onChange={(e) => {
                                        const newIntents = [...selectedNode.data.intents];
                                        newIntents[idx].label = e.target.value;
                                        updateNodeData(selectedNode.id, { intents: newIntents });
                                        }}
                                        className="h-7 text-sm border-none shadow-none focus-visible:ring-0 font-bold p-0"
                                        placeholder="Intent Name"
                                    />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => {
                                        updateNodeData(selectedNode.id, { intents: selectedNode.data.intents.filter((i: any) => i.id !== intent.id) });
                                    }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  <Textarea 
                                    value={intent.description} 
                                    onChange={(e) => {
                                      const newIntents = [...selectedNode.data.intents];
                                      newIntents[idx].description = e.target.value;
                                      updateNodeData(selectedNode.id, { intents: newIntents });
                                    }}
                                    className="text-xs bg-muted/30 border-none resize-none min-h-[60px]"
                                    placeholder="Describe this intent for the AI..."
                                  />
                                </div>
                            ))}
                            </div>
                        </div>
                        </div>
                    )}

                    {selectedNode.type === 'quick_reply' && (
                        <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Prompt Text (Optional)</Label>
                            <Input 
                            value={selectedNode.data.text || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                            placeholder="e.g. Choose an option:"
                            className="border-2"
                            />
                            <p className='text-[10px] text-muted-foreground italic'>If empty, buttons will attach to the previous message.</p>
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

                    {(selectedNode.type === 'capture_input' || selectedNode.type === 'identity_form') && (
                        <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Question Prompt</Label>
                            <Input 
                            value={selectedNode.data.prompt || ''} 
                            onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                            placeholder={selectedNode.type === 'identity_form' ? "Before we start, could I get your name and email?" : "e.g. What is your email address?"}
                            className="border-2"
                            />
                        </div>
                        {selectedNode.type === 'capture_input' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Input Type & Validation</Label>
                              <Select 
                                value={selectedNode.data.inputType} 
                                onValueChange={(val) => updateNodeData(selectedNode.id, { inputType: val })}
                              >
                                <SelectTrigger className="border-2"><SelectValue placeholder="Select type..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="email">Email Address</SelectItem>
                                  <SelectItem value="phone">Phone Number</SelectItem>
                                  <SelectItem value="text">Free Text</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="url">URL</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="space-y-2">
                                  <Label className="text-xs font-bold uppercase">Save As Variable</Label>
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
                              <div className="flex items-center justify-between p-3 border-2 rounded-xl bg-muted/30">
                                  <div className="space-y-0.5">
                                      <Label className="text-xs font-bold uppercase">Sync to CRM</Label>
                                      <p className="text-[10px] text-muted-foreground">Save to contact profile</p>
                                  </div>
                                  <Switch 
                                      checked={selectedNode.data.saveToProfile} 
                                      onCheckedChange={(val) => updateNodeData(selectedNode.id, { saveToProfile: val })} 
                                  />
                              </div>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                              <Label className="text-xs font-bold uppercase">Error Handling</Label>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Retry Attempts</span>
                                  <Input 
                                    type="number" 
                                    value={selectedNode.data.validation?.retryAttempts || 2} 
                                    onChange={(e) => updateNodeData(selectedNode.id, { validation: { ...selectedNode.data.validation, retryAttempts: parseInt(e.target.value) } })}
                                    className="w-16 h-8 text-xs"
                                  />
                                </div>
                                <Textarea 
                                  value={selectedNode.data.validation?.errorMessage || ''} 
                                  onChange={(e) => updateNodeData(selectedNode.id, { validation: { ...selectedNode.data.validation, errorMessage: e.target.value } })}
                                  className="text-xs bg-muted/30"
                                  placeholder="Message if validation fails..."
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        </div>
                    )}

                    {selectedNode.type === 'ai_step' && (
                        <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase">AI Behavior / Instructions</Label>
                          <Textarea 
                              value={selectedNode.data.prompt || ''} 
                              onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                              placeholder="e.g. Act as a technical support agent. Use the knowledge base to answer questions."
                              rows={8}
                              className="bg-muted/30 border-2 font-medium"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Knowledge Sources</Label>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Switch checked={selectedNode.data.knowledgeSources?.includes('default')} onCheckedChange={() => {}} />
                                <span className="text-xs font-medium">Default Knowledge Base</span>
                              </div>
                              <div className="flex items-center gap-2 opacity-50">
                                <Switch checked={false} disabled />
                                <span className="text-xs font-medium">Website Crawl (Upcoming)</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Fallback Behavior</Label>
                            <Select 
                              value={selectedNode.data.fallbackBehavior || 'escalate'} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { fallbackBehavior: val })}
                            >
                              <SelectTrigger className="border-2"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="escalate">Escalate to Human</SelectItem>
                                <SelectItem value="clarify">Ask Clarifying Question</SelectItem>
                                <SelectItem value="route">Route to Another Step</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        </div>
                    )}

                    {selectedNode.type === 'condition' && (
                        <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase">Property to Check</Label>
                          <Select 
                              value={selectedNode.data.conditionField} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { conditionField: val })}
                          >
                              <SelectTrigger className="h-11 border-2 rounded-xl"><SelectValue placeholder="Select property..." /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                              <SelectItem value="email">Visitor Email</SelectItem>
                              <SelectItem value="name">Visitor Name</SelectItem>
                              <SelectItem value="identified">Secure Identity Token</SelectItem>
                              <SelectItem value="plan">Subscription Plan</SelectItem>
                              <SelectItem value="spend">Total Spend</SelectItem>
                              </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Operator</Label>
                            <Select 
                              value={selectedNode.data.operator || 'exists'} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { operator: val })}
                            >
                              <SelectTrigger className="border-2"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exists">Exists</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="not_equals">Does not equal</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="gt">Greater than</SelectItem>
                                <SelectItem value="lt">Less than</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedNode.data.operator !== 'exists' && (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Comparison Value</Label>
                              <Input 
                                value={selectedNode.data.conditionValue || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                                placeholder="Enter value..."
                                className="border-2"
                              />
                            </div>
                          )}
                        </div>
                        </div>
                    )}

                    {selectedNode.type === 'handoff' && (
                        <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Assign to Team</Label>
                            <Select 
                              value={selectedNode.data.teamId || 'support'} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { teamId: val })}
                            >
                              <SelectTrigger className="border-2"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="support">Support Team</SelectItem>
                                <SelectItem value="sales">Sales Team</SelectItem>
                                <SelectItem value="billing">Billing Team</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Priority</Label>
                            <Select 
                              value={selectedNode.data.priority || 'medium'} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { priority: val })}
                            >
                              <SelectTrigger className="border-2"><SelectValue placeholder="Set priority" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Transfer Message</Label>
                            <Textarea 
                                value={selectedNode.data.text || ''} 
                                onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                placeholder="e.g. Connecting you to our team. Someone will be with you shortly."
                                className="bg-muted/30 border-2 font-medium"
                                rows={4}
                            />
                        </div>
                        </div>
                    )}

                    {selectedNode.type === 'end' && (
                        <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Wait Behavior</Label>
                            <Select 
                              value={selectedNode.data.waitBehavior || 'pause'} 
                              onValueChange={(val) => updateNodeData(selectedNode.id, { waitBehavior: val })}
                            >
                              <SelectTrigger className="border-2"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pause">Pause flow (Wait for reply)</SelectItem>
                                <SelectItem value="end">End conversation</SelectItem>
                                <SelectItem value="reopen">Reopen if visitor replies</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedNode.data.waitBehavior === 'end' && (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase">Auto-close after (minutes)</Label>
                              <Input 
                                type="number" 
                                value={selectedNode.data.autoCloseMinutes || 30} 
                                onChange={(e) => updateNodeData(selectedNode.id, { autoCloseMinutes: parseInt(e.target.value) })}
                                className="border-2"
                              />
                            </div>
                          )}
                        </div>
                        </div>
                    )}

                    <Separator className="my-6" />
                    
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
                  </ScrollArea>
                </aside>
              ) : null}

              {/* Node Picker Side Drawer */}
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
                                    
                                    <button 
                                        onClick={() => setIsPickingExisting(true)} 
                                        className="flex items-center gap-4 w-full p-4 bg-muted/30 hover:bg-muted rounded-2xl transition-all border-2 border-dashed border-border group"
                                    >
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-background text-foreground shrink-0 border shadow-sm">
                                            <Link className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-sm font-bold">Connect Existing Step...</span>
                                            <span className="text-[11px] text-muted-foreground">Link this path to a node already on the map.</span>
                                        </div>
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Button variant="ghost" size="sm" onClick={() => setIsPickingExisting(false)} className="-ml-2 h-8">
                                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                                        </Button>
                                        <span className="text-xs font-bold uppercase tracking-widest">Select Target</span>
                                    </div>
                                    
                                    <Command className="border rounded-xl shadow-sm">
                                        <CommandInput placeholder="Search existing steps..." />
                                        <CommandList>
                                            <CommandEmpty>No steps found.</CommandEmpty>
                                            <CommandGroup heading="Nodes on Canvas">
                                                {nodes.filter(n => n.id !== nodePickerInfo?.sourceId).map(n => {
                                                    const m = NODE_TYPES_META[n.type as AutomationNodeType];
                                                    return (
                                                        <CommandItem key={n.id} onSelect={() => onPickExisting(n.id)} className="gap-4 p-3 cursor-pointer">
                                                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0", m.color)}>
                                                                {React.createElement(m.icon, { className: 'h-4 w-4' })}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm font-bold truncate">{n.data.text || n.data.prompt || n.data.name || m.label}</span>
                                                                <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
                                                            </div>
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
  // State for form fields in preview
  const [previewName, setPreviewName] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStep = useCallback(async (nodeId: string | null, handleId?: string) => {
    if (!nodeId) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrentNodeId(nodeId);

    // SILENT LOGIC NODES
    if (node.type === 'start') {
      const nextEdge = edges.find(e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'next'));
      if (nextEdge) handleStep(nextEdge.target);
      return;
    }

    if (node.type === 'ai_classifier') {
      return;
    }

    if (node.type === 'condition') {
      const met = Math.random() > 0.5;
      const targetHandle = met ? 'true' : 'false';
      const nextEdge = edges.find(e => e.source === nodeId && e.sourceHandle === targetHandle);
      if (nextEdge) handleStep(nextEdge.target);
      return;
    }

    // VISIBLE MESSAGE NODES
    if (node.type === 'message') {
      if (node.data.text) {
        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text, type: 'automation' }]);
      }
      const nextEdge = edges.find(e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'next'));
      if (nextEdge) {
        timeoutRef.current = setTimeout(() => handleStep(nextEdge.target), 800);
      }
    } else if (node.type === 'quick_reply') {
      const buttons = node.data.buttons || [];
      const text = node.data.text;
      
      if (!text) {
          setMessages(prev => {
              if (prev.length > 0) {
                  const last = prev[prev.length - 1];
                  if (last.role === 'bot') {
                      const updated = [...prev];
                      updated[updated.length - 1] = { ...last, buttons };
                      return updated;
                  }
              }
              return [...prev, { id: Date.now(), role: 'bot', text: '', type: 'automation', buttons }];
          });
      } else {
          setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text, type: 'automation', buttons }]);
      }
    } else if (node.type === 'capture_input') {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt, type: 'automation' }]);
    } else if (node.type === 'identity_form') {
      // SKIP in preview if already "submitted" in this session
      if (previewEmail && previewName) {
        const nextEdge = edges.find(e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'next'));
        if (nextEdge) handleStep(nextEdge.target);
        return;
      }

      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt || "Please tell us your details.", type: 'automation', isIdentityForm: true, nodeId: node.id }]);
      return;
    } else if (node.type === 'handoff') {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || 'Transferring...', type: 'automation' }]);
      setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: 'Escalated to human' }]);
    } else if (node.type === 'ai_step') {
      setIsThinking(true);
      timeoutRef.current = setTimeout(() => {
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
    }
  }, [nodes, edges, previewEmail, previewName]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessages([]);
    handleStep('start');
    
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [handleStep]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleInput = (text: string, buttonId?: string, forceNodeId?: string) => {
    if (!text.trim() && !buttonId && !forceNodeId) return;
    
    const targetNodeId = forceNodeId || currentNodeId;
    const currentNode = nodes.find(n => n.id === targetNodeId);

    // If it's the identity form, validate the email before proceeding
    if (currentNode?.type === 'identity_form' && forceNodeId) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const email = previewEmail.trim();
      const name = previewName.trim();

      if (!name || !email) {
        setFormError("Both name and email are required.");
        return;
      }

      if (!emailRegex.test(email)) {
        setFormError("Please enter a valid email address.");
        return;
      }
      
      setFormError(null);
    }

    if (!forceNodeId) {
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: text || 'Click' }]);
        setUserInput('');
    }
    
    let targetEdge;

    if (buttonId) {
        targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === `intent:${buttonId}`);
    } else if (currentNode?.type === 'identity_form') {
        targetEdge = edges.find(e => e.source === targetNodeId && (e.sourceHandle === 'next' || !e.sourceHandle));
    } else if (currentNode?.type === 'quick_reply') {
        const buttons = currentNode.data.buttons || [];
        const matchedButton = buttons.find((b: any) => text.toLowerCase().includes(b.label.toLowerCase()));
        
        if (matchedButton) {
            targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === `intent:${matchedButton.id}`);
        } else {
            targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === 'fallback');
        }
    } else if (currentNode?.type === 'ai_classifier') {
        const intents = currentNode.data.intents || [];
        const matchedIntent = intents.find((i: any) => text.toLowerCase().includes(i.label.toLowerCase()));
        
        if (matchedIntent) {
            targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === `intent:${matchedIntent.id}`);
        } else {
            targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === 'fallback');
        }
    } else {
        targetEdge = edges.find(e => e.source === targetNodeId && (e.sourceHandle === 'next' || !e.sourceHandle));
    }

    if (targetEdge) {
        handleStep(targetEdge.target);
    }
  };

  const handleReset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessages([]);
    setPreviewName('');
    setPreviewEmail('');
    setFormError(null);
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
                  <>
                    {m.text && (
                        <div className={cn(
                            "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                            m.role === 'user' ? "bg-primary text-primary-foreground rounded-br-none" : 
                            m.type === 'ai' ? "bg-indigo-500/10 border-2 border-indigo-500/20 text-foreground rounded-bl-none" :
                            "bg-muted text-foreground rounded-bl-none"
                        )}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            {m.isIdentityForm && (
                              <div className="mt-3 space-y-3 p-3 border-t border-black/5 bg-background/50 rounded-xl">
                                <Input 
                                  placeholder="Name" 
                                  className="h-8 text-xs bg-background" 
                                  value={previewName}
                                  onChange={(e) => setPreviewName(e.target.value)}
                                />
                                <Input 
                                  placeholder="Email" 
                                  className="h-8 text-xs bg-background" 
                                  value={previewEmail}
                                  onChange={(e) => setPreviewEmail(e.target.value)}
                                />
                                {formError && <p className="text-[10px] text-destructive font-bold">{formError}</p>}
                                <Button size="sm" className="w-full h-8 text-xs font-bold" onClick={() => handleInput(`Name: ${previewName}, Email: ${previewEmail}`, undefined, m.nodeId)}>
                                    Submit Details
                                </Button>
                              </div>
                            )}
                        </div>
                    )}
                    {m.buttons && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {m.buttons.map((btn: any) => (
                            <button 
                                key={btn.id} 
                                onClick={() => handleInput(btn.label, btn.id)}
                                className="h-9 px-4 rounded-full border-2 border-primary/30 bg-background text-primary hover:bg-primary/5 transition-all text-xs font-bold"
                            >
                                {btn.label}
                            </button>
                            ))}
                        </div>
                    )}
                  </>
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
              className="pr-12 rounded-full h-11 border-2 focus-visible:ring-primary/20" 
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
