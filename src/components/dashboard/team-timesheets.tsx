'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { timeEntries, users, projects, tasks } from '@/lib/data';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TeamTimesheets() {
  const { toast } = useToast();

  const handleExport = () => {
    toast({
      title: 'Exporting...',
      description: 'Your CSV file will be downloaded shortly.',
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Timesheets</CardTitle>
          <CardDescription>View all time logged by your team members.</CardDescription>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="text-right">Duration (hrs)</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeEntries.map(entry => {
                const user = users.find(u => u.id === entry.user_id);
                const project = projects.find(p => p.id === entry.project_id);
                const task = tasks.find(t => t.id === entry.task_id);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{user?.name || 'Unknown User'}</TableCell>
                    <TableCell>{project?.name || 'No Project'}</TableCell>
                    <TableCell className="text-muted-foreground">{task?.name || 'N/A'}</TableCell>
                    <TableCell className="text-right font-mono">{entry.duration.toFixed(2)}</TableCell>
                    <TableCell>{new Date(entry.start_time).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.source}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
