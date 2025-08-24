// src/components/dashboard/AppSidebar.tsx
"use client";

import React from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  ClipboardCheck,
  AtSign,
  FolderKanban,
  MessageSquare,
  BookOpen,
  Workflow,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

export type AppView =
  | "overview"
  | "tasks"
  | "mytasks"
  | "mentions"
  | "messages"
  | "timesheets"
  | "reports"
  | "flows"
  | "settings"
  | "documents";

interface AppSidebarProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
  className?: string;
}

// Central menu configuration so we keep one source of truth
const topItems: { key: AppView; icon: React.ReactNode; internal?: boolean }[] =
  [
    { key: "overview", icon: <BarChart className="w-7 h-7" />, internal: true },
    {
      key: "mytasks",
      icon: <ClipboardCheck className="w-7 h-7" />,
      internal: true,
    },
    { key: "mentions", icon: <AtSign className="w-7 h-7" />, internal: true },
  ];

const middleItems: {
  key: AppView;
  icon: React.ReactNode;
  internal?: boolean;
}[] = [
  { key: "tasks", icon: <FolderKanban className="w-7 h-7" />, internal: true },
  {
    key: "messages",
    icon: <MessageSquare className="w-7 h-7" />,
    internal: true,
  },
  { key: "documents", icon: <BookOpen className="w-7 h-7" />, internal: true },
  { key: "flows", icon: <Workflow className="w-7 h-7" />, internal: true },
];

const bottomItems: {
  key: AppView;
  icon: React.ReactNode;
  internal?: boolean;
}[] = [
  { key: "settings", icon: <Settings className="w-7 h-7" />, internal: true },
];

/* TODO: Accept optional badge counts (e.g., unreadMentions, unreadThreads) for icons */
export const AppSidebar: React.FC<AppSidebarProps> = ({
  view,
  onChangeView,
}) => {
  const router = useRouter();

  const renderButton = (item: {
    key: AppView;
    icon: React.ReactNode;
    internal?: boolean;
  }) => {
    const isActive = view === item.key;
    const variant = isActive ? "secondary" : "ghost";
    const handleClick = () => {
      onChangeView(item.key);
    };
    return (
      <Button
        key={item.key}
        onClick={handleClick}
        variant={variant}
        className="h-12 w-full justify-center rounded-none"
      >
        {item.icon}
      </Button>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col h-full">
        <div className="space-y-2 pt-4">
          {topItems.map(renderButton)}
          <div className="px-3 py-2">
            <Separator />
          </div>
          {middleItems.map(renderButton)}
        </div>
        <div className="mt-auto space-y-2">{bottomItems.map(renderButton)}</div>
      </div>
    </Sidebar>
  );
};

export default AppSidebar;
