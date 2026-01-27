
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Bot as BotData, Visitor, Conversation, ChatMessage, Attachment, Contact } from '@/lib/data';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, X, Loader2, Paperclip, ImageIcon, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const getInitials = (name?: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

// Customer widget MUST NEVER show internal-only content.
const isPublicForVisitor = (msg: ChatMessage) => {
  const anyMsg = msg as any;
  if (msg.type === 'note') return false;
  if (anyMsg.visibility && anyMsg.visibility !== 'public') return false;
  if (anyMsg.isInternal === true) return false;
  return true;
};

export default function ChatbotWidgetPage() {
  const params = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { hubId, botId } = params as { hubId: string; botId: string };
  const { appUser } = useAuth();

  const [bot, setBot] = useState<BotData | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [chatStarted, setChatStarted] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  
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
    }, [messages]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

      const [fetchedBot, hub] = await Promise.all([
        db.getBot(botId),
        db.getHub(hubId)
      ]);

      setBot(fetchedBot);
      if(hub) {
        setSpaceId(hub.spaceId);
      }


      // visitor id
      let visitorId = localStorage.getItem('riverr_chat_visitor_id');
      if (!visitorId) {
        visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        localStorage.setItem('riverr_chat_visitor_id', visitorId);
      }

      // referrer details (guard for empty referrer)
      const referrer = document.referrer || window.location.href;
      let domain = '';
      let pathname = '';
      try {
        const url = new URL(referrer);
        domain = url.hostname;
        pathname = url.pathname;
      } catch {
        // ignore
      }

      const fetchedVisitor = await db.getOrCreateVisitor(visitorId);
      setVisitor(fetchedVisitor);

      // Load / attach existing convo for this visitor
      const convos = await db.getConversationsForHub(hubId);
      const existingConvo = convos.find(c => c.visitorId === visitorId);

      if (existingConvo) {
        setConversation(existingConvo);

        // Subscribe to messages. Even if db says “public only”, we still filter client-side.
        unsubRef.current = db.getMessagesForConversations(
          [existingConvo.id],
          (msgs) => setMessages(msgs),
          true // Fetch public messages only (still filtered again on client)
        );
      }

      // Update visitor if known appUser (optional)
      if (appUser) {
        const details: any = {
          name: appUser.name,
          email: appUser.email,
          avatarUrl: appUser.avatarUrl,
          domain,
          pathname,
        };
        await db.updateVisitor(visitorId, details);
      }

      setIsLoading(false);
    };

    initialize();

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [botId, hubId, appUser]);

  const handleSendMessage = async () => {
    if (!messageText.trim() && attachments.length === 0) return;
    if (!visitor || !spaceId) return;

    let currentConversation = conversation;
    setLoading(true);

    if (!currentConversation) {
        let contactId = visitor.contactId;

        if (!contactId) {
            const newContactData: Omit<Contact, 'id'> = {
                tenantId: spaceId,
                name: visitor.name || null,
                emails: visitor.email ? [visitor.email] : [],
                primaryEmail: visitor.email || null,
                phones: [],
                primaryPhone: null,
                company: null,
                source: 'chat',
                externalIds: { visitorId: visitor.id },
                tags: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                lastSeenAt: new Date(),
                lastMessageAt: new Date(),
                lastOrderAt: null,
                lastCallAt: null,
                mergeParentId: null,
                isMerged: false,
            };

            const newContact = await db.addContact(newContactData);
            contactId = newContact.id;
            await db.updateVisitor(visitor.id, { contactId });
            setVisitor(v => v ? {...v, contactId} : null);
        }

        const newConvoData: Omit<Conversation, 'id'> = {
            hubId,
            contactId: contactId,
            visitorId: visitor.id,
            assigneeId: null,
            status: 'unassigned',
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
    
    // This is a simplified attachment handling. In a real app, you'd upload to cloud storage.
    const messageAttachments: Attachment[] = attachments.map(file => ({
      id: `att_${Date.now()}_${file.name}`,
      name: file.name,
      url: URL.createObjectURL(file), // Temporary URL
      type: file.type.startsWith('image/') ? 'image' : 'file',
    }));

    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: currentConversation.id,
      authorId: visitor.id,
      type: 'message',
      senderType: 'contact',
      content: messageText,
      timestamp: new Date().toISOString(),
      attachments: messageAttachments,
    };

    await db.addChatMessage(newMessageData);
    setMessageText('');
    setAttachments([]);
    setChatStarted(true);
    setLoading(false);
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


  const promptButtons = bot?.promptButtons || [];

  const handlePromptClick = (text: string) => {
    setMessageText(text);
    setChatStarted(true);
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
            <h3 className="font-bold truncate text-sm mt-1" style={{ color: bot.styleSettings?.headerTextColor || '#ffffff' }}>{bot.name}</h3>
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

            {(visibleMessages.length === 0 && !chatStarted) ? (
            <div className="pt-2 space-y-2">
                {promptButtons.map((prompt, index) => (
                <Button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    variant="outline"
                    className="w-full justify-center bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white rounded-md"
                >
                    {prompt}
                </Button>
                ))}
            </div>
            ) : (
            visibleMessages.map(msg => {
                const isAgent = msg.senderType === 'agent';
                return (
                <div
                    key={msg.id}
                    className={cn('flex items-end gap-2', isAgent ? 'justify-start' : 'justify-end')}
                >
                    {isAgent ? (
                    <div>
                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        {renderAttachments(msg)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">AI Agent</p>
                    </div>
                    ) : (
                    <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: primary, color: bot.styleSettings?.customerTextColor || '#ffffff' }}>
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        {renderAttachments(msg)}
                    </div>
                    )}
                </div>
                );
            })
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
