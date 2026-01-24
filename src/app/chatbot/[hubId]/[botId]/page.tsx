
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Bot as BotData, Visitor, Conversation, ChatMessage } from '@/lib/data';
import * as db from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, Home, Ticket, ChevronLeft, MoreHorizontal, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export default function ChatbotWidgetPage() {
    const params = useParams();
    const { hubId, botId } = params as { hubId: string, botId: string };
    const { appUser } = useAuth();
    const [bot, setBot] = useState<BotData | null>(null);
    const [visitor, setVisitor] = useState<Visitor | null>(null);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [chatStarted, setChatStarted] = useState(false);
    const [messageText, setMessageText] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);

            const fetchedBot = await db.getBot(botId);
            setBot(fetchedBot);

            let visitorId = localStorage.getItem('riverr_chat_visitor_id');
            if (!visitorId) {
                visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
                localStorage.setItem('riverr_chat_visitor_id', visitorId);
            }
            const referrer = document.referrer;
            const url = new URL(referrer);
            let details = {
                domain: url.hostname,
                pathname: url.pathname
            };

            const fetchedVisitor = await db.getOrCreateVisitor(visitorId);
            setVisitor(fetchedVisitor);

            const convos = await db.getConversationsForHub(hubId);
            const existingConvo = convos.find(c => c.visitorId === visitorId);

            if (existingConvo) {
                setConversation(existingConvo);
                unsubRef.current = db.getMessagesForConversations(
                    [existingConvo.id], 
                    (msgs) => setMessages(msgs)
                );
            }
            if(appUser){
                details = {
                    name: appUser.name,
                    email: appUser.email,
                    avatarUrl: appUser.avatarUrl,
                    domain: url.hostname,
                    pathname: url.pathname
                }
                await db.updateVisitor(visitorId, details)
            }
            setIsLoading(false);
        };
        initialize();
        return () => {
            if (unsubRef.current) unsubRef.current();
        };
    }, [botId, hubId,appUser]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!messageText.trim() || !visitor) return;

        let currentConversation = conversation;
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
                (msgs) => setMessages(msgs)
            );
        }

        const newMessageData: Omit<ChatMessage, 'id'> = {
            conversationId: currentConversation.id,
            authorId: visitor.id,
            type: 'message',
            senderType: 'contact',
            content: messageText,
            timestamp: new Date().toISOString(),
        };

        await db.addChatMessage(newMessageData);
        setMessageText('');
    };

    if (isLoading || !bot) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ backgroundColor: bot?.styleSettings?.backgroundColor || '#111827' }}>
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        )
    }

    const promptButtons = bot.promptButtons || [];

    const handlePromptClick = (text: string) => {
        setMessageText(text);
        setChatStarted(true);
        // We can optionally send the message right away
        // handleSendMessage(); 
    };

    return (
        <div className="w-full h-screen text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: bot.styleSettings?.backgroundColor }}>
            {/* Header */}
            <div className="p-3 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" disabled>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                {bot.styleSettings?.logoUrl ? (
                    <img src={bot.styleSettings.logoUrl} alt="Bot Logo" className="h-6 w-6 object-contain" />
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-white">
                        <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M12 2L13.84 7.64L19.5 9.5L13.84 11.36L12 17L10.16 11.36L4.5 9.5L10.16 7.64L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" transform="rotate(90 12 12)" />
                    </svg>
                )}
                <div>
                    <h3 className="font-bold text-white">{bot.name}</h3>
                    <p className="text-xs text-zinc-400">We'll reply as soon as we can</p>
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
                    <div className="flex items-end gap-2">
                        <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                            <p className="text-sm whitespace-pre-wrap">{bot.welcomeMessage}</p>
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500">AI Agent</p>

                    {(messages.length === 0 && !chatStarted) ? (
                        <div className="pt-2 space-y-2">
                            {promptButtons.map((prompt, index) => (
                                <Button key={index} onClick={() => handlePromptClick(prompt)} variant="outline" className="w-full justify-center bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white rounded-md">
                                    {prompt}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex items-end gap-2 ${msg.senderType === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                {
                                    msg.senderType === 'agent' ? (
                                        <div>
                                            <div className="bg-zinc-800 p-3 rounded-xl rounded-bl-sm max-w-xs">
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-2">AI Agent</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl p-3 max-w-xs text-white rounded-br-sm" style={{ backgroundColor: bot.styleSettings?.primaryColor }}>
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        </div>

                                    )
                                }
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t shrink-0 space-y-3" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                {(chatStarted || messages.length > 0) ? (
                    <div className="relative">
                        <Textarea
                            placeholder="Message..."
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            minRows={1}
                            className="bg-zinc-800 border-zinc-700 text-white pr-10"
                        />
                        <Button size="icon" variant="ghost" onClick={handleSendMessage} disabled={!messageText.trim()} className="absolute right-1 bottom-1 h-8 w-8 hover:bg-zinc-700">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="text-center">
                        <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white" onClick={() => setChatStarted(true)}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send us a message
                        </Button>
                    </div>
                )}
                <div className="flex justify-between items-center text-xs text-zinc-500">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }} disabled>
                            <Home className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }} disabled>
                            <MessageSquare className="h-5 w-5" />
                        </Button>
                        {bot.spaces?.tickets && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => { if (!chatStarted) setChatStarted(true); }} disabled>
                                <Ticket className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                    <a href="#" className="underline" onClick={e => e.preventDefault()}>We run on Riverr</a>
                </div>
            </div>
        </div>
    );
}
