// src/app/(app)/mytasks/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Task, Project, User, TimeEntry } from '@/lib/data';
import { getAllTasks, getProjectsInSpace, getAllUsers, getTimeEntriesInSpace } from '@/lib/db';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TaskDetailsDialog from '@/components/dashboard/task-details-dialog';
import { updateTask, addTask, deleteTask, addTimeEntry } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { TopBar } from '@/components/dashboard/top-bar';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { BarChart, FolderKanban, MessageSquare, Timer, Workflow, Settings, ClipboardCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LoadingState = () => (
    <div className="flex h-screen items-center justify-center">
        <p>Loading your tasks...</p>
    </div>
);

export default function MyTasksPage() {
    const { appUser, userSpaces, signOut } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [filter, setFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');

    const activeSpace = userSpaces.length > 0 ? userSpaces[0] : null;

    React.useEffect(() => {
        if (!appUser) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [allTasks, allUsersData, projectsData] = await Promise.all([
                    getAllTasks(),
                    getAllUsers(),
                    getProjectsInSpace(activeSpace!.id),
                ]);

                const projectIds = projectsData.map(p => p.id);
                const timeEntriesData = await getTimeEntriesInSpace(projectIds);

                setTasks(allTasks.filter(t => t.assigned_to === appUser.id));
                setProjects(projectsData);
                setAllUsers(allUsersData);
                setTimeEntries(timeEntriesData);

            } catch (error) {
                console.error("Failed to fetch tasks:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load your tasks.' });
            } finally {
                setIsLoading(false);
            }
        };

        if (activeSpace) {
            fetchData();
        } else {
             setIsLoading(false);
        }

    }, [appUser, activeSpace, toast]);
    
    const handleUpdateTask = async (updatedTask: Task, tempId?: string) => {
        setTasks(prevTasks => {
            const taskIndex = prevTasks.findIndex(t => t.id === (tempId || updatedTask.id));
            if (taskIndex !== -1) {
                const newTasks = [...prevTasks];
                newTasks[taskIndex] = updatedTask;
                return newTasks;
            }
            return [...prevTasks, updatedTask];
        });

        if (selectedTask && selectedTask.id === (tempId || updatedTask.id)) {
            setSelectedTask(updatedTask);
        }

        try {
            await updateTask(updatedTask.id, updatedTask);
        } catch(e) {
            console.error("Task update failed", e);
            toast({ variant: 'destructive', title: 'Update failed', description: 'Could not save task changes.' });
        }
    };
    
    const handleAddTask = async (taskData: Omit<Task, 'id'>, tempId: string) => {
        const optimisticTask: Task = { ...taskData, id: tempId };
        setTasks(prev => [...prev, optimisticTask]);

        try {
            const savedTask = await addTask(taskData);
            setTasks(prev => prev.map(t => t.id === optimisticTask.id ? savedTask : t));
            if (selectedTask?.id === optimisticTask.id) setSelectedTask(savedTask);
            return savedTask;
        } catch (e) {
            console.error("Task add failed", e);
            toast({ variant: 'destructive', title: 'Create failed', description: 'Could not create new task.' });
            setTasks(prev => prev.filter(t => t.id !== optimisticTask.id));
            return null;
        }
    }

    const handleRemoveTask = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        deleteTask(taskId).catch(() => {
            toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete task from DB.' });
        });
    };
    
    const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
        const newEntry = await addTimeEntry(timeData);
        setTimeEntries(prev => [...prev, newEntry]);
    };

    const filteredTasks = useMemo(() => {
        return tasks
            .filter(task => {
                const nameMatch = task.name.toLowerCase().includes(filter.toLowerCase());
                const projectMatch = projectFilter === 'all' || task.project_id === projectFilter;
                return nameMatch && projectMatch;
            })
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }, [tasks, filter, projectFilter]);

    if (isLoading || !activeSpace) {
        return <LoadingState />;
    }

    const statuses = activeSpace.statuses;

    return (
        <SidebarProvider defaultOpen={false}>
            <TopBar activeSpace={activeSpace} onSpaceChange={() => {}} allSpaces={userSpaces} />
            <div className="flex flex-1 h-screen pt-16">
                 <Sidebar collapsible="icon">
                     <div className="flex flex-col h-full">
                        <div className="space-y-2 pt-4">
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BarChart className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <FolderKanban className="w-7 h-7"/>
                            </Button>
                             <Button onClick={() => router.push('/mytasks')} variant={'secondary'} className="h-12 w-full justify-center rounded-none">
                                <ClipboardCheck className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <MessageSquare className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Timer className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Workflow className="w-7 h-7"/>
                            </Button>
                        </div>
                        <div className="mt-auto space-y-2">
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Settings className="w-7 h-7"/>
                            </Button>
                        </div>
                    </div>
                </Sidebar>

                <main className="flex-1 overflow-auto p-4 md:p-8">
                    <h1 className="text-3xl font-bold mb-4">My Tasks</h1>
                    <div className="flex justify-between items-center mb-4">
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
                                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="border rounded-lg">
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
                                {filteredTasks.map(task => {
                                    const project = projects.find(p => p.id === task.project_id);
                                    const status = statuses.find(s => s.name === task.status);
                                    return (
                                        <TableRow key={task.id}>
                                            <TableCell className="font-medium">{task.name}</TableCell>
                                            <TableCell>{project?.name || 'Job Flow'}</TableCell>
                                            <TableCell>{format(parseISO(task.due_date), 'MMM d, yyyy')}</TableCell>
                                            <TableCell>
                                                <Badge style={{ backgroundColor: status?.color, color: '#fff' }}>
                                                    {task.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
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
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">You have no tasks matching the current filters.</p>
                        </div>
                    )}
                </main>
            </div>
             {selectedTask && (
                <TaskDetailsDialog
                    key={selectedTask.id}
                    task={selectedTask}
                    isOpen={!!selectedTask}
                    timeEntries={timeEntries.filter(t => t.task_id === selectedTask.id)}
                    allUsers={allUsers}
                    allTasks={tasks}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) setSelectedTask(null);
                    }}
                    onUpdateTask={handleUpdateTask}
                    onAddTask={handleAddTask}
                    onRemoveTask={handleRemoveTask}
                    onTaskSelect={setSelectedTask}
                    onLogTime={handleLogTime}
                    statuses={statuses.map(s => s.name)}
                    projects={projects}
                />
            )}
        </SidebarProvider>
    );
}
