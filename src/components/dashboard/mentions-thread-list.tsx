// src/components/dashboard/mentions-thread-list.tsx
"use client";

import React from "react";
import { User, Message, Activity, DocumentComment } from "@/lib/data";
import { Button } from "../ui/button";
import { X, MessageSquare, CheckSquare, FileText } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

// Mention union type (same shape as in mentions-view)
type Mention = (Message | Activity | DocumentComment) & {
  parentType?: "task" | "document";
  parentId?: string;
  parentName?: string;
};

interface MentionsThreadListProps {
  mentions: Mention[];
  allUsers: User[];
  messages: Message[]; // full message list so we can locate parent thread
  onOpenThread: (thread: Message) => void;
  onClose: () => void;
  isDialog?: boolean;
}

const getInitials = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
};

const renderMentionContent = (content: string, allUsers: User[]) => {
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
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

// Helper to resolve a thread parent when mention is inside a thread reply
function findThreadForMessage(
  msg: Message,
  allMessages: Message[]
): Message | null {
  if (!msg.thread_id) return msg; // parent itself (or standalone message not in a thread)
  return allMessages.find((m) => m.id === msg.thread_id) || null;
}

export default function MentionsThreadList({
  mentions,
  allUsers,
  messages,
  onOpenThread,
  onClose,
  isDialog = true,
}: MentionsThreadListProps) {
  if (mentions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        {isDialog && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <p className="text-sm text-muted-foreground">No unread mentions.</p>
      </div>
    );
  }

  const getParentIcon = (mention: Mention) => {
    if ("channel_id" in mention) return <MessageSquare className="h-3 w-3" />;
    if (mention.parentType === "task")
      return <CheckSquare className="h-3 w-3" />;
    if (mention.parentType === "document")
      return <FileText className="h-3 w-3" />;
    return null;
  };

  const handleClick = (mention: Mention) => {
    // Only open a thread for message mentions (those originating from messages or activities with message context)
    if ("channel_id" in mention) {
      const msg = mention as Message;
      const threadParent = findThreadForMessage(msg, messages);
      if (threadParent) {
        onOpenThread(threadParent);
      }
    }
    // For task/document mentions we could navigate later (future enhancement)
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {isDialog && (
        <div className="p-4 border-b flex-shrink-0 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Mentions</h3>
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {mentions.map((mention, index) => {
            const userId =
              "user_id" in mention ? mention.user_id : mention.userId;
            const timestamp =
              "timestamp" in mention ? mention.timestamp : mention.createdAt;
            const content =
              "content" in mention ? mention.content : mention.comment || "";
            const user = allUsers.find((u) => String(u.id) === String(userId));

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleClick(mention)}
                className="flex w-full items-start gap-3 p-2 rounded-md hover:bg-muted/60 transition text-left"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} />
                  <AvatarFallback>
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground my-1 break-words">
                    {renderMentionContent(content, allUsers)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getParentIcon(mention)}
                    {mention.parentName ||
                      ("channel_id" in mention
                        ? `#${(mention as Message).channel_id}`
                        : "")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
      {!isDialog && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onClose}
          >
            Mark all as read
          </Button>
        </div>
      )}
    </div>
  );
}
