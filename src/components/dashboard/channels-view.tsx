"use client";

import React, { useState, useEffect, useRef } from "react";
import { Channel, Message, User, Attachment, Task, Status } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Send,
  MessageCircleMore,
  Paperclip,
  File,
  ImageIcon,
  SmilePlus,
  MessageSquare,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

const getInitials = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
};

const renderMessageContent = (content: string, allUsers: User[]) => {
  const parts = content.split(/(@[\w\s]+)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const userName = part.substring(1).trim();
      const user = allUsers.find((u) => u.name === userName);
      if (user) {
        return (
          <strong key={index} className="text-primary font-semibold">
            @{user.name}
          </strong>
        );
      }
    }
    return part;
  });
};

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😥", "🙏"];

interface ChannelsViewProps {
  channels: Channel[];
  messages: Message[];
  allUsers: User[];
  tasks: Task[];
  activeChannelId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onCreateTask: (message: Message) => void;
  onViewThread: (message: Message) => void;
  statuses: Status[];
  onAddMessage: (message: Omit<Message, "id">) => Promise<void>;
}

export default function ChannelsView({
  channels,
  messages,
  allUsers,
  tasks,
  activeChannelId,
  setMessages,
  onCreateTask,
  onViewThread,
  statuses,
  onAddMessage,
}: ChannelsViewProps) {
  const { appUser } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [isTagging, setIsTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "div[data-radix-scroll-area-viewport]"
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, activeChannelId]);

  const activeChannel = channels.find(
    (c) => String(c.id) === String(activeChannelId)
  );

  if (!activeChannel) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-xl font-semibold">Welcome to Channels!</h3>
          <p className="text-muted-foreground">
            Select a channel from the list on the left to view messages or start
            a new conversation.
          </p>
        </div>
      </div>
    );
  }

  const channelMessages = messages.filter(
    (m) => String(m.channel_id) === String(activeChannelId) && !m.thread_id
  );
  const channelMembers = allUsers.filter((u) =>
    activeChannel.members.includes(u.id)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Detect an active "@mention" at end of line/token
    const mentionMatch = value.match(/(?:^|\s)@([^\s@]*)$/);
    if (mentionMatch) {
      setIsTagging(true);
      setTagQuery(mentionMatch[1]); // the partial after @
    } else {
      setIsTagging(false);
      setTagQuery("");
    }
  };

  const handleUserTag = (userName: string) => {
    // replace the last active mention token
    setNewMessage((prev) =>
      prev.replace(/(?:^|\s)@([^\s@]*)$/, (m, g1) => {
        const lead = m.startsWith("@") ? "" : m[0]; // keep leading space if present
        return `${lead}@${userName} `;
      })
    );
    setIsTagging(false);
    messageInputRef.current?.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && attachments.length === 0) ||
      !activeChannelId ||
      !appUser
    )
      return;

    const newAttachments: Attachment[] = attachments.map((file) => ({
      id: `att-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file), // In a real app, this would be an upload URL
      type: file.type.startsWith("image/") ? "image" : "file",
    }));

    const messageData: Omit<Message, "id"> = {
      channel_id: activeChannelId,
      user_id: appUser.id,
      content: newMessage,
      timestamp: new Date().toISOString(),
      attachments: newAttachments,
      reactions: [],
    };

    setNewMessage("");
    setAttachments([]);
    setIsTagging(false);

    await onAddMessage(messageData);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!appUser) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          const reactions = m.reactions ? [...m.reactions] : [];
          const existingReaction = reactions.find((r) => r.emoji === emoji);

          if (existingReaction) {
            if (existingReaction.user_ids.includes(appUser.id)) {
              // User is removing their reaction
              existingReaction.count--;
              existingReaction.user_ids = existingReaction.user_ids.filter(
                (id) => id !== appUser.id
              );
              if (existingReaction.count === 0) {
                return {
                  ...m,
                  reactions: reactions.filter((r) => r.emoji !== emoji),
                };
              }
            } else {
              // User is adding to an existing reaction
              existingReaction.count++;
              existingReaction.user_ids.push(appUser.id);
            }
          } else {
            // New reaction
            reactions.push({ emoji, count: 1, user_ids: [appUser.id] });
          }
          return { ...m, reactions };
        }
        return m;
      })
    );
  };

  const filteredMembers = channelMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(tagQuery.toLowerCase()) &&
      member.id !== appUser?.id
  );

  const renderMessage = (message: Message) => {
    const user = allUsers.find((u) => String(u.id) === String(message.user_id));
    const threadReplies = messages.filter(
      (m) => String(m.thread_id) === String(message.id)
    );

    const uniqueReplierIds = new Set(threadReplies.map((r) => r.user_id));
    const repliers = allUsers.filter((u) => uniqueReplierIds.has(u.id));

    const linkedTask = message.linked_task_id
      ? tasks.find((t) => String(t.id) === String(message.linked_task_id))
      : null;
    const taskStatus = linkedTask
      ? statuses.find((s) => s.name === linkedTask.status)
      : null;

    return (
      <div
        key={message.id}
        className="flex items-start gap-3 group p-2 rounded-md"
        onMouseEnter={() => setHoveredMessageId(message.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.avatarUrl} />
          <AvatarFallback>{user ? getInitials(user.name) : "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{user?.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {message.content && (
            <p className="text-sm">
              {renderMessageContent(message.content, allUsers)}
            </p>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att) => (
                <div key={att.id}>
                  {att.type === "image" ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="rounded-lg max-w-xs max-h-64 object-cover"
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline bg-primary/10 p-2 rounded-md max-w-xs"
                    >
                      <File className="h-4 w-4" />
                      <span className="truncate">{att.name}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {linkedTask && taskStatus && (
            <div className="mt-2">
              <Badge
                style={{
                  backgroundColor: taskStatus.color,
                  color: "white", // A simple default, might need adjustment for light colors
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                Task: {linkedTask.name} is{" "}
                <span className="font-semibold ml-1">{linkedTask.status}</span>
              </Badge>
            </div>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.reactions.map((reaction) => (
                <Button
                  key={reaction.emoji}
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full"
                  onClick={() => handleReaction(message.id, reaction.emoji)}
                >
                  {reaction.emoji}{" "}
                  <span className="ml-1 text-xs">{reaction.count}</span>
                </Button>
              ))}
            </div>
          )}
          {threadReplies.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm flex-nowrap">
              <div className="flex -space-x-2">
                {repliers.slice(0, 3).map((replyUser) => (
                  <Avatar
                    key={replyUser.id}
                    className="h-5 w-5 border-2 border-background"
                  >
                    <AvatarImage src={replyUser?.avatarUrl} />
                    <AvatarFallback>
                      {replyUser ? getInitials(replyUser.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary font-semibold whitespace-nowrap"
                onClick={() => onViewThread(message)}
              >
                {threadReplies.length}{" "}
                {threadReplies.length > 1 ? "replies" : "reply"}
              </Button>
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                Last reply today at{" "}
                {new Date(
                  threadReplies[threadReplies.length - 1].timestamp
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-card border rounded-full px-2 py-1",
            { "opacity-100": hoveredMessageId === message.id }
          )}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <SmilePlus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
              <div className="flex gap-1">
                {EMOJI_LIST.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-lg"
                    onClick={() => handleReaction(message.id, emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewThread(message)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCreateTask(message)}
          >
            <MessageCircleMore className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <span>More actions...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b flex-shrink-0">
        <h3 className="text-lg font-semibold">#{activeChannel.name}</h3>
        <p className="text-sm text-muted-foreground">
          {activeChannel.description}
        </p>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <div className="p-4 space-y-1">
          {channelMessages.map(renderMessage)}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-card flex-shrink-0">
        {attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded-md"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <File className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setAttachments(
                      attachments.filter((_, index) => index !== i)
                    )
                  }
                >
                  &times;
                </Button>
              </div>
            ))}
          </div>
        )}
        <Popover open={isTagging} onOpenChange={setIsTagging}>
          <form onSubmit={handleSendMessage} className="relative">
            <PopoverAnchor asChild>
              <Input
                id="message-input"
                ref={messageInputRef}
                value={newMessage}
                onChange={handleInputChange}
                placeholder={`Message #${activeChannel.name}`}
                className="pr-20"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (isTagging) {
                    if (
                      (e.key === "Enter" || e.key === "Tab") &&
                      filteredMembers[0]
                    ) {
                      e.preventDefault();
                      handleUserTag(filteredMembers[0].name);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setIsTagging(false);
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey && !isTagging) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
            </PopoverAnchor>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="submit" size="icon" className="h-8 w-8">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <ScrollArea className="max-h-48">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => handleUserTag(member.name)}
                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{member.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-sm text-center text-muted-foreground">
                    No users found
                  </div>
                )}
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
