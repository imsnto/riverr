// src/components/dashboard/my-tasks-view.tsx
"use client";
import React, { useMemo, useState } from "react";
import {
  Task,
  User,
  Project,
  TimeEntry,
  Document,
  Message,
  Activity,
  DocumentComment,
} from "@/lib/data";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MentionsView from "@/components/dashboard/mentions-view";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AtSign } from "lucide-react";
import { format, parseISO } from "date-fns";

export type MentionUnion = (Message | Activity | DocumentComment) & {
  parentType?: "task" | "document";
  parentId?: string;
  parentName?: string;
};

interface MyTasksViewProps {
  appUser: User;
  tasks: Task[];
  projects: Project[];
  allUsers: User[];
  documents: Document[];
  messages: Message[];
  unreadMentions: MentionUnion[];
  onMentionsCleared: () => void;
  onSelectTask: (task: Task) => void;
  timeEntries: TimeEntry[];
  statuses: { name: string; color: string }[];
}

const MyTasksView: React.FC<MyTasksViewProps> = ({
  appUser,
  tasks,
  projects,
  allUsers,
  documents,
  messages,
  unreadMentions,
  onMentionsCleared,
  onSelectTask,
  statuses,
}) => {
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === appUser.id),
    [tasks, appUser.id]
  );
  const [filter, setFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const filteredTasks = useMemo(() => {
    return myTasks
      .filter((task) => {
        const nameMatch = task.name
          .toLowerCase()
          .includes(filter.toLowerCase());
        const projectMatch =
          projectFilter === "all" || task.project_id === projectFilter;
        const statusMatch = showCompleted
          ? task.status === "Done"
          : task.status !== "Done";
        return nameMatch && projectMatch && statusMatch;
      })
      .sort(
        (a, b) =>
          new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
      );
  }, [myTasks, filter, projectFilter, showCompleted]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
          <Label htmlFor="show-completed">Show Completed</Label>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Input
          placeholder="Filter by name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => {
              const project = projects.find((p) => p.id === task.project_id);
              const statusDef = statuses.find((s) => s.name === task.status);
              return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell>{project?.name || "—"}</TableCell>
                  <TableCell>
                    {format(parseISO(task.due_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      style={{
                        backgroundColor: statusDef?.color,
                        color: "#fff",
                      }}
                    >
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectTask(task)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {filteredTasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {showCompleted
            ? "You have no completed tasks."
            : "You have no active tasks matching the current filters."}
        </div>
      )}
    </div>
  );
};

export default MyTasksView;
