// src/components/dashboard/dashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar, AppView } from './AppSidebar';
import { TopBar } from './top-bar';
import { useAuth } from '@/hooks/use-auth';
import {
  Space,
  User,
  Project,
  Task,
  TimeEntry,
  SlackMeetingLog,
  Channel,
  Message,
  Document,
  Invite,
  JobFlowTemplate,
  Job,
  JobFlowTask,
  PhaseTemplate,
  TaskTemplate,
  Status,
  Activity,
  DocumentComment,
  Hub,
} from '@/lib/data';
import * as db from '@/lib/db';
import { useRouter, useParams } from 'next/navigation';

import Overview from './overview';
import TaskBoard from './task-board';
import MyTasksView from './my-tasks-view';
import DocumentsView from './documents-view';
import SettingsLayout from './settings-layout';
import JobFlowTemplateBuilder from './job-flow-template-builder';
import PhaseTemplateBuilder from './phase-template-builder';
import TaskTemplateBuilder from './task-template-builder';
import JobFlowBoard from './job-flow-board';
import MessagesLayout from './messages-layout';
import ChannelsView from './channels-view';
import MentionsThreadList from './mentions-thread-list';
import ThreadView from './thread-view';
import AllThreadsView from './all-threads-view';
import CreateTaskFromThreadDialog from './create-task-from-thread-dialog';
import TaskDetailsDialog from './task-details-dialog';
import { useToast } from '@/hooks/use-toast';

// Helper to determine if a mention is unread
const isUnread = (mention: any, lastRead: string | null) => {
  if (!lastRead) return true;
  const mentionDate = new Date('timestamp' in mention ? mention.timestamp : mention.createdAt);
  return mentionDate > new Date(lastRead);
};

