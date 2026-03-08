'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot as BotData, AutomationNode, AutomationEdge, AutomationFlow, ChatMessage, Attachment, User, AutomationNodeType } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Bot, Loader2, Smartphone, CheckCircle2, ChevronRight, Navigation, MousePointerClick } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatbotSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  botData: Partial<BotData>;
  flow: AutomationFlow;
  agents: User[];
}

export default function ChatbotSimulator({ isOpen, onClose, botData, flow, agents }: ChatbotSimulatorProps) {
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

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  const handleStep = useCallback(async (nodeId: string | null) => {
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

    if (node.type === 'condition') {
      const met = !!previewEmail || !!previewName;
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
    } else if (node.type === 'ai_classifier') {
        const intents = node.data.intents || [];
        const text = node.data.text || node.data.prompt || "How can I help you today?";
        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text, type: 'automation', buttons: intents }]);
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
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.text || 'Transferring you to a human agent...', type: 'automation' }]);
      setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: 'Escalated to human' }]);
    } else if (node.type === 'ai_step') {
      setIsThinking(true);
      timeoutRef.current = setTimeout(() => {
        setIsThinking(false);
        const resolved = Math.random() > 0.4;
        if (resolved) {
          setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: "I've found an answer for you in our knowledge base!", type: 'ai' }]);
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
    if (isOpen) {
        handleReset();
    }
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [isOpen]);

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
    } else if (currentNode?.type === 'quick_reply' || currentNode?.type === 'ai_classifier') {
        const buttons = currentNode.type === 'quick_reply' ? (currentNode.data.buttons || []) : (currentNode.data.intents || []);
        const matchedButton = buttons.find((b: any) => text.toLowerCase().includes(b.label.toLowerCase()));
        
        if (matchedButton) {
            targetEdge = edges.find(e => e.source === targetNodeId && e.sourceHandle === `intent:${matchedButton.id}`);
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

  if (!isOpen) return null;

  const style = botData.styleSettings || {
    backgroundColor: '#111827',
    primaryColor: '#3b82f6',
    headerTextColor: '#ffffff',
    agentMessageBackgroundColor: '#374151',
    agentMessageTextColor: '#ffffff',
    customerTextColor: '#ffffff',
    chatbotIconsColor: '#3b82f6',
    chatbotIconsTextColor: '#ffffff',
    logoUrl: ''
  };

  return (
    <div className="absolute top-0 right-0 w-[440px] h-full bg-black/40 backdrop-blur-sm z-[300] flex flex-col items-center justify-center p-6 animate-in slide-in-from-right duration-300">
      <div 
        className="w-full h-full bg-background rounded-[2.5rem] shadow-2xl border-8 border-muted flex flex-col overflow-hidden relative"
        style={{ backgroundColor: style.backgroundColor }}
      >
        {/* Header */}
        <div 
            className="p-5 border-b border-white/5 flex items-center justify-between"
            style={{ backgroundColor: style.backgroundColor }}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 rounded-full border border-white/10">
              <AvatarImage src={style.logoUrl} className="object-contain" />
              <AvatarFallback className="bg-white/5"><Bot className="h-5 w-5 opacity-50" /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-bold" style={{ color: style.headerTextColor }}>{botData.name || 'Agent'}</span>
              <span className="text-[9px] uppercase font-black text-green-500 tracking-tighter">Live Preview</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-white">Reset</Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-white">
                <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-6 space-y-6">
            <div className="flex items-end gap-2">
                <div 
                    className="p-3.5 rounded-2xl rounded-bl-none text-sm shadow-sm max-w-[85%] whitespace-pre-wrap"
                    style={{ backgroundColor: style.agentMessageBackgroundColor, color: style.agentMessageTextColor }}
                >
                    {botData.welcomeMessage || 'Hi there!'}
                </div>
            </div>

            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                {m.role === 'system' ? (
                  <Badge variant="outline" className="self-center bg-muted/50 uppercase text-[9px] font-black">{m.text}</Badge>
                ) : (
                  <>
                    {m.text && (
                        <div className={cn(
                            "max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm",
                            m.role === 'user' ? "rounded-br-none" : "rounded-bl-none"
                        )}
                        style={m.role === 'user' ? { 
                            backgroundColor: style.primaryColor, 
                            color: style.customerTextColor 
                        } : { 
                            backgroundColor: style.agentMessageBackgroundColor, 
                            color: style.agentMessageTextColor 
                        }}
                        >
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            {m.isIdentityForm && (
                              <div className="mt-3 space-y-3 p-3 border-t border-black/5 bg-background/50 rounded-xl">
                                <Input 
                                  placeholder="Name" 
                                  className="h-8 text-xs bg-background border-white/10" 
                                  value={previewName}
                                  onChange={(e) => setPreviewName(e.target.value)}
                                />
                                <Input 
                                  placeholder="Email" 
                                  className="h-8 text-xs bg-background border-white/10" 
                                  value={previewEmail}
                                  onChange={(e) => setPreviewEmail(e.target.value)}
                                />
                                {formError && <p className="text-[10px] text-destructive font-bold">{formError}</p>}
                                <Button size="sm" className="w-full h-8 text-xs font-bold" style={{ backgroundColor: style.primaryColor }} onClick={() => handleInput(`Name: ${previewName}, Email: ${previewEmail}`, undefined, m.nodeId)}>
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
                                className="h-9 px-4 rounded-full border-2 transition-all text-xs font-bold"
                                style={{ borderColor: `${style.primaryColor}40`, color: style.primaryColor, backgroundColor: 'transparent' }}
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
              <div className="flex items-center gap-2 p-3 rounded-2xl rounded-bl-none w-fit" style={{ backgroundColor: style.agentMessageBackgroundColor }}>
                <Bot className="h-4 w-4 animate-pulse" style={{ color: style.agentMessageTextColor }} />
                <span className="text-xs italic" style={{ color: style.agentMessageTextColor }}>Thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
          <div className="relative">
            <Input 
              placeholder="Type a message..." 
              className="pr-12 rounded-full h-11 border-2 bg-white/5 border-white/10 focus-visible:ring-primary/20" 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInput(userInput)}
            />
            <Button size="icon" className="absolute right-1 top-1 h-9 w-9 rounded-full shadow-lg" style={{ backgroundColor: style.chatbotIconsColor }} onClick={() => handleInput(userInput)}>
              <Send className="h-4 w-4" style={{ color: style.chatbotIconsTextColor }} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}