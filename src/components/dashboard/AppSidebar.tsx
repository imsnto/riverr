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
import { useAuth } from "@/hooks/use-auth";

export type AppView =
  | "overview"
  | "tasks"
  | "mytasks"
  | "mentions"
  | "messages"
  | "documents"
  | "flows"
  | "settings"
  | "team-timesheets"
  | "user-settings"
  | "space-settings";

interface AppSidebarProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
  className?: string;
}

const allTopItems: { key: AppView; icon: React.ReactNode; fixed?: boolean }[] = [
  { key: "overview", icon: <BarChart className="w-7 h-7" />, fixed: true },
  { key: "mytasks", icon: <ClipboardCheck className="w-7 h-7" />, fixed: true },
  { key: "mentions", icon: <AtSign className="w-7 h-7" />, fixed: true },
];

const allMiddleItems: {
  key: AppView;
  icon: React.ReactNode;
  fixed?: boolean;
}[] = [
  { key: "tasks", icon: <FolderKanban className="w-7 h-7" /> },
  { key: "messages", icon: <MessageSquare className="w-7 h-7" /> },
  { key: "documents", icon: <BookOpen className="w-7 h-7" /> },
  { key: "flows", icon: <Workflow className="w-7 h-7" /> },
];

const allBottomItems: {
  key: AppView;
  icon: React.ReactNode;
  fixed?: boolean;
}[] = [
  { key: "settings", icon: <Settings className="w-7 h-7" />, fixed: true },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  view,
  onChangeView,
}) => {
  const router = useRouter();
  const { activeHub } = useAuth();

  const hubComponents = activeHub?.settings?.components || [];

  const topItems = allTopItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );
  const middleItems = allMiddleItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );
  const bottomItems = allBottomItems.filter(
    (item) => item.fixed || hubComponents.includes(item.key)
  );

  const renderButton = (item: {
    key: AppView;
    icon: React.ReactNode;
    fixed?: boolean;
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
