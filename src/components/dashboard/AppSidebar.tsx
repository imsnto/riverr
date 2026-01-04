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
  Clock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from '@/components/ui/sidebar';

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

const allTopItems: { key: AppView; icon: React.ReactNode; label: string; fixed?: boolean }[] = [
  { key: "overview", icon: <BarChart className="w-5 h-5" />, label: 'Overview', fixed: true },
  { key: "mytasks", icon: <ClipboardCheck className="w-5 h-5" />, label: 'My Tasks', fixed: true },
  { key: "mentions", icon: <AtSign className="w-5 h-5" />, label: 'Mentions', fixed: true },
];

const allMiddleItems: {
  key: AppView;
  icon: React.ReactNode;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "tasks", icon: <FolderKanban className="w-5 h-5" />, label: 'Tasks' },
  { key: "messages", icon: <MessageSquare className="w-5 h-5" />, label: 'Messages' },
  { key: "documents", icon: <BookOpen className="w-5 h-5" />, label: 'Documents' },
  { key: "flows", icon: <Workflow className="w-5 h-5" />, label: 'Flows' },
];

const allBottomItems: {
  key: AppView;
  icon: React.ReactNode;
  label: string;
  fixed?: boolean;
}[] = [
  { key: "team-timesheets", icon: <Clock className="w-5 h-5" />, label: 'Timesheets', fixed: true },
  { key: "settings", icon: <Settings className="w-5 h-5" />, label: 'Settings', fixed: true },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  view,
  onChangeView,
}) => {
  const router = useRouter();
  const { activeHub } = useAuth();
  const { isMobile, state } = useSidebar();


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
  
  const showLabels = isMobile || state === 'expanded';

  const renderButton = (item: {
    key: AppView;
    icon: React.ReactNode;
    label: string;
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
        className="h-12 w-full justify-start rounded-md px-4"
      >
        {item.icon}
        {showLabels && <span className="ml-3">{item.label}</span>}
      </Button>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <div className="flex flex-col h-full p-2">
        <div className="space-y-1">
          {topItems.map(renderButton)}
          <div className="px-3 py-2">
            <Separator />
          </div>
          {middleItems.map(renderButton)}
        </div>
        <div className="mt-auto space-y-1">{bottomItems.map(renderButton)}</div>
      </div>
    </Sidebar>
  );
};

export default AppSidebar;
