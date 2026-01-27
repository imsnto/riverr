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
import { answerChatQuestion } from '@/ai/flows/answer-chat-question';
import { marked } from 'marked';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


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
  const [chatStarted, setChatStarted] = useState(false);
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

      let visitorId = localStorage.getItem('riverr_chat_visitor_id');
      const fetchedVisitor = visitorId ? await db.getOrCreateVisitor(visitorId) : null;
      
      if (!appUser && combinedBotData?.identityCapture.enabled && (!fetchedVisitor || (!fetchedVisitor.name && !fetchedVisitor.email))) {
        setIsCapturingIdentity(true);
      } else {
        setIsCapturingIdentity(false);
        if (!visitorId) {
            visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            localStorage.setItem('riverr_chat_visitor_id', visitorId);
        }
        await loadVisitorAndConversation(visitorId);
      }
      setIsLoading(false);
    };

    initialize();

    return () => {
      if (unsubRef.current) unsubRef.current();
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
        setConversation(existingConvo);
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
      let visitorId = localStorage.getItem('riverr_chat_visitor_id');
      if (!visitorId) {
          visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          localStorage.setItem('riverr_chat_visitor_id', visitorId);
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
        const contact = await db.findOrCreateContact(spaceId, { email: visitor.email || undefined, name: visitor.name || undefined });

        await db.updateVisitor(visitor.id, { contactId: contact.id });
        setVisitor(v => v ? {...v, contactId: contact.id} : null);

        const agentIds = bot.agentIds || [];
        const assigneeId = agentIds.length > 0 ? agentIds[Math.floor(Math.random() * agentIds.length)] : null;
        
        const newConvoData: Omit<Conversation, 'id'> = {
            hubId,
            contactId: contact.id,
            visitorId: visitor.id,
            assigneeId,
            status: 'bot', // Start with bot
            lastMessage: messageText || "Sent an attachment",
            lastMessageAt: new Date().toISOString(),
            lastMessageAuthor: visitor.name,
        };

      const newConvo = await db.addConversation(newConvoData);
      setConversation(newConvo);
      currentConversation = newConvo;

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
    
    setMessageText('');
    setAttachments([]);
    setChatStarted(true);
    setLoading(false);

    await db.addChatMessage(newMessageData);

    setIsAiThinking(true);
    try {
        const aiResponse = await answerChatQuestion({
            question: userMessageContent,
            hubId: hubId,
            allowedHelpCenterIds: bot.allowedHelpCenterIds || [],
            userId: visitor.id,
        });

        if (aiResponse.suggestedNextStep === "escalate") {
          const handoffMessage = aiResponse.answer || "I'm connecting you with a team member who can help.";
          await db.addChatMessage({
              conversationId: currentConversation.id,
              authorId: 'ai_agent',
              type: 'message',
              senderType: 'agent',
              content: handoffMessage,
              timestamp: new Date().toISOString(),
          });
          await db.updateConversation(currentConversation.id, { status: 'human', escalated: true, escalationReason: "AI Escalation" });

        } else {
            let responseContent = aiResponse.answer;
            if (aiResponse.sources && aiResponse.sources.length > 0) {
                const sourcesText = aiResponse.sources.map(source => `- [${source.title}](${source.url})`).join('\n');
                responseContent += `\n\n**Sources:**\n${sourcesText}`;
            }
            
            const aiMessageData: Omit<ChatMessage, 'id'> = {
                conversationId: currentConversation.id,
                authorId: 'ai_agent',
                type: 'message',
                senderType: 'agent',
                content: responseContent,
                timestamp: new Date().toISOString(),
            };
            await db.addChatMessage(aiMessageData);
        }

    } catch (e) {
        console.error("AI failed to answer:", e);
        const errorMessageData: Omit<ChatMessage, 'id'> = {
            conversationId: currentConversation.id,
            authorId: 'ai_agent',
            type: 'message',
            senderType: 'agent',
            content: "Sorry, I encountered an error while trying to find an answer. Please try rephrasing your question.",
            timestamp: new Date().toISOString(),
        };
        await db.addChatMessage(errorMessageData);
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
      window.parent.postMessage('close-riverr-chat', '*');
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
        {/* Placeholder for left side to balance center */}
        <div className="w-8"></div>
        
        <div className="flex flex-col items-center">
            {bot.styleSettings?.logoUrl ? (
                <img src={bot.styleSettings.logoUrl} alt="Bot Logo" className="h-8 w-8 object-contain rounded-full" />
            ) : (
                <div className="h-8 w-8 shrink-0" />
            )}
            <h3 className="font-bold truncate text-base mt-1" style={{ color: bot.styleSettings?.headerTextColor || '#ffffff' }}>{bot.name}</h3>
            {bot.agents && bot.agents.length > 0 && (
                <div className="flex justify-center -space-x-2 overflow-hidden mt-1">
                    {bot.agents.map(agent => (
                        <Avatar key={agent.id} className="h-5 w-5 border-2" style={{ borderColor: bot.styleSettings?.backgroundColor }}>
                            <AvatarImage src={agent.avatarUrl} alt={agent.name} />
                            <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
            )}
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
            <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                <p className="text-sm whitespace-pre-wrap">{bot.welcomeMessage}</p>
            </div>
            </div>
            <p className="text-xs text-zinc-500">AI Agent</p>

            {(visibleMessages.length > 0) && visibleMessages.map(msg => {
                const isAgent = msg.senderType === 'agent';
                const agent = isAgent ? bot.agents?.find(u => u.id === msg.authorId) : null;
                const isAI = isAgent && msg.authorId === 'ai_agent';
                const contentHtml = isAI ? marked(msg.content) : msg.content;
                
                return (
                <div
                    key={msg.id}
                    className={cn('flex items-end gap-2', isAgent ? 'justify-start' : 'justify-end')}
                >
                    {isAgent ? (
                    <div>
                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                        {msg.content && <div className="text-sm prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: contentHtml as string }} />}
                        {renderAttachments(msg)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">{agent?.name || 'AI Agent'}</p>
                    </div>
                    ) : (
                    <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: primary, color: bot.styleSettings?.customerTextColor || '#ffffff' }}>
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
