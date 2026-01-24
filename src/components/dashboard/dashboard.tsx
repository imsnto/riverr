// src/components/dashboard/dashboard.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/hooks/use-auth';
import {
  Space,
  User,
  Project,
  Task,
  TimeEntry,
  SlackMeetingLog,
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
  Visitor,
  Conversation,
  ChatMessage,
  Bot,
  HelpCenter,
  HelpCenterCollection,
  HelpCenterArticle,
  Ticket,
  Deal,
  EscalationIntakeRule,
  Contact,
} from '@/lib/data';
import * as db from '@/lib/db';
import { useRouter, useParams } from 'next/navigation';

import Overview from './overview';
import TaskBoard from './task-board';
import SettingsLayout from './settings-layout';
import JobFlowTemplateBuilder from './job-flow-template-builder';
import PhaseTemplateBuilder from './phase-template-builder';
import TaskTemplateBuilder from './task-template-builder';
import JobFlowBoard from './job-flow-board';
import TaskDetailsDialog from './task-details-dialog';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider } from '../ui/sidebar';
import ProjectFormDialog from './project-form-dialog';
import { ContentSkeleton } from './content-skeleton';
import InboxLayout from './inbox-layout';
import { cn } from '@/lib/utils';
import { AppView } from '@/lib/routes';
import ProjectSidebar from './project-sidebar';
import HelpCenterLayout from './help-center-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from './mobile-bottom-nav';
import TeamTimesheets from './team-timesheets';
import { DashboardSkeleton } from './dashboard-skeleton';
import ContactsLayout from './contacts/contacts-layout';
import TicketsBoard from './tickets-board';
import DealsBoard from './deals-board';

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
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const isMobile = useIsMobile();

  const [currentView, setCurrentView] = useState<AppView>(view as AppView || 'overview');
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [slackLogs, setSlackLogs] = useState<SlackMeetingLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Messaging states
  const [spaceHubs, setSpaceHubs] = useState<Hub[]>([]);
  
  // Inbox state
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationIntakeRule[]>([]);

  // Help Center states - now managed within HelpCenterLayout
  
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
  
  // Project Management
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);


  const fetchData = async () => {
    if (!appUser) return;
if (messageUnsubscribeRef.current) {
    messageUnsubscribeRef.current();
    messageUnsubscribeRef.current = null;
  }
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
            fetchedTickets,
            fetchedDeals,
            fetchedSlackLogs,
            fetchedJobFlowTemplates,
            fetchedPhaseTemplates,
            fetchedTaskTemplates,
            fetchedJobs,
            fetchedJobFlowTasks,
            fetchedHubs,
            fetchedConversations,
            fetchedBots,
            fetchedEscalationRules,
            fetchedContacts,
          ] = await Promise.all([
            db.getProjectsInHub(activeHub.id),
            db.getAllTasks(activeHub.id),
            db.getTicketsInHub(activeHub.id),
            db.getDealsInHub(activeHub.id),
            db.getSlackMeetingLogsInSpace(activeSpace.id), // This is space-wide for now
            db.getJobFlowTemplates(activeHub.id),
            db.getPhaseTemplates(activeHub.id),
            db.getTaskTemplates(activeHub.id),
            db.getAllJobs(activeHub.id),
            db.getAllJobFlowTasks(activeHub.id),
            db.getHubsForSpace(activeSpace.id),
            db.getConversationsForHub(activeHub.id),
            db.getBots(activeHub.id),
            db.getEscalationIntakeRules(activeHub.id),
            db.getContacts(activeSpace.id),
          ]);
          
          setProjects(fetchedProjects);
          if (!selectedProjectId && fetchedProjects.length > 0) {
            setSelectedProjectId(fetchedProjects[0].id);
          } else if (fetchedProjects.length === 0) {
            setSelectedProjectId(null);
          }


          setTasks(fetchedTasks);
          setTickets(fetchedTickets);
          setDeals(fetchedDeals);
          setSlackLogs(fetchedSlackLogs);
          setJobFlowTemplates(fetchedJobFlowTemplates);
          setPhaseTemplates(fetchedPhaseTemplates);
          setTaskTemplates(fetchedTaskTemplates);
          setJobs(fetchedJobs);
          setJobFlowTasks(fetchedJobFlowTasks);
          setSpaceHubs(fetchedHubs);
          setChatConversations(fetchedConversations.sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
          setBots(fetchedBots);
          setEscalationRules(fetchedEscalationRules);
          setContacts(fetchedContacts);
      
// ... (top of your fetchData)

if (fetchedConversations.length > 0) {
  const convoIds = fetchedConversations.map(c => c.id);
  
  // 1. Visitors: Awaited once (Static)
  const visitorIds = [...new Set(fetchedConversations.map(c => c.visitorId).filter(Boolean))];
  const fetchedVisitors = await Promise.all(
    visitorIds.map(id => db.getOrCreateVisitor(id!))
  );
  setVisitors(fetchedVisitors as Visitor[]);

  // 2. Messages: Real-time (Subscription)
  // We don't 'await' this. It will call setChatMessages whenever something changes.
  const unsub = db.getMessagesForConversations(convoIds, (messages) => {
    setChatMessages(messages);
  });
  
  // Store the unsubscribe function in our Ref
  messageUnsubscribeRef.current = unsub;

} else {
  setChatMessages([]);
  setVisitors([]);
}
        }
  };


  useEffect(() => {
    fetchData();
    return () => {
      // Final cleanup when component dies
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
    };
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

  useEffect(() => {
    if (!appUser) return;

    const calculateMentions = () => {
        const allMentions: any[] = [];
        const userMention = `@${appUser.name}`;

        // Mentions from task activities/comments
        tasks.forEach(task => {
            const taskMentions = (task.activities || [])
                .filter(activity => activity.type === 'comment' && activity.comment?.includes(userMention))
                .map(activity => ({
                    ...activity,
                    parentType: 'task' as const,
                    parentId: task.id,
                    parentName: task.name,
                }));
            allMentions.push(...taskMentions);
        });

        const unread = allMentions.filter(m => isUnread(m, lastMentionsRead));
        // Sort by date descending
        unread.sort((a, b) => new Date('timestamp' in b ? b.timestamp : b.createdAt).getTime() - new Date('timestamp' in a ? a.timestamp : a.createdAt).getTime());
        setUnreadMentions(unread);
    };

    calculateMentions();

  }, [appUser, tasks, lastMentionsRead]);


  // Handle view change from sidebar
  const handleViewChange = (newView: AppView) => {
    setCurrentView(newView);
    if (activeSpace && params.hubId) {
      router.push(`/space/${activeSpace.id}/hub/${params.hubId}/${newView}`);
    } else if (newView === 'contacts') {
      router.push('/contacts');
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
  
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      setCurrentView('tasks');
    }
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setIsProjectFormOpen(true);
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  };
  
  const handleDeleteProject = async (projectId: string) => {
      await db.deleteProject(projectId);
      const newProjects = projects.filter(p => p.id !== projectId);
      setProjects(newProjects);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(newProjects.length > 0 ? newProjects[0].id : null);
      }
      toast({ title: 'Project Deleted' });
  }

  // Switch to the correct view when URL changes
  useEffect(() => {
    if (view && view !== currentView) {
      setCurrentView(view as AppView);
    }
  }, [view, currentView]);

  if (!appUser || !activeSpace || !activeHub) {
    return <DashboardSkeleton />;
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
  
  const handleAddTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    const now = new Date().toISOString();
    const creationActivity: Activity = {
        id: `act-creation-${Date.now()}`,
        user_id: appUser!.id,
        timestamp: now,
        type: 'task_creation',
    };
    const taskWithHub = { ...task, hubId: activeHub.id, spaceId: activeSpace.id, createdBy: appUser!.id, createdAt: now, activities: [creationActivity, ...(task.activities || [])] };
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

  const handleNewTaskRequest = (status?: string) => {
    if (!appUser || !activeHub || !selectedProjectId) {
      toast({
        title: "Cannot Create Task",
        description: "Please select a project before creating a new task.",
        variant: "destructive",
      });
      return;
    }

    const newTaskTemplate: Task & { isNew?: boolean } = {
      id: `new-task-${Date.now()}`, // Temporary ID
      name: "", // Empty name for creation
      description: "",
      project_id: selectedProjectId,
      hubId: activeHub.id,
      spaceId: activeSpace.id,
      status: status || (activeHub.statuses && activeHub.statuses[0].name) || "Backlog",
      assigned_to: appUser.id,
      createdBy: appUser.id,
      createdAt: new Date().toISOString(),
      due_date: new Date().toISOString(),
      priority: "Medium",
      sprint_points: null,
      tags: [],
      time_estimate: null,
      parentId: null,
      relationships: [],
      comments: [],
      activities: [],
      attachments: [],
      isNew: true, // Flag for creation mode
    };
    setSelectedTask(newTaskTemplate as Task);
  };
  
  const handleUpdateTickets = (updatedTickets: Ticket[]) => {
    setTickets(updatedTickets);
    updatedTickets.forEach(ticket => {
        if(ticket.id) {
            db.updateTicket(ticket.id, ticket);
        }
    })
  };
  
  const handleUpdateDeals = (updatedDeals: Deal[]) => {
    setDeals(updatedDeals);
    updatedDeals.forEach(deal => {
        if(deal.id) {
            db.updateDeal(deal.id, deal);
        }
    })
  };

  const handleAddDeal = async (dealData: Omit<Deal, 'id' | 'hubId' | 'spaceId' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt' | 'isStale' | 'lastActivityAt' >) => {
    if (!appUser || !activeHub || !activeSpace) return;
    const now = new Date().toISOString();

    const fullDealData: Omit<Deal, 'id'> = {
      ...dealData,
      hubId: activeHub.id,
      spaceId: activeSpace.id,
      status: activeHub.dealStatuses?.[0]?.name || 'New Lead',
      createdAt: now,
      createdBy: appUser.id,
      updatedAt: now,
      lastActivityAt: now,
      isStale: false,
    };
    
    const newDeal = await db.addDeal(fullDealData);
    setDeals(prev => [...prev, newDeal]);
    toast({ title: 'Deal Created' });
  };


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
 
  const handleSendMessageFromAgent = async (conversationId: string, messageContent: string, type: 'reply' | 'note') => {
    if (!appUser) return;
    const newMessageData: Omit<ChatMessage, 'id'> = {
      conversationId: conversationId,
      authorId: appUser.id,
      type: type,
      senderType: 'agent',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };
    
    const newMessage = await db.addChatMessage(newMessageData);
    
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
    
    const visitorId = 'preview-contact-1'; // Hardcoded for preview user
    const timestamp = new Date().toISOString();

    // Ensure preview visitor exists
    const visitor = await db.getOrCreateVisitor(visitorId, { name: 'Preview User' });
    if (!visitors.some(c => c.id === visitorId)) {
        setVisitors(prev => [...prev, visitor]);
    }
    
    let conversation: Conversation;
    const existingConvo = chatConversations.find(c => c.visitorId === visitorId && c.hubId === activeHub.id);
    
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
            contactId: null,
            visitorId: visitorId,
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
        authorId: visitorId,
        type: 'message',
        senderType: 'contact',
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
  
  const handleSaveArticle = async (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
    let savedArticle: HelpCenterArticle;
    if ('id' in article && article.id) {
        await db.updateHelpCenterArticle(article.id, article);
        savedArticle = article;
    } else {
        savedArticle = await db.addHelpCenterArticle(article as Omit<HelpCenterArticle, 'id'>);
    }
    // After saving, update the parent folder's timestamp
    if (savedArticle.folderId) {
        try {
            await db.updateHelpCenterCollection(savedArticle.folderId, { updatedAt: new Date().toISOString() });
        } catch (e) {
            console.error("Could not update parent folder timestamp", e);
        }
    }
    fetchData(); // Refresh all data to ensure consistency
    return savedArticle;
  };
  
  const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
    const newTimeEntry = await db.addTimeEntry({...timeData, spaceId: activeSpace.id});
    setTimeEntries(prev => [...prev, newTimeEntry]);
  };

  const renderView = () => {
    const overviewProps = {
      tasks,
      projects,
      activeSpace,
      activeHub,
      allUsers,
      appUser,
      timeEntries,
      unreadMentions,
      onTaskSelect: setSelectedTask,
      jobs,
      jobFlowTemplates,
      jobFlowTasks,
      onUpdateTask: handleUpdateTask,
      onDataRefresh: fetchData,
    };
    
    const settingsProps = {
      allUsers,
      allSpaces: userSpaces,
      allHubs: spaceHubs,
      onSave: handleSpaceSave,
      onDelete: db.deleteSpace,
      appUser,
      onInvite: fetchData,
      handleInvite: async (invite: any) => {
          const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
          await db.addInvite({ ...invite, token, invitedBy: appUser.id, status: 'pending' });
          fetchData();
      },
      projects,
      tasks,
      timeEntries,
      activeHub,
      onUpdateActiveHub: handleUpdateActiveHub,
      onSendMessageFromBotPreview: handleSendMessageFromBotPreview,
      chatMessages,
      visitors,
      chatConversations,
      bots,
      onBotUpdate: handleBotUpdate,
      onBotAdd: handleBotAdd,
      escalationRules,
    }


    switch (currentView) {
      case 'overview': return <div className="p-8"><Overview {...overviewProps} /></div>;
      case 'tasks': return (
        <TaskBoard 
          tasks={tasks}
          onUpdateTasks={handleUpdateTasks}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          activeHub={activeHub}
          allUsers={allUsers}
          onUpdateActiveHub={handleUpdateActiveHub}
          onNewProject={handleNewProject}
          onNewTaskRequest={handleNewTaskRequest}
          onTaskClick={setSelectedTask}
          onUpdateTask={handleUpdateTask}
          onAddTask={handleAddTask}
          onEditProject={handleEditProject}
          onDeleteProject={handleDeleteProject}
        />
      );
      case 'tickets': return <TicketsBoard 
          tickets={tickets} 
          onUpdateTickets={handleUpdateTickets} 
          visitors={visitors} 
          conversations={chatConversations}
          activeHub={activeHub}
          activeSpace={activeSpace}
          allUsers={allUsers}
          onUpdateActiveHub={handleUpdateActiveHub}
          onNavigateToSettings={() => handleViewChange('settings')}
          allHubs={spaceHubs}
          escalationRules={escalationRules}
          projects={projects}
      />;
      case 'deals': return <DealsBoard
          deals={deals}
          onUpdateDeals={handleUpdateDeals}
          onAddDeal={handleAddDeal}
          contacts={contacts}
          activeHub={activeHub}
          activeSpace={activeSpace}
          allUsers={allUsers}
          onUpdateActiveHub={handleUpdateActiveHub}
          onNavigateToSettings={() => handleViewChange('settings')}
      />;
      case 'help-center': return <HelpCenterLayout
        onSaveArticle={handleSaveArticle}
        />;
      case 'contacts': return <ContactsLayout activeSpace={activeSpace} />;
      case 'settings': return <SettingsLayout {...settingsProps} />;
      case 'team-timesheets': return <TeamTimesheets 
                                        allSpaces={userSpaces}
                                        allUsers={allUsers}
                                        projects={projects}
                                        tasks={tasks}
                                        timeEntries={timeEntries}
                                        appUser={appUser} />;
      case 'inbox': return <InboxLayout 
                            users={allUsers}
                            appUser={appUser}
                            visitors={visitors}
                            conversations={chatConversations}
                            messages={chatMessages}
                            onSendMessage={handleSendMessageFromAgent}
                            onAssignConversation={handleAssignConversation}
                         />;
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
      <div className="flex h-screen min-h-0 w-full bg-background text-foreground">
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
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {(currentView === 'tasks' && projects.length > 0) && (
             <ProjectSidebar
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onNewProject={handleNewProject}
            />
          )}
          <main
            className={cn(
              "flex flex-col flex-1 min-h-0",
              currentView === 'inbox' ||
              currentView === 'tasks' ||
              currentView === 'tickets' ||
              currentView === 'deals' ||
              currentView === 'settings' ||
              currentView === 'contacts' ||
              (currentView === 'help-center' && !isMobile)
                ? "overflow-hidden"
                : "overflow-y-auto",
              isMobile && "pb-20"
            )}
          >
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
      </div>
      {isMobile && activeHub && (
        <MobileBottomNav
          currentView={currentView}
          onChangeView={handleViewChange}
          activeHub={activeHub}
        />
      )}
    </SidebarProvider>
  );
}
