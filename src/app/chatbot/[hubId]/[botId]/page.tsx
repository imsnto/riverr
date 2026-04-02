'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Bot as BotData, Visitor, Conversation, ChatMessage, Attachment, Contact, User } from '@/lib/data';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, X, Loader2, Paperclip, ImageIcon, File as FileIcon, Bot, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { marked } from 'marked';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { invokeAgent, createConversationAndLinkCrm, ensureConversationCrmLinkedAction, updateConversation, addChatMessage as addChatMessageAction } from '@/app/actions/chat';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db as firestore } from '@/lib/firebase';

interface BotDataWithAgents extends BotData {
  agents?: User[];
}

const getInitials = (name?: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const isPublicForVisitor = (msg: ChatMessage) => {
  if (msg.visibility === 'internal' || msg.isInternal) return false;
  if (msg.type === 'note') return false;
  return true;
};

const TypingBubble = ({ color, textColor, align = 'start' }: { color: string, textColor: string, align?: 'start' | 'end' }) => (
  <div className={cn("flex items-end gap-2 mb-4", align === 'end' ? 'justify-end' : 'justify-start')}>
    <div className="p-3 rounded-xl flex items-center gap-1 shadow-sm" style={{ backgroundColor: color, borderBottomLeftRadius: align === 'start' ? '2px' : undefined, borderBottomRightRadius: align === 'end' ? '2px' : undefined }}>
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
      <div className="w-1.5 h-1.5 rounded-full bg-current typing-dot" style={{ color: textColor }} />
    </div>
  </div>
);

export default function ChatbotWidgetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storage = getStorage();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { hubId, botId } = params as { hubId: string; botId: string };
  const { appUser } = useAuth();

  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const [bot, setBot] = useState<BotDataWithAgents | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('riverr_chat_open') === 'true';
    }
    return false;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  
  const [identityCaptureStep, setIdentityCaptureStep] = useState<'none' | 'prompting' | 'collecting'>('none');
  const [capturedName, setCapturedName] = useState('');
  const [capturedEmail, setCapturedEmail] = useState('');

  const [attachments, setAttachments] = useState<File[]>([]);
  const [expandedSourceByMessageId, setExpandedSourceByMessageId] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const convoUnsubRef = useRef<(() => void) | null>(null);

  const visibleMessages = useMemo(() => {
    const list = messages
      .filter(isPublicForVisitor)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const lastMsg = list[list.length - 1];
    if (lastMsg && (lastMsg as any).meta?.type === 'identity_form' && identityCaptureStep === 'none') {
        if (!visitor?.email && !conversation?.visitorEmail) {
            setTimeout(() => setIdentityCaptureStep('collecting'), 100);
        }
    }

    return list;
  }, [messages, identityCaptureStep, visitor?.email, conversation?.visitorEmail]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'riverr_chat_open') {
        setIsChatOpen(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, isBotTyping, isAgentTyping, identityCaptureStep]);

  const markAsSeen = async () => {
    if (conversation && !document.hidden) {
      const now = new Date().toISOString();
      await db.updateConversation(conversation.id, { 
        lastVisitorSeenAt: now 
      });
    }
  };

  const updatePresence = async () => {
    if (conversation && !document.hidden) {
      await db.updateVisitorActivity(conversation.id);
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      markAsSeen();
      updatePresence();
    };
    const handleInteraction = () => updatePresence();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    markAsSeen(); 
    updatePresence();

    const heartbeat = setInterval(updatePresence, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      clearInterval(heartbeat);
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation || !parentOrigin) return;
    const lastSeen = conversation.lastVisitorSeenAt ? new Date(conversation.lastVisitorSeenAt).getTime() : 0;
    
    const unreadMessages = visibleMessages.filter(m => 
      (m.senderType === 'agent' || m.senderType === 'bot') && 
      new Date(m.timestamp).getTime() > lastSeen
    );
    
    if (window.parent) {
      window.parent.postMessage({ type: 'manowar-unread-count', count: unreadMessages.length }, parentOrigin);
    }
  }, [visibleMessages, conversation?.lastVisitorSeenAt, parentOrigin]);

  useEffect(() => {
    if (!conversation) return;
    const isHumanTyping = Object.entries(conversation.typing || {}).some(([uid, isTyping]) => 
      isTyping && uid !== (visitor?.id || 'visitor') && uid !== 'ai_agent'
    );
    setIsAgentTyping(isHumanTyping);
  }, [conversation?.typing, visitor?.id]);

  useEffect(() => {
    const handleIncomingMessage = async (event: MessageEvent) => {
      if (!parentOrigin && event.data && event.data.type === 'manowar-parent-hello') {
        if (!event.origin || event.origin === 'null') return;
        if (event.source !== window.parent) return;
        
        setParentOrigin(event.origin);
        window.parent.postMessage({ type: 'manowar-widget-ready' }, event.origin);
        return;
      }

      if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;

      if (event.data && event.data.type === 'manowar-identity-update') {
        const { contactId } = event.data.identity;
        if (contactId) {
          let vId = localStorage.getItem('manowar_chat_visitor_id');
          if (vId) await loadVisitorAndConversation(vId);
        }
      }

      if (event.data && event.data.type === 'manowar-identity-payload') {
        const payload = event.data.data;
        try {
          const res = await fetch('/api/widget/identity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              botId,
              hubId,
              anonymousVisitorId: localStorage.getItem('manowar_chat_visitor_id'),
              conversationId: conversation?.id
            })
          });
          const result = await res.json();
          if (result.contactId) {
             let vId = localStorage.getItem('manowar_chat_visitor_id');
             if (vId) await loadVisitorAndConversation(vId);
          }
        } catch (err) {
          console.error('[Manowar] Identity verification failed', err);
        }
      }
    };

    window.addEventListener('message', handleIncomingMessage);
    return () => window.removeEventListener('message', handleIncomingMessage);
  }, [parentOrigin, botId, hubId, conversation?.id]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

      try {
        const botSettingsResponse = await fetch(`/api/bot-settings?botId=${botId}`);
        if (!botSettingsResponse.ok) {
          console.error("Failed to fetch bot settings");
          setIsLoading(false);
          return;
        }
        const botSettings = await botSettingsResponse.json();

        const [fullBotDoc, hub] = await Promise.all([
          db.getBot(botId),
          db.getHub(hubId)
        ]);

        if (!fullBotDoc) {
          setIsLoading(false);
          return;
        }

        const combinedBotData = { ...fullBotDoc, ...botSettings };
        setBot(combinedBotData);

        if (hub) {
          setSpaceId(hub.spaceId);
        }

        let visitorId = localStorage.getItem('manowar_chat_visitor_id');
        if (!visitorId) {
          visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          localStorage.setItem('manowar_chat_visitor_id', visitorId);
        }
        await loadVisitorAndConversation(visitorId);
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      if (unsubRef.current) unsubRef.current();
      if (convoUnsubRef.current) convoUnsubRef.current();
    };
  }, [botId, hubId, appUser]);

  const loadVisitorAndConversation = async (visitorId: string) => {
    const referrer = typeof document !== 'undefined' ? document.referrer || window.location.href : '';
    let domain = '';
    let pathname = '';
    try {
      const url = new URL(referrer);
      domain = url.hostname;
      pathname = url.pathname;
    } catch { }

    const fetchedVisitor = await db.getOrCreateVisitor(visitorId, { location: { domain, pathname } });
    setVisitor(fetchedVisitor);

    const convos = await db.getConversationsForHub(hubId);
    const existingConvo = convos.find(c => c.visitorId === visitorId);

    if (existingConvo) {
      convoUnsubRef.current = db.getConversation(existingConvo.id, setConversation);
      unsubRef.current = db.getMessagesForConversations(
        [existingConvo.id],
        (msgs) => setMessages(msgs),
        true
      );
    }

    if (appUser && fetchedVisitor) {
      await db.updateVisitor(visitorId, {
        name: appUser.name,
        email: appUser.email,
        avatarUrl: appUser.avatarUrl,
      });
    }
  }

  const handleIdentitySubmit = async () => {
    const isEmailRequired = bot?.identityCapture?.askForEmail !== false;
    const email = capturedEmail.trim();
    const name = capturedName.trim();

    if ((bot?.identityCapture?.askForName && !name) || (isEmailRequired && !email)) {
      toast({
          variant: 'destructive',
          title: "Incomplete Information",
          description: `Please provide your details.`,
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      toast({
        variant: 'destructive',
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    let visitorId = localStorage.getItem('manowar_chat_visitor_id');
    if (!visitorId || !conversation) return;

    await db.updateVisitor(visitorId, { name, email });
    setIdentityCaptureStep('none');
    
    await ensureConversationCrmLinkedAction(conversation.id);
    await loadVisitorAndConversation(visitorId);

    await addChatMessageAction({
        conversationId: conversation.id,
        authorId: 'ai_agent',
        type: 'message',
        senderType: 'agent',
        responderType: 'automation',
        content: `Thanks${name ? ' ' + name : ''}! I've updated your info. How can I help?`,
        timestamp: new Date().toISOString(),
    });
    
    const incomingMessage: any = {
        id: `ident-${Date.now()}`,
        role: 'user',
        text: `My name is ${name} and my email is ${email}`,
        createdAt: new Date().toISOString()
    }
    
    setIsBotTyping(true);
    setTimeout(async () => {
      await invokeAgent({
          bot: {
            ...bot!,
            assignedAgentId: bot?.assignedAgentId,
          },
          conversation: { ...conversation, visitorName: name, visitorEmail: email },
          message: incomingMessage,
      });
      setIsBotTyping(false);
    }, 2000);

    setCapturedName('');
    setCapturedEmail('');
  }

  const uploadFileAndGetUrl = async (file: File, conversationId: string) => {
    const filePath = `chat_uploads/${conversationId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  };

  const handleSendMessage = async (customText?: string, meta?: any) => {
    console.log("[Chatbot] handleSendMessage called", { customText, identityCaptureStep, hasVisitor: !!visitor, hasSpaceId: !!spaceId, hasBot: !!bot });
    
    const textToSend = customText ?? messageText;
    if (!textToSend.trim() && attachments.length === 0) {
      console.log("[Chatbot] handleSendMessage - empty message, returning");
      return;
    }
    if (!visitor || !spaceId || !bot) {
      console.log("[Chatbot] handleSendMessage - missing required data", { visitor: !!visitor, spaceId: !!spaceId, bot: !!bot });
      return;
    }

    let currentConversation = conversation;
    setLoading(true);

    const isNewConversation = !currentConversation;

    if (isNewConversation) {
        const agentIds = bot.agentIds || [];
        const assigneeId = agentIds.length > 0 ? agentIds[Math.floor(Math.random() * agentIds.length)] : null;
        
        const newConvo = await createConversationAndLinkCrm({
            hubId,
            visitorId: visitor.id,
            assigneeId,
            lastMessage: textToSend || "Sent an attachment",
            lastMessageAuthor: visitor.name || null,
        });
        currentConversation = newConvo as any;

        convoUnsubRef.current = db.getConversation(newConvo.id, setConversation);
        unsubRef.current = db.getMessagesForConversations(
            [newConvo.id],
            (msgs) => setMessages(msgs),
            true
        );
    }
    
    if (!currentConversation) {
        setLoading(false);
        return;
    }

    await db.updateVisitorActivity(currentConversation.id);

    const messageAttachments: Attachment[] = [];
    for (const file of attachments) {
        try {
            const url = await uploadFileAndGetUrl(file, currentConversation.id);
            messageAttachments.push({
                id: `att_${Date.now()}_${file.name}`,
                name: file.name,
                url,
                type: file.type.startsWith('image/') ? 'image' : 'file',
            });
        } catch (err) {
            console.error("File upload failed:", err);
        }
    }

    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: currentConversation.id,
      authorId: visitor.id,
      type: 'message',
      senderType: 'visitor',
      content: textToSend,
      timestamp: new Date().toISOString(),
      attachments: messageAttachments,
    };
    await addChatMessageAction(newMessageData);
    
    if (!customText) setMessageText('');
    setAttachments([]);

    setLoading(false);

    if (identityCaptureStep === 'none') {
        const incomingMessage: any = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: textToSend,
            createdAt: newMessageData.timestamp,
            meta: meta,
        }

        try {
            setIsBotTyping(true);
            setTimeout(async () => {
              try {
                console.log("[Chatbot] Calling invokeAgent with message:", incomingMessage);
                await invokeAgent({
                    bot: bot,
                    conversation: JSON.parse(JSON.stringify(currentConversation)),
                    message: incomingMessage,
                });
                console.log("[Chatbot] invokeAgent completed successfully");
              } catch (err) {
                console.error("[Chatbot] invokeAgent failed:", err);
              } finally {
                setIsBotTyping(false);
              }
            }, 2500);
        } catch (e) {
            console.error("Agent failed to answer:", e);
            setIsBotTyping(false);
        }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    
    if (conversation) {
      db.setTypingStatus(conversation.id, visitor?.id || 'visitor', true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        db.setTypingStatus(conversation.id, visitor?.id || 'visitor', false);
      }, 3000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const handleClose = () => {
    if (window.parent) {
      window.parent.postMessage('close-manowar-chat', '*');
    }
  };

  const handleQuickReply = (btn: { id: string; label: string }) => {
    handleSendMessage(btn.label, { buttonId: btn.id });
  };

  const toggleSourceExpansion = (messageId: string) => {
    setExpandedSourceByMessageId(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  if (isLoading || !bot) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: bot?.styleSettings?.backgroundColor || '#111827' }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const bg = bot.styleSettings?.backgroundColor;
  const primary = bot.styleSettings?.primaryColor;
  const agentDisplayName = bot.webAgentName || bot.name || 'AI Assistant';

  return (
    <div
      className="w-full h-screen text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      <div className="p-3 border-b flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center gap-3">
          {bot.styleSettings?.logoUrl && (
            <img src={bot.styleSettings.logoUrl} alt="Bot Logo" className="h-8 w-8 object-contain rounded-full" />
          )}
          <div className="flex items-center gap-3">
            <h3 className="font-bold truncate text-base" style={{ color: bot.styleSettings?.headerTextColor || '#ffffff' }}>{agentDisplayName}</h3>
            {bot.agents && bot.agents.length > 0 && (
              <div className="flex -space-x-2 overflow-hidden ml-2">
                {bot.agents.map(agent => (
                  <Avatar key={agent.id} className="h-5 w-5 border-2" style={{ borderColor: bot.styleSettings?.backgroundColor }}>
                    <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                    <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={handleClose} style={{ color: primary }}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          <div className="flex flex-col items-start">
            <div className="flex items-end gap-2">
              <div className="p-3 rounded-xl rounded-bl-sm max-w-xs break-words" style={{ backgroundColor: bot.styleSettings?.agentMessageBackgroundColor || '#374151', color: bot.styleSettings?.agentMessageTextColor || '#ffffff' }}>
                <p className="text-sm whitespace-pre-wrap">{bot.welcomeMessage}</p>
              </div>
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mt-1">{agentDisplayName}</p>
          </div>

          {visibleMessages.map(msg => {
            const isAgent = msg.senderType === 'agent' || msg.senderType === 'bot';
            const agent = isAgent ? bot.agents?.find(u => u.id === msg.authorId) : null;
            const isAI = msg.responderType === 'ai';
            const isAutomation = msg.responderType === 'automation';
            const contentHtml = isAI ? marked.parse(msg.content) : msg.content;
            const meta = (msg as any).meta;
            const buttons = meta?.buttons as { id: string; label: string }[];
            const messageSources = Array.isArray(msg.sources)
              ? msg.sources.filter(s => typeof s?.url === 'string' && s.url.trim().length > 0)
              : [];
            const isSourceExpanded = !!expandedSourceByMessageId[msg.id];
            const visibleSourceLinks = isSourceExpanded ? messageSources : messageSources.slice(0, 1);

            if (msg.type === 'event') {
                return (
                    <div key={msg.id} className="flex justify-center py-2">
                        <span className="text-[10px] text-zinc-500 font-medium px-2 py-1 rounded bg-white/5 border border-white/5">
                            {msg.content}
                        </span>
                    </div>
                )
            }

            return (
              <div key={msg.id} className="space-y-2">
                <div className={cn('flex items-end gap-2 min-w-0', isAgent ? 'justify-start' : 'justify-end')}>
                    {isAgent ? (
                    <div className="min-w-0 flex flex-col items-start text-left">
                        <div className="p-3 rounded-xl rounded-bl-sm max-w-xs" style={{ backgroundColor: bot.styleSettings?.agentMessageBackgroundColor || '#374151', color: bot.styleSettings?.agentMessageTextColor || '#ffffff' }}>
                        {msg.content && <div className="text-sm prose prose-sm prose-invert max-w-none break-words overflow-hidden [&_a]:break-all [&_a]:whitespace-normal" style={{ color: bot.styleSettings?.agentMessageTextColor || '#ffffff' }} dangerouslySetInnerHTML={{ __html: contentHtml as string }} />}
                        {isAgent && messageSources.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2">
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Source</p>
                            {visibleSourceLinks.map(source => (
                              <a
                                key={`${msg.id}-${source.articleId}`}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] rounded-md border border-white/10 bg-black/20 px-2 py-1.5 flex items-center justify-between gap-2 hover:bg-black/30"
                              >
                                <span className="truncate flex-1 font-bold">{source.title}</span>
                                <ChevronRight className="h-3 w-3 opacity-40" />
                              </a>
                            ))}
                            {messageSources.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpansion(msg.id)}
                                className="text-[10px] uppercase font-black tracking-widest opacity-70 hover:opacity-100"
                              >
                                {isSourceExpanded ? 'See less' : `See more (${messageSources.length - 1})`}
                              </button>
                            ) : (
                              <a
                                href={messageSources[0].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex text-[10px] uppercase font-black tracking-widest opacity-80 hover:opacity-100"
                              >
                                See more
                              </a>
                            )}
                          </div>
                        )}
                        </div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mt-1">
                            {isAI ? `${agentDisplayName}` : isAutomation ? agentDisplayName : (agent?.name || 'Team member')}
                        </p>
                    </div>
                    ) : (
                    <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm break-all" style={{ backgroundColor: primary, color: bot.styleSettings?.customerTextColor || '#ffffff' }}>
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                    </div>
                    )}
                </div>
                {isAgent && buttons && buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-2">
                        {buttons.map(btn => (
                            <Button key={btn.id} variant="outline" size="sm" onClick={() => handleQuickReply(btn)} className="bg-transparent border-white/20 text-white hover:bg-white/10 rounded-full text-xs font-semibold h-8">
                                {btn.label} <ChevronRight className="h-3 w-3 ml-1 opacity-50" />
                            </Button>
                        ))}
                    </div>
                )}
              </div>
            );
          })}

          {identityCaptureStep === 'collecting' && (
              <div className="flex items-end gap-2 text-left">
                <div className="p-4 rounded-xl rounded-bl-sm max-w-xs break-words shadow-lg border border-white/10" style={{ backgroundColor: bot.styleSettings?.agentMessageBackgroundColor || '#374151', color: bot.styleSettings?.agentMessageTextColor || '#ffffff' }}>
                  <div className="space-y-3">
                    {bot.identityCapture?.askForName && (
                      <div className="space-y-1">
                          <Label className="text-xs uppercase font-bold tracking-wider opacity-70">Name</Label>
                          <Input type="text" placeholder="e.g. John Doe" value={capturedName} onChange={(e) => setCapturedName(e.target.value)} className="bg-zinc-800/50 border-white/10 text-white h-9 text-sm" />
                      </div>
                    )}
                    {bot.identityCapture?.askForEmail && (
                      <div className="space-y-1">
                          <Label className="text-xs uppercase font-bold tracking-wider opacity-70">Email</Label>
                          <Input type="email" placeholder="e.g. john@example.com" value={capturedEmail} onChange={(e) => setCapturedEmail(e.target.value)} className="bg-zinc-800/50 border-white/10 text-white h-9 text-sm" />
                      </div>
                    )}
                    {bot.identityCapture?.askForPhone && (
                      <div className="space-y-1">
                          <Label className="text-xs uppercase font-bold tracking-wider opacity-70">Phone</Label>
                          <Input type="tel" placeholder="+1..." className="bg-zinc-800/50 border-white/10 text-white h-9 text-sm" />
                      </div>
                    )}
                    <Button onClick={handleIdentitySubmit} size="sm" className="w-full mt-2 font-bold" style={{ backgroundColor: primary }}>
                        Submit Details
                    </Button>
                    {bot.identityCapture?.trigger !== 'before_escalation' && (
                        <Button variant="ghost" size="sm" className="w-full text-[10px] opacity-50 hover:bg-transparent" onClick={() => setIdentityCaptureStep('none')}>
                            Skip for now
                        </Button>
                    )}
                  </div>
                </div>
              </div>
           )}

          {(isBotTyping || isAgentTyping) && (
              <TypingBubble color={bot.styleSettings?.agentMessageBackgroundColor || '#374151'} textColor={bot.styleSettings?.agentMessageTextColor || '#ffffff'} />
            )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="p-2 border-t shrink-0 flex items-end gap-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <Plus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-1">
            <Button variant="ghost" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="mr-2 h-4 w-4" />
              Attachment
            </Button>
          </PopoverContent>
        </Popover>

        <div className="relative flex-1">
          <Textarea
            placeholder={identityCaptureStep === 'collecting' ? 'Please use the form above...' : 'Message...'}
            value={messageText}
            disabled={identityCaptureStep === 'collecting'}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            minRows={1}
            className="bg-zinc-800 border-zinc-700 text-white pr-10 resize-none text-[16px]"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleSendMessage()}
            disabled={(!messageText.trim() && attachments.length === 0) || loading || identityCaptureStep === 'collecting'}
            className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
