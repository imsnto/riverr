'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Bot as BotData, Visitor, Conversation, ChatMessage } from '@/lib/data';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, Home, Ticket, ChevronLeft, MoreHorizontal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

type ViewMode = 'chat' | 'tickets';

type TicketLite = {
  id: string;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const getInitials = (name?: string) => {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

// Customer widget MUST NEVER show internal-only content.
// We filter by msg.type === 'note' AND also allow future expansion (visibility/internal flag).
const isPublicForVisitor = (msg: ChatMessage) => {
  const anyMsg = msg as any;
  if (msg.type === 'note') return false;
  if (anyMsg.visibility && anyMsg.visibility !== 'public') return false;
  if (anyMsg.isInternal === true) return false;
  return true;
};

export default function ChatbotWidgetPage() {
  const params = useParams();
  const { hubId, botId } = params as { hubId: string; botId: string };
  const { appUser } = useAuth();

  const [bot, setBot] = useState<BotData | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tickets, setTickets] = useState<TicketLite[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  const [isLoading, setIsLoading] = useState(true);
  const [chatStarted, setChatStarted] = useState(false);
  const [messageText, setMessageText] = useState('');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // --- Derived: safe messages for visitor ---
  const visibleMessages = useMemo(() => {
    // sort defensively if your snapshot doesn’t guarantee order
    return messages
      .filter(isPublicForVisitor)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

      const fetchedBot = await db.getBot(botId);
      setBot(fetchedBot);

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

        // Tickets: load for this conversation if ticketing enabled
        if (fetchedBot?.spaces?.tickets) {
          try {
            const t = await (db as any).getTicketsForConversation?.(existingConvo.id);
            if (Array.isArray(t)) setTickets(t);
          } catch {
            // ignore until ticket functions exist
          }
        }
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

  // Auto-scroll on new visible messages (chat view only)
  useEffect(() => {
    if (viewMode !== 'chat') return;
    if (!scrollAreaRef.current) return;

    const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [visibleMessages.length, viewMode]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !visitor) return;

    let currentConversation = conversation;

    // Create conversation if needed
    if (!currentConversation) {
      const newConvoData: Omit<Conversation, 'id'> = {
        hubId,
        contactId: null,
        visitorId: visitor.id,
        assigneeId: null,
        status: 'unassigned',
        lastMessage: messageText,
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

      // also load tickets for new convo
      if (bot?.spaces?.tickets) {
        try {
          const t = await (db as any).getTicketsForConversation?.(newConvo.id);
          if (Array.isArray(t)) setTickets(t);
        } catch {
          // ignore
        }
      }
    }

    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: currentConversation.id,
      authorId: visitor.id,
      type: 'message', // customer can only send public messages
      senderType: 'contact',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    await db.addChatMessage(newMessageData);
    setMessageText('');
    setChatStarted(true);
    setViewMode('chat');
  };

  const promptButtons = bot?.promptButtons || [];

  const handlePromptClick = (text: string) => {
    setMessageText(text);
    setChatStarted(true);
    setViewMode('chat');
  };

  // Tickets actions
  const refreshTickets = async (conversationId: string) => {
    if (!bot?.spaces?.tickets) return;
    try {
      const t = await (db as any).getTicketsForConversation?.(conversationId);
      if (Array.isArray(t)) setTickets(t);
    } catch {
      // ignore
    }
  };

  const handleCreateTicket = async () => {
    if (!bot?.spaces?.tickets) return;
    if (!conversation || !visitor) return;

    try {
      // You implement this in db: create ticket linked to conversationId + visitorId
      const created = await (db as any).createTicketFromConversation?.({
        hubId,
        conversationId: conversation.id,
        visitorId: visitor.id,
        title: `Support request from ${visitor.name || 'Visitor'}`,
      });

      if (created) {
        await refreshTickets(conversation.id);
        setViewMode('tickets');
      }
    } catch {
      // If not implemented yet, do nothing (but keep UI)
      console.warn('Ticket creation not implemented in db yet.');
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

  return (
    <div
      className="w-full h-screen text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {bot.styleSettings?.logoUrl ? (
          <img src={bot.styleSettings.logoUrl} alt="Bot Logo" className="h-6 w-6 object-contain" />
        ) : (
          <div className="h-6 w-6 shrink-0" />
        )}

        <div className="min-w-0">
          <h3 className="font-bold text-white truncate">{bot.name}</h3>
          <p className="text-xs text-zinc-400 truncate">
            {viewMode === 'tickets' ? 'Tickets' : "We'll reply as soon as we can"}
          </p>
        </div>

        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-2">
          {viewMode === 'chat' && (
            <>
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
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2">AI Agent</p>
                        </div>
                      ) : (
                        <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: primary }}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {viewMode === 'tickets' && (
            <>
              {!bot.spaces?.tickets ? (
                <div className="text-sm text-zinc-300">
                  Ticketing is not enabled for this bot.
                </div>
              ) : !conversation ? (
                <div className="text-sm text-zinc-300">
                  Start a chat first so we can attach tickets to your conversation.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Your tickets</p>
                    <Button
                      size="sm"
                      className="bg-zinc-800 hover:bg-zinc-700 text-white"
                      onClick={handleCreateTicket}
                      disabled={!conversation}
                    >
                      Create ticket
                    </Button>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="text-sm text-zinc-300">
                      No tickets yet. Create one if you need tracked support.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map(t => (
                        <div key={t.id} className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">
                              {t.title || 'Support Ticket'}
                            </p>
                            <span className="text-[11px] text-zinc-400 shrink-0">
                              {t.status || 'open'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            Ticket ID: {t.id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t shrink-0 space-y-3" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        {(chatStarted || visibleMessages.length > 0) ? (
          <div className="relative">
            <Textarea
              placeholder={viewMode === 'tickets' ? 'Switch to chat to message…' : 'Message...'}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (viewMode !== 'chat') return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              minRows={1}
              className="bg-zinc-800 border-zinc-700 text-white pr-10"
              disabled={viewMode !== 'chat'}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSendMessage}
              disabled={viewMode !== 'chat' || !messageText.trim()}
              className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <Button
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
              onClick={() => { setChatStarted(true); setViewMode('chat'); }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send us a message
            </Button>
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex justify-between items-center text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 hover:bg-zinc-700", viewMode === 'chat' && "bg-zinc-800")}
              onClick={() => { if (!chatStarted) setChatStarted(true); setViewMode('chat'); }}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>

            {bot.spaces?.tickets && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 hover:bg-zinc-700", viewMode === 'tickets' && "bg-zinc-800")}
                onClick={() => { if (!chatStarted) setChatStarted(true); setViewMode('tickets'); }}
              >
                <Ticket className="h-5 w-5" />
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
              <Home className="h-5 w-5" />
            </Button>
          </div>

          {/* Optional “Create ticket” quick action when enabled */}
          {bot.spaces?.tickets && conversation && (
            <Button
              size="sm"
              className="bg-zinc-800 hover:bg-zinc-700 text-white"
              onClick={handleCreateTicket}
            >
              Create ticket
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
