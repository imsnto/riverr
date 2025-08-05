
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, TimerIcon } from 'lucide-react';
import { Task, User, TimeEntry } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface TimerProps {
  tasks: Task[];
  appUser: User | null;
  onLogTime: (timeData: Omit<TimeEntry, 'id'>) => void;
}

export default function Timer({ tasks, appUser, onLogTime }: TimerProps) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = new Date();
      timerRef.current = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleStart = () => {
    if (!selectedTask) {
      toast({
        variant: 'destructive',
        title: 'No Task Selected',
        description: 'Please select a task to start the timer.',
      });
      return;
    }
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (time > 0 && selectedTask && appUser) {
      const task = tasks.find(t => t.id === selectedTask);
      if (task) {
        onLogTime({
          user_id: appUser.id,
          project_id: task.project_id,
          task_id: task.id,
          source: 'Timer',
          notes: `Timer entry for: ${task.name}`,
          start_time: startTimeRef.current!.toISOString(),
          end_time: new Date().toISOString(),
          duration: time / 3600,
        });
      }
    }
    setTime(0);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (!appUser) return null;

  const userTasks = tasks.filter(t => t.assigned_to === appUser.id && t.status !== 'Done');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TimerIcon className="h-5 w-5" />
          Live Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedTask} disabled={isRunning}>
          <SelectTrigger>
            <SelectValue placeholder="Select a task to track" />
          </SelectTrigger>
          <SelectContent>
            {userTasks.map(task => (
              <SelectItem key={task.id} value={task.id}>
                {task.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <p className="font-mono text-4xl font-bold tracking-wider text-primary">{formatTime(time)}</p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} className="w-full" disabled={!selectedTask}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive" className="w-full">
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
