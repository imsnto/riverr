// src/app/(app)/mytasks/page.tsx
'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Task, Project, User, TimeEntry, Document, Message, DocumentComment, Activity } from '@/lib/data';
import { getTasksForUser, getProjectsInSpace, getAllUsers, getTimeEntriesInSpace, getDocumentsInSpace, getMessagesInChannel, getChannelsInSpace } from '@/lib/db';
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
import { BarChart, FolderKanban, MessageSquare, Timer, Workflow, Settings, ClipboardCheck, BookOpen, AtSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import MentionsView from '@/components/dashboard/mentions-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LoadingState = () => (
    <div className="flex h-screen items-center justify-center">
        <p>Loading your tasks...</p>
    </div>
);

type Mention = (Message | Activity | DocumentComment) & {
    parentType?: 'task' | 'document';
    parentId?: string;
    parentName?: string;
};

export default function MyTasksPage() {
    const { appUser, userSpaces, activeSpace, setActiveSpace, signOut } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [filter, setFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(false);
    
    const [lastMentionsReadAt, setLastMentionsReadAt] = useState<number>(Date.now());

    const getUnreadMentions = useCallback((): Mention[] => {
        if (!appUser) return [];

        const mentionRegex = new RegExp(`@${appUser.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        const checkTime = lastMentionsReadAt;

        const messageMentions = messages.filter(m =>
            m.content.match(mentionRegex) &&
            String(m.user_id) !== String(appUser.id) &&
            new Date(m.timestamp).getTime() > checkTime
        );

        const taskMentions = tasks.flatMap(t => 
            (t.activities || [])
            .filter(a => a.comment && mentionRegex.test(a.comment) && String(a.user_id) !== String(appUser.id) && new Date(a.timestamp).getTime() > checkTime)
            .map(a => ({...a, parentType: 'task' as const, parentId: t.id, parentName: t.name}))
        );

        const docMentions = documents.flatMap(d => 
            (d.comments || [])
            .filter(c => c.content.match(mentionRegex) && String(c.userId) !== String(appUser.id) && new Date(c.createdAt).getTime() > checkTime)
            .map(c => ({...c, parentType: 'document' as const, parentId: d.id, parentName: d.name}))
        );

        return [...messageMentions, ...taskMentions, ...docMentions];
    }, [appUser, messages, tasks, documents, lastMentionsReadAt]);

    const unreadMentions = useMemo(() => getUnreadMentions(), [getUnreadMentions]);

    useEffect(() => {
        if (!appUser) {
            router.push('/login');
            return;
        }

        if (userSpaces.length > 0 && !activeSpace) {
            setActiveSpace(userSpaces[0]);
        }
    }, [userSpaces, appUser, activeSpace, setActiveSpace, router]);

    useEffect(() => {
        if (!appUser || !activeSpace) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [userTasks, allUsersData, projectsData, documentsData, channelsData] = await Promise.all([
                    getTasksForUser(appUser.id),
                    getAllUsers(),
                    getProjectsInSpace(activeSpace.id),
                    getDocumentsInSpace(activeSpace.id),
                    getChannelsInSpace(activeSpace.id),
                ]);

                const projectIds = projectsData.map(p => p.id);
                const [timeEntriesData, messagesData] = await Promise.all([
                    getTimeEntriesInSpace(projectIds),
                    Promise.all(channelsData.map(c => getMessagesInChannel(c.id))).then(msgArrays => msgArrays.flat())
                ]);
                
                setTasks(userTasks);
                setProjects(projectsData);
                setAllUsers(allUsersData);
                setTimeEntries(timeEntriesData);
                setDocuments(documentsData);
                setMessages(messagesData);

            } catch (error) {
                console.error("Failed to fetch tasks:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load your tasks.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

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
    
    const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
        const optimisticTask: Task = { ...taskData, id: `temp-${Date.now()}` };
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
                
                const statusMatch = showCompleted
                    ? task.status === 'Done'
                    : task.status !== 'Done';
                
                return nameMatch && projectMatch && statusMatch;
            })
            .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
    }, [tasks, filter, projectFilter, showCompleted]);

    if (isLoading || !activeSpace) {
        return <LoadingState />;
    }

    const statuses = activeSpace.statuses;

    return (
        <SidebarProvider defaultOpen={false}>
            <TopBar />
            <div className="flex flex-1 h-screen pt-16">
                 <Sidebar collapsible="icon">
                     <div className="flex flex-col h-full">
                        <div className="space-y-2 pt-4">
                            <Button onClick={() => router.push('/')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BarChart className="w-7 h-7"/>
                            </Button>
                             <Button onClick={() => router.push('/mytasks')} variant={'secondary'} className="h-12 w-full justify-center rounded-none">
                                <ClipboardCheck className="w-7 h-7"/>
                            </Button>
                            
                            <div className="px-3 py-2">
                                <Separator />
                            </div>

                            <Button onClick={() => router.push('/?view=tasks')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <FolderKanban className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=messages')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <MessageSquare className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/documents')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <BookOpen className="w-7 h-7"/>
                            </Button>
                            <Button onClick={() => router.push('/?view=flows')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Workflow className="w-7 h-7"/>
                            </Button>
                        </div>
                        <div className="mt-auto space-y-2">
                            <Button onClick={() => router.push('/?view=settings')} variant={'ghost'} className="h-12 w-full justify-center rounded-none">
                                <Settings className="w-7 h-7"/>
                            </Button>
                        </div>
                    </div>
                </Sidebar>

                <main className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-3xl font-bold">My Tasks</h1>
                        <div className="flex items-center space-x-2">
                            <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
                            <Label htmlFor="show-completed">Show Completed</Label>
                        </div>
                    </div>
                    
                    {unreadMentions.length > 0 && (
                        <Card className="mb-6 border-primary/50 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <AtSign className="h-5 w-5" />
                                    You have {unreadMentions.length} unread mention{unreadMentions.length > 1 ? 's' : ''}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <MentionsView 
                                    mentions={unreadMentions}
                                    allUsers={allUsers}
                                    onClose={() => setLastMentionsReadAt(Date.now())}
                                    isDialog={false}
                                />
                            </CardContent>
                        </Card>
                    )}

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
                            <p className="text-muted-foreground">{showCompleted ? "You have no completed tasks." : "You have no active tasks matching the current filters."}</p>
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