export default function Dashboard({ view }: { view: string }) {
  const { appUser, signOut, activeSpace, userSpaces, setUserSpaces, setActiveSpace, activeHub, setActiveHub } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [currentView, setCurrentView] = useState<AppView>(view as AppView || 'overview');
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [slackLogs, setSlackLogs] = useState<SlackMeetingLog[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Messaging states
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [spaceHubs, setSpaceHubs] = useState<Hub[]>([]);
  
  // Mentions
  const [lastMentionsRead, setLastMentionsRead] = useState<string | null>(null);
  const [unreadMentions, setUnreadMentions] = useState<any[]>([]);

  // Job Flow states
  const [jobFlowTemplates, setJobFlowTemplates] = useState<JobFlowTemplate[]>([]);
  const [phaseTemplates, setPhaseTemplates] = useState<PhaseTemplate[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobFlowTasks, setJobFlowTasks] = useState<JobFlowTask[]>([]);

  // Dialogs
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskFromThread, setTaskFromThread] = useState<Message | null>(null);


  const fetchData = async () => {
    if (!activeSpace || !appUser || !activeHub) return;
    
    const [
      fetchedProjects, 
      fetchedTasks, 
      fetchedTimeEntries, 
      fetchedSlackLogs, 
      fetchedDocuments,
      fetchedUsers,
      fetchedJobFlowTemplates,
      fetchedPhaseTemplates,
      fetchedTaskTemplates,
      fetchedJobs,
      fetchedJobFlowTasks,
      fetchedChannels,
      fetchedMessages,
      fetchedHubs,
    ] = await Promise.all([
      db.getProjectsInHub(activeHub.id),
      db.getAllTasks(activeHub.id),
      db.getTimeEntriesInHub(projects.map(p => p.id)),
      db.getSlackMeetingLogsInSpace(activeSpace.id), // This is space-wide for now
      db.getDocumentsInHub(activeHub.id),
      db.getAllUsers(),
      db.getJobFlowTemplates(activeHub.id),
      db.getPhaseTemplates(activeHub.id),
      db.getTaskTemplates(activeHub.id),
      db.getAllJobs(activeHub.id),
      db.getAllJobFlowTasks(activeHub.id),
      db.getChannelsInHub(activeHub.id),
      db.getMessagesInChannel(channels.map(c => c.id).join(',')), // This will need adjustment
      db.getHubsForSpace(activeSpace.id),
    ]);
    
    setProjects(fetchedProjects);
    setTasks(fetchedTasks);
    setTimeEntries(fetchedTimeEntries);
    setSlackLogs(fetchedSlackLogs);
    setDocuments(fetchedDocuments);
    setAllUsers(fetchedUsers);
    setJobFlowTemplates(fetchedJobFlowTemplates);
    setPhaseTemplates(fetchedPhaseTemplates);
    setTaskTemplates(fetchedTaskTemplates);
    setJobs(fetchedJobs);
    setJobFlowTasks(fetchedJobFlowTasks);
    setChannels(fetchedChannels);
    setSpaceHubs(fetchedHubs);

    if (fetchedChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(fetchedChannels[0].id);
    }
  
    // Fetch messages for all channels
    const allMessages = await Promise.all(
      fetchedChannels.map(channel => db.getMessagesInChannel(channel.id))
    ).then(results => results.flat());
    setMessages(allMessages);
  };


  useEffect(() => {
    if (appUser && activeSpace && activeHub) {
      fetchData();
    }
  }, [appUser, activeSpace, activeHub]);

  // Handle view change from sidebar
  const handleViewChange = (newView: AppView) => {
    setCurrentView(newView);
    if (activeSpace && params.hubId) {
      router.push(`/space/${activeSpace.id}/hub/${params.hubId}/${newView}`);
    }
  };

  const handleHubChange = (hubId: string) => {
    const newHub = spaceHubs.find(h => h.id === hubId);
    if (newHub && activeSpace) {
      setActiveHub(newHub);
      const defaultView = newHub.settings?.defaultView || 'tasks';
      router.push(`/space/${activeSpace.id}/hub/${newHub.id}/${defaultView}`);
    }
  };

  // Switch to the correct view when URL changes
  useEffect(() => {
    if (view && view !== currentView) {
      setCurrentView(view as AppView);
    }
  }, [view, currentView]);

  if (!appUser || !activeSpace || !activeHub) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading your workspace...</p>
      </div>
    );
  }
  
  const handleUpdateTasks = (updatedTasks: Task[]) => {
    // This is a simple implementation. A more robust solution
    // would involve diffing and batching writes to Firestore.
    setTasks(updatedTasks);
    updatedTasks.forEach(task => {
        if(task.id) {
            db.updateTask(task.id, task);
        }
    })
  };

  const handleUpdateTask = (task: Task, tempId?: string) => {
    let newTasks = [];
    setTasks(prevTasks => {
        const taskIndex = prevTasks.findIndex(t => t.id === (tempId || task.id));
        if (taskIndex !== -1) {
            newTasks = [...prevTasks];
            newTasks[taskIndex] = task;
        } else {
            newTasks = [...prevTasks, task];
        }
        return newTasks;
    });

    if (selectedTask && selectedTask.id === (tempId || task.id)) {
        setSelectedTask(task);
    }
    db.updateTask(task.id, task);
  };
  
  const handleAddTask = async (task: Omit<Task, 'id'>) => {
    const taskWithHub = { ...task, hubId: activeHub.id };
    const newTask = await db.addTask(taskWithHub);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }

  const handleDeleteTask = async (taskId: string) => {
      await db.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(null);
      }
  }

  const handleUpdateActiveHub = async (updatedData: Partial<Hub>) => {
    if (!activeHub) return;
    try {
        await db.updateHub(activeHub.id, updatedData);
        const updatedHub = { ...activeHub, ...updatedData };
        setActiveHub(updatedHub);
        
        setSpaceHubs(prev => prev.map(h => h.id === activeHub.id ? updatedHub : h));
        
        toast({ title: 'Hub updated successfully' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Failed to update hub' });
    }
  }

  const handleAddProject = async (project: Omit<Project, 'id' | 'hubId'>) => {
    const projectWithHub = { ...project, hubId: activeHub.id };
    const newProject = await db.addProject(projectWithHub);
    setProjects(prev => [...prev, newProject]);
  }

  const handleUpdateProject = async (projectId: string, data: Partial<Project>) => {
      await db.updateProject(projectId, data);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...data } : p));
  }
  
  const handleDeleteProject = async (projectId: string) => {
      await db.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
  }
  
  const handleAddMessage = async (message: Omit<Message, 'id'>) => {
    const newMessage = await db.addMessage(message);
    setMessages(prev => [...prev, newMessage]);
  }
  
  const handleCreateTaskFromThread = (thread: Message) => {
    setTaskFromThread(thread);
  };
  
  const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
    const newTimeEntry = await db.addTimeEntry(timeData);
    setTimeEntries(prev => [...prev, newTimeEntry]);
  };
  
  const handleSpaceSave = async (spaceData: Omit<Space, 'id'>, spaceId?: string) => {
    if (spaceId) {
        await db.updateSpace(spaceId, spaceData);
        toast({ title: 'Space Updated', description: 'The space has been successfully updated.' });
    } else {
        const newSpaceId = await db.addSpace(spaceData);
        await db.createDefaultHubForSpace(newSpaceId, appUser.id, { name: 'Default Hub', type: 'project-management' });
        toast({ title: 'Space Created', description: 'The space and a default hub have been created.' });
    }
    // After saving, refresh all user spaces to reflect changes
    const updatedSpaces = await db.getSpacesForUser(appUser.id);
    setUserSpaces(updatedSpaces);
    
    // If the active space was edited, update it. If a new space was created, switch to it.
    if (spaceId) {
        const updatedActiveSpace = updatedSpaces.find(s => s.id === spaceId);
        if (updatedActiveSpace) setActiveSpace(updatedActiveSpace);
    }
 };


  const renderView = () => {
    const props = {
      tasks,
      projects,
      activeSpace,
      activeHub,
      allUsers,
      appUser,
      onUpdateTasks: handleUpdateTasks,
      onUpdateActiveHub: handleUpdateActiveHub,
      onAddProject: handleAddProject,
      onUpdateProject: handleUpdateProject,
      onDeleteProject: handleDeleteProject,
      onTaskSelect: setSelectedTask,
      onUpdateTask: handleUpdateTask,
      onAddTask: handleAddTask,
      documents,
      timeEntries,
      allSpaces: userSpaces,
      messages,
      unreadMentions,
      onMentionsCleared: () => setLastMentionsRead(new Date().toISOString()),
      onSelectTask: setSelectedTask,
      statuses: activeHub?.statuses || [],
      onSave: handleSpaceSave,
      onDelete: db.deleteSpace,
      onInvite: fetchData,
      handleInvite: async (invite: any) => {
          await db.addInvite({ ...invite, invitedBy: appUser.id, status: 'pending' });
          fetchData();
      },
      onDataRefresh: fetchData,
      jobs,
      jobFlowTemplates,
      jobFlowTasks,
      onJobLaunched: fetchData,
      // Messaging props
      channels,
      onViewThread: (thread: Message) => {
          setActiveThread(thread);
          handleViewChange('thread');
      },
      onAddMessage: handleAddMessage,
       // Thread view specific prop
      activeThread: activeThread,
      onCloseThread: () => setActiveThread(null),
    };

    const messagesProps = {
        left: (
            <div className="p-4">
                <h2 className="text-lg font-semibold">Channels</h2>
                {channels.map(c => <div key={c.id}>{c.name}</div>)}
            </div>
        ),
        center: <ChannelsView {...props} activeChannelId={activeChannelId} setMessages={setMessages} onCreateTask={handleCreateTaskFromThread} />,
        right: activeThread ? <ThreadView {...props} thread={activeThread} onClose={() => setActiveThread(null)} /> : undefined,
        threadOpen: !!activeThread,
    };

    switch (currentView) {
      case 'overview': return <Overview {...props} />;
      case 'tasks': return <TaskBoard {...props} />;
      case 'mytasks': return <MyTasksView {...props} />;
      case 'documents': return <DocumentsView {...props} />;
      case 'settings': return <SettingsLayout {...props} />;
      case 'messages': return <MessagesLayout {...messagesProps} />;
      case 'mentions': return <MentionsThreadList {...props} mentions={unreadMentions} onClose={() => {}} onOpenThread={() => {}} />;
      case 'thread': return <ThreadView {...props} thread={activeThread!} onClose={() => setActiveThread(null)} />;
      case 'all-threads': return <AllThreadsView {...props} isThreadUnread={() => false} />;
      case 'channels': return <ChannelsView {...props} activeChannelId={activeChannelId} setMessages={setMessages} onCreateTask={handleCreateTaskFromThread} />;
      default:
        return (
          <div className="p-8">
            <h1 className="text-2xl font-bold">Coming Soon: {currentView}</h1>
            <p>This view is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar view={currentView} onChangeView={handleViewChange} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar 
          activeSpace={activeSpace} 
          allSpaces={userSpaces} 
          onSpaceChange={(spaceId) => {
            const newSpace = userSpaces.find(s => s.id === spaceId);
            if (newSpace) {
              setActiveSpace(newSpace);
              setActiveHub(null);
              router.push(`/space/${spaceId}/hubs`);
            }
          }}
          allHubs={spaceHubs}
          activeHub={activeHub}
          onHubChange={handleHubChange}
        />
        <main className="flex-1 overflow-y-auto p-8 pt-24">
          {renderView()}
        </main>
      </div>

       {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          timeEntries={timeEntries.filter(t => t.task_id === selectedTask?.id)}
          isOpen={!!selectedTask}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTask(null);
          }}
          onUpdateTask={handleUpdateTask}
          onAddTask={async (taskData, tempId) => {
             const newTask = await handleAddTask(taskData);
             return newTask;
          }}
          onRemoveTask={handleDeleteTask}
          onTaskSelect={setSelectedTask}
          onLogTime={handleLogTime}
          statuses={activeHub.statuses?.map(s => s.name) || []}
          allUsers={allUsers}
          allTasks={tasks}
          projects={projects}
        />
      )}
       {taskFromThread && (
        <CreateTaskFromThreadDialog
          isOpen={!!taskFromThread}
          onOpenChange={() => setTaskFromThread(null)}
          message={taskFromThread}
          channelMembers={allUsers} // Simplified for now
          projects={projects}
          onTaskCreated={(taskData) => handleAddTask(taskData)}
        />
      )}
    </div>
  );
}
