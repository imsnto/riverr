'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot as BotData, AutomationFlow, ChatMessage, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Bot, Loader2, MessageCircle, ChevronRight } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { marked } from 'marked';

interface ChatbotSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  botData: Partial<BotData>;
  flow: AutomationFlow;
  agents: User[];
}

const TypingBubble = ({ color, textColor }: { color: string, textColor: string }) => (
  <div className="flex items-end gap-2 mb-4 justify-start">
    <div className="p-3 rounded-xl flex items-center gap-1 shadow-sm rounded-bl-none" style={{ backgroundColor: color }}>
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
    </div>
  </div>
);

export default function ChatbotSimulator({ isOpen, onClose, botData, flow, agents }: ChatbotSimulatorProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [userInput, setUserInput] = useState('');
  
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
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: text || '', type: 'automation', buttons }]);
    } else if (node.type === 'ai_classifier') {
        const intents = node.data.intents || [];
        const text = node.data.text || node.data.prompt || "How can I help you today?";
        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text, type: 'automation', buttons: intents }]);
    } else if (node.type === 'capture_input') {
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt, type: 'automation' }]);
    } else if (node.type === 'identity_form') {
      if (previewEmail && previewName) {
        const nextEdge = edges.find(e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'next'));
        if (nextEdge) handleStep(nextEdge.target);
        return;
      }
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt || "Before we continue, could I get your name and email?", type: 'automation', isIdentityForm: true, nodeId: node.id }]);
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

    if (currentNode?.type === 'identity_form' && forceNodeId) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!previewName.trim() || !emailRegex.test(previewEmail.trim())) {
        setFormError("Please enter a valid name and email.");
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
        targetEdge = matchedButton 
            ? edges.find(e => e.source === targetNodeId && e.sourceHandle === `intent:${matchedButton.id}`)
            : edges.find(e => e.source === targetNodeId && e.sourceHandle === 'fallback');
    } else {
        targetEdge = edges.find(e => e.source === targetNodeId && (e.sourceHandle === 'next' || !e.sourceHandle));
    }

    if (targetEdge) handleStep(targetEdge.target);
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

  const style = {
    backgroundColor: botData.styleSettings?.backgroundColor || '#111827',
    primaryColor: botData.styleSettings?.primaryColor || '#3b82f6',
    headerTextColor: botData.styleSettings?.headerTextColor || '#ffffff',
    agentMessageBackgroundColor: botData.styleSettings?.agentMessageBackgroundColor || '#374151',
    agentMessageTextColor: botData.styleSettings?.agentMessageTextColor || '#ffffff',
    customerTextColor: botData.styleSettings?.customerTextColor || '#ffffff',
    chatbotIconsColor: botData.styleSettings?.chatbotIconsColor || '#3b82f6',
    chatbotIconsTextColor: botData.styleSettings?.chatbotIconsTextColor || '#ffffff',
    logoUrl: botData.styleSettings?.logoUrl || ''
  };

  return (
    <div className="absolute top-0 right-0 w-[440px] h-full bg-black/40 backdrop-blur-sm z-[300] flex flex-col items-center justify-center p-6 animate-in slide-in-from-right duration-300">
      <div 
        className="w-full h-full bg-background rounded-[2.5rem] shadow-2xl border-8 border-muted flex flex-col overflow-hidden relative"
        style={{ backgroundColor: style.backgroundColor }}
      >
        {/* Header */}
        <div 
            className="p-5 border-b border-white/5 flex items-center justify-between shrink-0"
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
                    {botData.welcomeMessage || 'Hi there! How can we help you today?'}
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
                            {m.type === 'ai' ? (
                                <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} />
                            ) : (
                                <p className="whitespace-pre-wrap">{m.text}</p>
                            )}
                            
                            {m.isIdentityForm && (
                              <div className="mt-4 space-y-3 p-4 border-t border-white/10 bg-black/20 rounded-xl">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold tracking-wider opacity-70" style={{ color: style.agentMessageTextColor }}>Name</Label>
                                    <Input 
                                        placeholder="e.g. John Doe" 
                                        className="h-9 text-xs bg-white/5 border-white/10" 
                                        value={previewName}
                                        onChange={(e) => setPreviewName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold tracking-wider opacity-70" style={{ color: style.agentMessageTextColor }}>Email</Label>
                                    <Input 
                                        placeholder="e.g. john@example.com" 
                                        className="h-9 text-xs bg-white/5 border-white/10" 
                                        value={previewEmail}
                                        onChange={(e) => setPreviewEmail(e.target.value)}
                                    />
                                </div>
                                {formError && <p className="text-[10px] text-red-400 font-bold">{formError}</p>}
                                <Button size="sm" className="w-full h-9 text-xs font-bold mt-2" style={{ backgroundColor: style.primaryColor, color: style.customerTextColor }} onClick={() => handleInput(`Name: ${previewName}, Email: ${previewEmail}`, undefined, m.nodeId)}>
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
                                className="h-9 px-4 rounded-full border-2 transition-all text-xs font-bold flex items-center gap-1 group"
                                style={{ borderColor: `${style.primaryColor}40`, color: style.primaryColor }}
                            >
                                {btn.label}
                                <ChevronRight className="h-3 w-3 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                            ))}
                        </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {isThinking && <TypingBubble color={style.agentMessageBackgroundColor} textColor={style.agentMessageTextColor} />}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
          <div className="relative">
            <Textarea 
              placeholder="Type a message..." 
              className="pr-12 rounded-2xl min-h-[44px] max-h-32 border-2 bg-white/5 border-white/10 focus-visible:ring-primary/20 text-sm py-2.5" 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleInput(userInput);
                  }
              }}
            />
            <Button size="icon" className="absolute right-1 bottom-1 h-9 w-9 rounded-full shadow-lg" style={{ backgroundColor: style.chatbotIconsColor }} onClick={() => handleInput(userInput)}>
              <Send className="h-4 w-4" style={{ color: style.chatbotIconsTextColor }} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
