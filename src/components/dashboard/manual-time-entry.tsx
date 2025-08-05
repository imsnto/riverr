
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Project, Task, User, TimeEntry } from '@/lib/data';
import { Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManualTimeEntryProps {
  projects: Project[];
  tasks: Task[];
  appUser: User | null;
  onLogTime: (timeData: Omit<TimeEntry, 'id'>) => void;
}

export default function ManualTimeEntry({ projects, tasks, appUser, onLogTime }: ManualTimeEntryProps) {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState('');
  
  if (!appUser) return null;

  const userProjects = projects.filter(p => p.members.includes(appUser.id));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hours = parseFloat(formData.get('hours') as string) || 0;
    const minutes = parseFloat(formData.get('minutes') as string) || 0;
    const duration = hours + minutes / 60;
    
    const projectId = formData.get('project') as string;
    const taskId = formData.get('task') as string | undefined;
    const notes = formData.get('notes') as string;

    if (!duration || !projectId) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a project and enter a duration.',
      });
      return;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - duration * 60 * 60 * 1000);

    onLogTime({
      user_id: appUser.id,
      project_id: projectId,
      task_id: taskId,
      source: 'Manual',
      notes,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration: duration,
    });
    
    (e.target as HTMLFormElement).reset();
    setSelectedProject('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Manual Time Entry
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select name="project" onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {userProjects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task">Task (Optional)</Label>
            <Select name="task" disabled={!selectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {tasks
                  .filter(t => t.project_id === selectedProject)
                  .map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-2 gap-2">
                <Input id="hours" name="hours" type="number" placeholder="Hours" min="0" />
                <Input id="minutes" name="minutes" type="number" placeholder="Minutes" step="1" min="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="What did you work on?" />
          </div>
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            Log Time
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
