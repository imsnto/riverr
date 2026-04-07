// src/components/dashboard/chatbot/[hubId]/[botId]/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Bot as BotData, Visitor, Conversation, ChatMessage, Attachment, Contact, User } from '@/lib/data';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, X, Loader2, Paperclip, ImageIcon, File as FileIcon, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { marked } from 'marked';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { invokeAgent } from '@/app/actions/chat';


interface BotDataWithAgents extends BotData {
  agents?: User[];
}


const getInitials = (name?: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

// Customer widget MUST NEVER show internal-only content.
const isPublicForVisitor = (msg: ChatMessage) => {
  if (msg.visibility === 'internal' || msg.isInternal) return false;
  if (msg.type === 'note') return false;
  return true;
};

export default function ChatbotWidgetPage() {
  const params = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { hubId, botId } = params as { hubId: string; botId: string };
  const { appUser } = useAuth();

  const [bot, setBot] = useState<BotDataWithAgents | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isCapturingIdentity, setIsCapturingIdentity] = useState(false);
  const [capturedName, setCapturedName] = useState('');
  const [capturedEmail, setCapturedEmail] = useState('');
  
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const convoUnsubRef = useRef<(() => void) | null>(null);

  const visibleMessages = useMemo(() => {
    return messages
      .filter(isPublicForVisitor)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isAiThinking]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

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
      
      if(hub) {
        setSpaceId(hub.spaceId);
      }

      let visitorId = localStorage.getItem('manowar_chat_visitor_id');
      const fetchedVisitor = visitorId ? await db.getOrCreateVisitor(visitorId) : null;
      
      if (!appUser && combinedBotData?.identityCapture.enabled && (!fetchedVisitor || (!fetchedVisitor.name && !fetchedVisitor.email))) {
        setIsCapturingIdentity(true);
      } else {
        setIsCapturingIdentity(false);
        if (!visitorId) {
            visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            localStorage.setItem('manowar_chat_visitor_id', visitorId);
        }
        await loadVisitorAndConversation(visitorId);
      }
      setIsLoading(false);
    };

    initialize();

    return () => {
      if (unsubRef.current) unsubRef.current();
      if (convoUnsubRef.current) convoUnsubRef.current();
    };
  }, [botId, hubId, appUser]);

  const loadVisitorAndConversation = async (visitorId: string) => {
      const referrer = document.referrer || window.location.href;
      let domain = '';
      let pathname = '';
      try {
        const url = new URL(referrer);
        domain = url.hostname;
        pathname = url.pathname;
      } catch {}

      const fetchedVisitor = await db.getOrCreateVisitor(visitorId, { location: { domain, pathname }});
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
      if (!capturedName.trim() || !capturedEmail.trim()) {
          // You might want to show an error message
          return;
      }
      let visitorId = localStorage.getItem('manowar_chat_visitor_id');
      if (!visitorId) {
          visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          localStorage.setItem('manowar_chat_visitor_id', visitorId);
      }
      
      await db.updateVisitor(visitorId, { name: capturedName, email: capturedEmail });
      setIsCapturingIdentity(false);
      await loadVisitorAndConversation(visitorId);
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && attachments.length === 0) return;
    if (!visitor || !spaceId || !bot) return;

    let currentConversation = conversation;
    setLoading(true);

    if (!currentConversation) {
        const agentIds = bot.agentIds || [];
        const assigneeId = agentIds.length > 0 ? agentIds[Math.floor(Math.random() * agentIds.length)] : null;
        
        const newConvoData: Omit<Conversation, 'id'> = {
            hubId,
            contactId: null, // This will be backfilled by the backend logic
            visitorId: visitor.id,
            assigneeId,
            status: 'bot', // Start with bot
            state: 'ai_active',
            lastMessage: messageText || "Sent an attachment",
            lastMessageAt: new Date().toISOString(),
            lastMessageAuthor: visitor.name,
            reopenCount: 0,
        };

      const newConvo = await db.addConversation(newConvoData);
      currentConversation = newConvo;

      convoUnsubRef.current = db.getConversation(newConvo.id, setConversation);
      unsubRef.current = db.getMessagesForConversations(
        [newConvo.id],
        (msgs) => setMessages(msgs),
        true
      );
    }
    
    const messageAttachments: Attachment[] = attachments.map(file => ({
      id: `att_${Date.now()}_${file.name}`,
      name: file.name,
      url: URL.createObjectURL(file), // Temporary URL
      type: file.type.startsWith('image/') ? 'image' : 'file',
    }));

    const userMessageContent = messageText;
    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: currentConversation.id,
      authorId: visitor.id,
      type: 'message',
      senderType: 'contact',
      content: userMessageContent,
      timestamp: new Date().toISOString(),
      attachments: messageAttachments,
    };
    
    const incomingMessage: any = {
        id: `msg-${Date.now()}`,
        role: 'user',
        text: userMessageContent,
        createdAt: newMessageData.timestamp
    }
    
    setMessageText('');
    setAttachments([]);
    setLoading(false);

    await db.addChatMessage(newMessageData);

    setIsAiThinking(true);
    
    const botConfig = {
      id: bot.id,
      hubId: bot.hubId,
      name: bot.name,
      allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
    };
    
    try {
      console.log({botConfig, currentConversation, incomingMessage})
        await invokeAgent({
            bot: botConfig,
            conversation: JSON.parse(JSON.stringify(currentConversation)),
            message: incomingMessage,
        });
        setIsAiThinking(false);
    } catch (e) {
        console.error("Agent failed to answer:", e);
    } finally {
        setIsAiThinking(false);
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
  
  if (isCapturingIdentity) {
      return (
          <div className="w-full h-screen text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden p-4 justify-center items-center" style={{ backgroundColor: bg }}>
              <div className="w-full max-w-sm space-y-4">
                  <p className="text-center">{bot.identityCapture?.captureMessage || 'Before we start, could I get your name and email?'}</p>
                  <Input type="text" placeholder="Your name" value={capturedName} onChange={(e) => setCapturedName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                  <Input type="email" placeholder="Your email" value={capturedEmail} onChange={(e) => setCapturedEmail(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                  <Button onClick={handleIdentitySubmit} className="w-full" style={{ backgroundColor: primary }}>Start Chat</Button>
                  {!bot.identityCapture.required && <Button variant="link" className="w-full text-zinc-400" onClick={() => setIsCapturingIdentity(false)}>Skip for now</Button>}
              </div>
          </div>
      )
  }

  const renderAttachments = (msg: ChatMessage) => {
    if (!msg.attachments || msg.attachments.length === 0) return null;
    
    return (
      <div className="mt-2 space-y-2">
        {msg.attachments.map(att => (
          <div key={att.id}>
            {att.type === 'image' ? (
              <img src={att.url} alt={att.name} className="rounded-lg max-w-xs max-h-64 object-cover" />
            ) : (
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-white hover:underline bg-zinc-700/50 p-2 rounded-md max-w-xs">
                <FileIcon className="h-4 w-4" />
                <span className="truncate">{att.name}</span>
              </a>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="w-full h-screen text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center gap-3">
          {bot.styleSettings?.logoUrl && (
            <img src={bot.styleSettings.logoUrl} alt="Bot Logo" className="h-8 w-8 object-contain rounded-full" />
          )}
          <div className="flex items-center gap-3">
            <h3 className="font-bold truncate text-base" style={{ color: bot.styleSettings?.headerTextColor || '#ffffff' }}>{bot.name}</h3>
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

        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
            {/* Welcome bubble (always visible) */}
            <div className="flex items-end gap-2">
            <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs break-words">
                <p className="text-sm whitespace-pre-wrap">{bot.welcomeMessage}</p>
            </div>
            </div>
            <p className="text-xs text-zinc-500">AI Agent</p>

            {(visibleMessages.length > 0) && visibleMessages.map(msg => {
                const isAgent = msg.senderType === 'agent';
                const agent = isAgent ? bot.agents?.find(u => u.id === msg.authorId) : null;
                const isAI = isAgent && msg.authorId === 'ai_agent';
                const contentHtml = isAI ? marked.parse(msg.content) : msg.content;
                
                return (
                <div
                    key={msg.id}
                    className={cn('flex items-end gap-2 min-w-0', isAgent ? 'justify-start' : 'justify-end')}
                >
                    {isAgent ? (
                    <div className="min-w-0">
                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                        {msg.content && <div className="text-sm prose prose-sm prose-invert max-w-none break-words overflow-hidden [&_a]:break-all [&_a]:whitespace-normal [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-x-auto [&_code]:break-words" dangerouslySetInnerHTML={{ __html: contentHtml as string }} />}
                        {renderAttachments(msg)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">{agent?.name || 'AI Agent'}</p>
                    </div>
                    ) : (
                    <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm break-all" style={{ backgroundColor: primary, color: bot.styleSettings?.customerTextColor || '#ffffff' }}>
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        {renderAttachments(msg)}
                    </div>
                    )}
                </div>
                );
            })}
            {isAiThinking && (
              <div className="flex items-end gap-2">
                <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs flex items-center gap-2">
                  <Bot className="h-4 w-4 animate-pulse" />
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t shrink-0 flex items-end gap-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                    <Plus className="h-5 w-5"/>
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
            {attachments.length > 0 && (
                <div className="p-2 space-y-1">
                {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm bg-zinc-800 p-2 rounded-md">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {file.type.startsWith('image/') ? (
                        <ImageIcon className="h-4 w-4 flex-shrink-0" />
                        ) : (
                        <FileIcon className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachments(attachments.filter((_, index) => index !== i))}>
                        <X className="h-4 w-4" />
                    </Button>
                    </div>
                ))}
                </div>
            )}
            <Textarea
                placeholder={'Message...'}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
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
                onClick={handleSendMessage}
                disabled={(!messageText.trim() && attachments.length === 0) || loading}
                className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700"
            >
                {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className="h-4 w-4" />}
            </Button>
        </div>
      </div>
    </div>
  );
}
