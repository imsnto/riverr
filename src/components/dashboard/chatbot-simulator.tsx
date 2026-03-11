'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot as BotData, AutomationFlow, ChatMessage, User } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Bot, Loader2, MessageCircle, ChevronRight, Plus } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
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
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  
  const [previewName, setPreviewName] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

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
        setMessages([]);
        handleStep('start');
    }
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [isOpen, handleStep]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isThinking, isWidgetOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="relative w-full h-full p-6">
      {/* Floating Chat Window */}
      <div 
        className={cn(
            "absolute bottom-24 right-6 w-[340px] h-[520px] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right",
            isWidgetOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none"
        )}
        style={{ backgroundColor: style.backgroundColor }}
      >
        {/* Header */}
        <div 
            className="p-4 border-b border-white/5 flex items-center justify-between shrink-0"
            style={{ backgroundColor: style.backgroundColor }}
        >
          <div className="flex items-center gap-3 text-left">
            <Avatar className="h-9 w-9 rounded-full border border-white/10 shadow-sm shrink-0">
              <AvatarImage src={style.logoUrl} className="object-contain" />
              <AvatarFallback className="bg-white/5"><Bot className="h-4 w-4 opacity-50" /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate" style={{ color: style.headerTextColor }}>{botData.name || 'AI Assistant'}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex -space-x-1.5">
                    {agents.slice(0, 3).map(agent => (
                    <Avatar key={agent.id} className="h-3.5 w-3.5 border border-white/10 ring-1 ring-black/20">
                        <AvatarImage src={agent.avatarUrl} />
                        <AvatarFallback className="text-[5px]">{getInitials(agent.name)}</AvatarFallback>
                    </Avatar>
                    ))}
                </div>
                <span className="text-[9px] font-medium opacity-50 uppercase tracking-tighter" style={{ color: style.headerTextColor }}>Online</span>
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/5" onClick={() => setIsWidgetOpen(false)}>
            <X className="h-4 w-4" style={{ color: style.headerTextColor }} />
          </Button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4 space-y-5">
            <div className="flex items-end gap-2 justify-start">
              <div className="p-3 rounded-2xl text-xs shadow-sm rounded-bl-none text-left" style={{ backgroundColor: style.agentMessageBackgroundColor, color: style.agentMessageTextColor }}>
                <p className="whitespace-pre-wrap">{botData.welcomeMessage || 'Hi! How can I help?'}</p>
              </div>
            </div>
            <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground/50 ml-1 text-left">AI Assistant</p>

            {messages.map((m) => (
              <div key={m.id} className="space-y-1">
                <div className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                  {m.role === 'system' ? (
                    <Badge variant="outline" className="self-center bg-muted/50 border-white/5 text-[8px] font-black tracking-tight uppercase px-2">{m.text}</Badge>
                  ) : (
                    <>
                      {m.text && (
                          <div className={cn(
                              "max-w-[85%] p-3 rounded-2xl text-xs shadow-sm text-left",
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
                                  <div className="prose prose-sm prose-invert text-xs" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} />
                              ) : (
                                  <p className="whitespace-pre-wrap">{m.text}</p>
                              )}
                              
                              {m.isIdentityForm && (
                                <div className="mt-4 space-y-3 p-3 border-t border-white/10 bg-black/20 rounded-xl text-left">
                                  <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-black tracking-widest opacity-70" style={{ color: style.agentMessageTextColor }}>Name</Label>
                                      <Input 
                                          placeholder="e.g. John Doe" 
                                          className="h-8 text-[11px] bg-white/5 border-white/10 text-white" 
                                          value={previewName}
                                          onChange={(e) => setPreviewName(e.target.value)}
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-black tracking-widest opacity-70" style={{ color: style.agentMessageTextColor }}>Email</Label>
                                      <Input 
                                          placeholder="e.g. john@example.com" 
                                          className="h-8 text-[11px] bg-white/5 border-white/10 text-white" 
                                          value={previewEmail}
                                          onChange={(e) => setPreviewEmail(e.target.value)}
                                      />
                                  </div>
                                  {formError && <p className="text-[9px] text-red-400 font-bold">{formError}</p>}
                                  <Button type="button" size="sm" className="w-full h-8 text-[11px] font-bold mt-2 rounded-lg" style={{ backgroundColor: style.primaryColor, color: style.customerTextColor }} onClick={() => handleInput(`Name: ${previewName}, Email: ${previewEmail}`, undefined, m.nodeId)}>
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
                                  type="button"
                                  onClick={() => handleInput(btn.label, btn.id)}
                                  className="h-8 px-3 rounded-full border-2 transition-all text-[11px] font-bold flex items-center gap-1 group"
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
                {m.role === 'bot' && (
                  <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground/50 ml-1 text-left">Team member</p>
                )}
              </div>
            ))}
            {isThinking && <TypingBubble color={style.agentMessageBackgroundColor} textColor={style.agentMessageTextColor} />}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 bg-black/20 shrink-0">
          <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <Textarea 
                placeholder="Message..." 
                className="pr-10 rounded-xl min-h-[40px] max-h-32 border-none bg-white/5 focus-visible:ring-0 text-xs py-2 text-white resize-none" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleInput(userInput);
                    }
                }}
              />
              <Button type="button" size="icon" variant="ghost" className="absolute right-1 bottom-1 h-8 w-8 rounded-full text-muted-foreground hover:text-white" onClick={() => handleInput(userInput)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Launcher Button */}
      <button 
        type="button"
        onClick={() => setIsWidgetOpen(!isWidgetOpen)}
        className="absolute bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 z-50"
        style={{ backgroundColor: style.chatbotIconsColor }}
      >
        {isWidgetOpen ? (
            <X className="h-7 w-7" style={{ color: style.chatbotIconsTextColor }} />
        ) : (
            <MessageCircle className="h-7 w-7" style={{ color: style.chatbotIconsTextColor }} />
        )}
      </button>
    </div>
  );
}
