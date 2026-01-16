
// src/components/dashboard/dashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
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
  ChatContact,
  Conversation,
  ChatMessage,
  Bot,
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
import { SidebarProvider } from '../ui/sidebar';
import ProjectFormDialog from './project-form-dialog';
import ChannelList from './channel-list';
import { ContentSkeleton } from './content-skeleton';
import InboxLayout from './inbox-layout';
import { cn } from '@/lib/utils';
import { AppView } from '@/lib/routes';
import ProjectSidebar from './project-sidebar';

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
  
  // Inbox state
  const [bots, setBots] = useState<Bot[]>([]);
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);


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
  
  // Project Management
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);


  const fetchData = async () => {
    if (!appUser) return;

        // Always fetch all users
        const fetchedUsers = await db.getAllUsers();
        setAllUsers(fetchedUsers);
      
        // Fetch all spaces for the user to get all project IDs for time entries
        const allUserSpaces = await db.getSpacesForUser(appUser.id);
        const allProjectIds: string[] = [];
        for (const space of allUserSpaces) {
          const hubs = await db.getHubsForSpace(space.id);
          for (const hub of hubs) {
            const hubProjects = await db.getProjectsInHub(hub.id);
            allProjectIds.push(...hubProjects.map(p => p.id));
          }
        }
        const fetchedTimeEntries = await db.getTimeEntriesInHub(allProjectIds);
        setTimeEntries(fetchedTimeEntries);
      
        // Hub-specific data fetching
        if (activeSpace && activeHub) {
          const [
            fetchedProjects,
            fetchedTasks,
            fetchedSlackLogs,
            fetchedDocuments,
            fetchedJobFlowTemplates,
            fetchedPhaseTemplates,
            fetchedTaskTemplates,
            fetchedJobs,
            fetchedJobFlowTasks,
            fetchedChannels,
            fetchedHubs,
            fetchedConversations,
            fetchedBots,
          ] = await Promise.all([
            db.getProjectsInHub(activeHub.id),
            db.getAllTasks(activeHub.id),
            db.getSlackMeetingLogsInSpace(activeSpace.id), // This is space-wide for now
            db.getDocumentsInHub(activeHub.id),
            db.getJobFlowTemplates(activeHub.id),
            db.getPhaseTemplates(activeHub.id),
            db.getTaskTemplates(activeHub.id),
            db.getAllJobs(activeHub.id),
            db.getAllJobFlowTasks(activeHub.id),
            db.getChannelsInHub(activeHub.id),
            db.getHubsForSpace(activeSpace.id),
            db.getConversationsForHub(activeHub.id),
            db.getBots(activeHub.id),
          ]);
          
          setProjects(fetchedProjects);
          if (!selectedProjectId && fetchedProjects.length > 0) {
            setSelectedProjectId(fetchedProjects[0].id);
          } else if (fetchedProjects.length === 0) {
            setSelectedProjectId(null);
          }


          setTasks(fetchedTasks);
          setSlackLogs(fetchedSlackLogs);
          setDocuments(fetchedDocuments);
          setJobFlowTemplates(fetchedJobFlowTemplates);
          setPhaseTemplates(fetchedPhaseTemplates);
          setTaskTemplates(fetchedTaskTemplates);
          setJobs(fetchedJobs);
          setJobFlowTasks(fetchedJobFlowTasks);
          setChannels(fetchedChannels);
          setSpaceHubs(fetchedHubs);
          setChatConversations(fetchedConversations);
          setBots(fetchedBots);
      
          if (fetchedChannels.length > 0 && !activeChannelId) {
            setActiveChannelId(fetchedChannels[0].id);
          }
        
          // Fetch messages for all channels in the active hub
          const allMessages = await Promise.all(
            fetchedChannels.map(channel => db.getMessagesInChannel(channel.id))
          ).then(results => results.flat());
          setMessages(allMessages);

           if (fetchedConversations.length > 0) {
              const convoIds = fetchedConversations.map(c => c.id);
              const fetchedMessages = await db.getMessagesForConversations(convoIds);
              setChatMessages(fetchedMessages);
          } else {
              setChatMessages([]);
          }
        }
  };


  useEffect(() => {
    fetchData();
  }, [appUser, activeSpace, activeHub]);
  
  useEffect(() => {
    if (activeHub) {
        db.getProjectsInHub(activeHub.id).then(fetchedProjects => {
            setProjects(fetchedProjects);
            if (!selectedProjectId && fetchedProjects.length > 0) {
                setSelectedProjectId(fetchedProjects[0].id);
            } else if (fetchedProjects.length === 0) {
                setSelectedProjectId(null);
            }
        });
    }
  }, [activeHub, selectedProjectId])


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
  
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentView('tasks');
  }

  const handleNewProject = () => {
    setEditingProject(null);
    setIsProjectFormOpen(true);
  }

  // Switch to the correct view when URL changes
  useEffect(() => {
    if (view && view !== currentView) {
      setCurrentView(view as AppView);
    }
  }, [view, currentView]);

  if (!appUser || !activeSpace || !activeHub) {
    // Show a skeleton while the main auth/space context is loading
    return (
      <SidebarProvider>
        <div className="flex h-screen bg-background text-foreground">
          <AppSidebar
            view={currentView}
            onChangeView={handleViewChange}
            activeSpace={activeSpace}
            allSpaces={userSpaces}
            onSpaceChange={() => {}}
            allHubs={[]}
            activeHub={activeHub}
            onHubChange={() => {}}
          />
          <main className="flex-1 overflow-y-auto">
            <ContentSkeleton />
          </main>
        </div>
      </SidebarProvider>
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
    const taskWithHub = { ...task, hubId: activeHub.id, spaceId: activeSpace.id };
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
    if (!activeHub) return;
    const projectWithHub = { ...project, hubId: activeHub.id };
    const newProject = await db.addProject(projectWithHub);
    setProjects(prev => [...prev, newProject]);
    setSelectedProjectId(newProject.id);
  }

  const handleUpdateProject = async (projectId: string, data: Partial<Project>) => {
      await db.updateProject(projectId, data);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...data } : p));
  }
  
  const handleDeleteProject = async (projectId: string) => {
      await db.deleteProject(projectId);
      const newProjects = projects.filter(p => p.id !== projectId);
      setProjects(newProjects);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(newProjects.length > 0 ? newProjects[0].id : null);
      }
  }
  
  const handleAddMessage = async (message: Omit<Message, 'id'>) => {
    const newMessage = await db.addMessage(message);
    setMessages(prev => [...prev, newMessage]);
  }
  
  const handleCreateTaskFromThread = (thread: Message) => {
    setTaskFromThread(thread);
  };
  
  const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
    const newTimeEntry = await db.addTimeEntry({...timeData, spaceId: activeSpace.id});
    setTimeEntries(prev => [...prev, newTimeEntry]);
  };
  
  const handleSaveProject = async (values: Omit<Project, 'id' | 'hubId'>, projectId?: string) => {
    if (!activeHub) {
        toast({ variant: 'destructive', title: 'No active hub selected' });
        return;
    }
    try {
        const projectData = { ...values, hubId: activeHub.id };
        if (projectId) {
            await handleUpdateProject(projectId, projectData);
            toast({ title: 'Project Updated' });
        } else {
            await handleAddProject(projectData);
            toast({ title: 'Project Created' });
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the project.'})
    }
  }


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
 
  const handleSaveChannel = async (channelData: Omit<Channel, 'id'>, channelId?: string) => {
    if (!activeHub) return;
    const dataWithHub = { ...channelData, hubId: activeHub.id };

    if (channelId) {
      await db.updateChannel(channelId, dataWithHub);
      setChannels(prev => prev.map(c => c.id === channelId ? { ...c, ...dataWithHub } : c));
      toast({ title: 'Channel Updated' });
    } else {
      const newChannel = await db.addChannel(dataWithHub);
      setChannels(prev => [...prev, newChannel]);
      setActiveChannelId(newChannel.id);
      toast({ title: 'Channel Created' });
    }
  };
  
  const handleSendMessageFromAgent = async (conversationId: string, messageContent: string, type: 'reply' | 'note') => {
    if (!appUser) return;
    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: conversationId,
      authorId: appUser.id,
      type: type,
      content: messageContent,
      timestamp: new Date().toISOString(),
    };
    
    const [newMessage, _] = await Promise.all([
        db.addChatMessage(newMessageData),
        db.updateConversation(conversationId, {
            lastMessage: messageContent,
            lastMessageAt: newMessageData.timestamp,
            lastMessageAuthor: appUser.name,
        })
    ]);
    
    setChatMessages(prev => [...prev, newMessage]);
    
    setChatConversations(prev => prev.map(convo => {
      if (convo.id === conversationId) {
        return {
          ...convo,
          lastMessage: messageContent,
          lastMessageAt: newMessage.timestamp,
          lastMessageAuthor: appUser.name,
        }
      }
      return convo;
    }).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
  };

  const handleSendMessageFromBotPreview = async (content: string) => {
    if (!activeHub) return;
    
    const contactId = 'preview-contact-1'; // Hardcoded for preview user
    const timestamp = new Date().toISOString();

    // Ensure preview contact exists
    const contact = await db.getOrCreateContact(contactId, { name: 'Preview User' });
    if (!chatContacts.some(c => c.id === contactId)) {
        setChatContacts(prev => [...prev, contact]);
    }
    
    let conversation: Conversation;
    const existingConvo = chatConversations.find(c => c.contactId === contactId && c.hubId === activeHub.id);
    
    if (existingConvo) {
        conversation = {
            ...existingConvo,
            lastMessage: content,
            lastMessageAt: timestamp,
            lastMessageAuthor: 'Preview User',
        };
        await db.updateConversation(conversation.id, {
            lastMessage: content,
            lastMessageAt: timestamp,
            lastMessageAuthor: 'Preview User',
        });
    } else {
        const newConversationData: Omit<Conversation, 'id'> = {
            hubId: activeHub.id,
            contactId: contactId,
            assigneeId: null,
            status: 'unassigned',
            lastMessage: content,
            lastMessageAt: timestamp,
            lastMessageAuthor: 'Preview User',
        };
        conversation = await db.addConversation(newConversationData);
    }
    
    const newMessageData: Omit<ChatMessage, 'id'> = {
        conversationId: conversation.id,
        authorId: contactId,
        type: 'message',
        content: content,
        timestamp: timestamp,
    };
    const newMessage = await db.addChatMessage(newMessageData);

    // Optimistic update of local state
    setChatConversations(prevConvos => {
      const otherConvos = prevConvos.filter(c => c.id !== conversation.id);
      return [conversation, ...otherConvos].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    });
    
    setChatMessages(prevMessages => [...prevMessages, newMessage]);
  };


  const handleAssignConversation = async (conversationId: string, assigneeId: string | null) => {
    const status = assigneeId ? 'open' : 'unassigned';
    await db.updateConversation(conversationId, { assigneeId, status });
    setChatConversations(prev =>
      prev.map(convo => {
        if (convo.id === conversationId) {
          return {
            ...convo,
            assigneeId: assigneeId,
            status: status,
          };
        }
        return convo;
      })
    );
  };
  
  const handleBotUpdate = async (botId: string, data: Partial<Bot>) => {
    await db.updateBot(botId, data);
    setBots(prev => prev.map(b => b.id === botId ? { ...b, ...data } : b));
    toast({ title: "Bot Updated" });
  }

  const handleBotAdd = async (bot: Omit<Bot, 'id'>) => {
      const newBot = await db.addBot(bot);
      setBots(prev => [...prev, newBot]);
  }


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
      statuses: activeHub.statuses || [],
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
      },
      onAddMessage: handleAddMessage,
       // Thread view specific prop
      activeThread: activeThread,
      onCloseThread: () => setActiveThread(null),
    };

    const messagesProps = {
        left: (
           <ChannelList 
             channels={channels}
             activeChannelId={activeChannelId}
             onChannelSelect={setActiveChannelId}
             onSaveChannel={handleSaveChannel}
             activeSpace={activeSpace}
             appUser={appUser}
            />
        ),
        center: <ChannelsView {...props} activeChannelId={activeChannelId} setMessages={setMessages} onCreateTask={handleCreateTaskFromThread} />,
        right: activeThread ? <ThreadView {...props} thread={activeThread} onClose={() => setActiveThread(null)} /> : undefined,
        threadOpen: !!activeThread,
    };

    switch (currentView) {
      case 'overview': return <div className="p-8"><Overview {...props} /></div>;
      case 'tasks': return (
        <TaskBoard 
          {...props}
          selectedProjectId={selectedProjectId}
          onNewProject={handleNewProject}
        />
      );
      case 'mytasks': return <div className="p-8"><MyTasksView {...props} /></div>;
      case 'documents': return <DocumentsView {...props} />;
      case 'settings': return <SettingsLayout {...props} onSendMessageFromBotPreview={handleSendMessageFromBotPreview} chatMessages={chatMessages} chatContacts={chatContacts} chatConversations={chatConversations} bots={bots} onBotUpdate={handleBotUpdate} onBotAdd={handleBotAdd} />;
      case 'team-timesheets': return <TeamTimesheets {...props} />;
      case 'messages': return <MessagesLayout {...messagesProps} />;
      case 'inbox': return <InboxLayout 
                            users={allUsers}
                            appUser={appUser}
                            contacts={chatContacts}
                            conversations={chatConversations}
                            messages={chatMessages}
                            onSendMessage={handleSendMessageFromAgent}
                            onAssignConversation={handleAssignConversation}
                         />;
      case 'mentions': return <div className="p-8"><MentionsThreadList {...props} mentions={unreadMentions} onClose={() => {}} onOpenThread={() => {}} /></div>;
      case 'all-threads': return <div className="p-8"><AllThreadsView {...props} isThreadUnread={() => false} /></div>;
      case 'channels': return <div className="p-8"><ChannelsView {...props} activeChannelId={activeChannelId} setMessages={setMessages} onCreateTask={handleCreateTaskFromThread} /></div>;
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
    <SidebarProvider>
      <div className="flex h-screen bg-background text-foreground">
        <AppSidebar
          view={currentView}
          onChangeView={handleViewChange}
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
        <div className="flex flex-1 overflow-hidden">
          {currentView === 'tasks' && (
             <ProjectSidebar
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onNewProject={handleNewProject}
            />
          )}
          <main className={cn(
            "flex-1",
            currentView === 'inbox' || currentView === 'messages' || currentView === 'tasks' || currentView === 'settings'
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          )}>
            {renderView()}
          </main>
        </div>

        <ProjectFormDialog 
          isOpen={isProjectFormOpen}
          onOpenChange={setIsProjectFormOpen}
          onSave={handleSaveProject}
          project={editingProject}
          spaceId={activeSpace?.id || ''}
          spaceMembers={allUsers.filter(u => activeSpace?.members[u.id])}
        />

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
    </SidebarProvider>
  );
}
