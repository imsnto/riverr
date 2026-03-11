'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot as BotData, AutomationFlow, ChatMessage, User, Attachment } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Bot, Loader2, MessageCircle, ChevronRight, Plus, Paperclip, ImageIcon, File as FileIcon } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { marked } from 'marked';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

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

  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: node.data.prompt || "Before we continue, could we get your name and email?", type: 'automation', isIdentityForm: true, nodeId: node.id }]);
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
    if (!text.trim() && !buttonId && !forceNodeId && attachments.length === 0) return;
    
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
        const msgAttachments = attachments.map(file => ({
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'file',
        }));

        setMessages(prev => [...prev, { 
            id: Date.now(), 
            role: 'user', 
            text: text || (msgAttachments.length > 0 ? 'Sent an attachment' : 'Click'),
            attachments: msgAttachments
        }]);
        setUserInput('');
        setAttachments([]);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="relative w-full h-full p-6">
      {/* Floating Chat Window */}
      <div 
        className={cn(
            "absolute bottom-20 right-6 w-[280px] h-[440px] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right",
            isWidgetOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4 pointer-events-none"
        )}
        style={{ backgroundColor: style.backgroundColor }}
      >
        {/* Header */}
        <div 
            className="p-3 border-b border-white/5 flex items-center justify-between shrink-0"
            style={{ backgroundColor: style.backgroundColor }}
        >
          <div className="flex items-center gap-3 text-left">
            <Avatar className="h-8 w-8 rounded-full border border-white/10 shadow-sm shrink-0">
              <AvatarImage src={style.logoUrl} className="object-contain" />
              <AvatarFallback className="bg-white/5"><Bot className="h-3.5 w-3.5 opacity-50" /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold truncate" style={{ color: style.headerTextColor }}>{botData.name || 'AI Assistant'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex -space-x-1.5">
                    {agents.slice(0, 3).map(agent => (
                    <Avatar key={agent.id} className="h-3 w-3 border border-white/10 ring-1 ring-black/20">
                        <AvatarImage src={agent.avatarUrl} />
                        <AvatarFallback className="text-[4px]">{getInitials(agent.name)}</AvatarFallback>
                    </Avatar>
                    ))}
                </div>
                <span className="text-[8px] font-medium opacity-50 uppercase tracking-tighter" style={{ color: style.headerTextColor }}>Online</span>
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/5" onClick={() => setIsWidgetOpen(false)}>
            <X className="h-3.5 w-3.5" style={{ color: style.headerTextColor }} />
          </Button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-3 space-y-4">
            <div className="flex items-end gap-2 justify-start">
              <div className="p-2.5 rounded-2xl text-[11px] shadow-sm rounded-bl-none text-left" style={{ backgroundColor: style.agentMessageBackgroundColor, color: style.agentMessageTextColor }}>
                <p className="whitespace-pre-wrap">{botData.welcomeMessage || 'Hi! How can I help?'}</p>
              </div>
            </div>
            <p className="text-[8px] uppercase font-black tracking-widest text-muted-foreground/50 ml-1 text-left">AI Assistant</p>

            {messages.map((m) => (
              <div key={m.id} className="space-y-1">
                <div className={cn("flex flex-col gap-2", m.role === 'user' ? "items-end" : "items-start")}>
                  {m.role === 'system' ? (
                    <Badge variant="outline" className="self-center bg-muted/50 border-white/5 text-[7px] font-black tracking-tight uppercase px-1.5 h-4">{m.text}</Badge>
                  ) : (
                    <>
                      {m.text && (
                          <div className={cn(
                              "max-w-[90%] p-2.5 rounded-2xl text-[11px] shadow-sm text-left",
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
                                  <div className="prose prose-sm prose-invert text-[11px]" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} />
                              ) : (
                                  <p className="whitespace-pre-wrap">{m.text}</p>
                              )}

                              {m.attachments && m.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {m.attachments.map((att: any) => (
                                        <div key={att.id}>
                                            {att.type === 'image' ? (
                                                <img src={att.url} alt={att.name} className="rounded-lg max-w-full h-auto object-cover" />
                                            ) : (
                                                <div className="flex items-center gap-2 text-[10px] text-white/80 p-1 bg-black/20 rounded">
                                                    <FileIcon className="h-3 w-3" />
                                                    <span className="truncate">{att.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                              )}
                              
                              {m.isIdentityForm && (
                                <div className="mt-3 space-y-2 p-2.5 border-t border-white/10 bg-black/20 rounded-xl text-left">
                                  <div className="space-y-1">
                                      <Label className="text-[8px] uppercase font-black tracking-widest opacity-70" style={{ color: style.agentMessageTextColor }}>Name</Label>
                                      <Input 
                                          placeholder="e.g. John Doe" 
                                          className="h-7 text-[10px] bg-white/5 border-white/10 text-white" 
                                          value={previewName}
                                          onChange={(e) => setPreviewName(e.target.value)}
                                      />
                                  </div>
                                  <div className="space-y-1">
                                      <Label className="text-[8px] uppercase font-black tracking-widest opacity-70" style={{ color: style.agentMessageTextColor }}>Email</Label>
                                      <Input 
                                          placeholder="e.g. john@example.com" 
                                          className="h-7 text-[10px] bg-white/5 border-white/10 text-white" 
                                          value={previewEmail}
                                          onChange={(e) => setPreviewEmail(e.target.value)}
                                      />
                                  </div>
                                  {formError && <p className="text-[8px] text-red-400 font-bold">{formError}</p>}
                                  <Button type="button" size="sm" className="w-full h-7 text-[10px] font-bold mt-1 rounded-lg" style={{ backgroundColor: style.primaryColor, color: style.customerTextColor }} onClick={() => handleInput(`Name: ${previewName}, Email: ${previewEmail}`, undefined, m.nodeId)}>
                                      Submit Details
                                  </Button>
                                </div>
                              )}
                          </div>
                      )}
                      {m.buttons && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                              {m.buttons.map((btn: any) => (
                              <button 
                                  key={btn.id} 
                                  type="button"
                                  onClick={() => handleInput(btn.label, btn.id)}
                                  className="h-7 px-2.5 rounded-full border transition-all text-[10px] font-bold flex items-center gap-1 group"
                                  style={{ borderColor: `${style.primaryColor}40`, color: style.primaryColor }}
                              >
                                  {btn.label}
                                  <ChevronRight className="h-2.5 w-2.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                              ))}
                          </div>
                      )}
                    </>
                  )}
                </div>
                {m.role === 'bot' && (
                  <p className="text-[8px] uppercase font-black tracking-widest text-muted-foreground/50 ml-1 text-left">Team member</p>
                )}
              </div>
            ))}
            {isThinking && <TypingBubble color={style.agentMessageBackgroundColor} textColor={style.agentMessageTextColor} />}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-white/5 bg-zinc-900 shrink-0">
          <div className="flex items-end gap-1">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
            <Popover>
                <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full hover:bg-white/5 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-1 text-[10px]">
                    <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2 text-[10px]" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="mr-2 h-3.5 w-3.5" />
                        Attachment
                    </Button>
                </PopoverContent>
            </Popover>

            <div className="relative flex-1">
              {attachments.length > 0 && (
                <div className="p-1 space-y-1 mb-1">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[9px] bg-zinc-800 p-1.5 rounded-md">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <FileIcon className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4 hover:bg-white/10" onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Textarea 
                    placeholder="Message..." 
                    className="pr-8 rounded-xl min-h-[36px] max-h-24 border-none bg-zinc-800 focus-visible:ring-0 text-[11px] py-2 text-white resize-none" 
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleInput(userInput);
                        }
                    }}
                />
                <Button 
                    type="button" 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-0.5 bottom-0.5 h-7 w-7 rounded-full text-muted-foreground hover:text-white" 
                    onClick={() => handleInput(userInput)}
                    disabled={!userInput.trim() && attachments.length === 0}
                >
                    <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Launcher Button */}
      <button 
        type="button"
        onClick={() => setIsWidgetOpen(!isWidgetOpen)}
        className="absolute bottom-6 right-6 h-12 w-12 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 z-50"
        style={{ backgroundColor: style.chatbotIconsColor }}
      >
        {isWidgetOpen ? (
            <X className="h-6 w-6" style={{ color: style.chatbotIconsTextColor }} />
        ) : (
            <MessageCircle className="h-6 w-6" style={{ color: style.chatbotIconsTextColor }} />
        )}
      </button>
    </div>
  );
}

function differenceInDays(d1: Date, d2: Date) {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}
