
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'next/navigation';

import Overview from './overview';
import TaskBoard from './task-board';
import SettingsLayout from './settings-layout';
import JobFlowTemplateBuilder from './job-flow-template-builder';
import PhaseTemplateBuilder from './phase-template-builder';
import TaskTemplateBuilder from './task-template-builder';
import JobFlowBoard from './job-flow-board';
import TaskDetailsDialog from './task-details-dialog';
import { useToast } from '@/hooks/use-toast';
import ProjectFormDialog from './project-form-dialog';
import InboxLayout from './inbox-layout';
import { AppView } from '@/lib/routes';
import ProjectSidebar from './project-sidebar';
import HelpCenterLayout from './help-center-layout';
import TeamTimesheets from './team-timesheets';
import ContactsLayout from './contacts/contacts-layout';
import DealsBoard from './deals-board';
import { DealFormValues } from './create-deal-dialog';
import { reindexArticleAction } from '@/app/actions/chat';
import TicketsBoard from './tickets-board';
import { ContentSkeleton } from './content-skeleton';

// Helper to determine if a mention is unread
const isUnread = (mention: any, lastRead: string | null) => {
  if (!lastRead) return true;
  const mentionDate = new Date('timestamp' in mention ? mention.timestamp : mention.createdAt);
  return mentionDate > new Date(lastRead);
};


export default function Dashboard({ view }: { view: string }) {
  const { appUser, signOut, activeSpace, userSpaces, setUserSpaces, setActiveSpace, activeHub, setActiveHub } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const [hideMobileBottomNav, setHideMobileBottomNav] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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
  const [escalationRules, setEscalationIntakeRules] = useState<EscalationIntakeRule[]>([]);

  // Help Center states
  const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
  
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
    if (!appUser || !activeSpace) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);

    if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
        messageUnsubscribeRef.current = null;
    }
    
    // Always fetch all users and space-wide conversations
    const [fetchedUsers, fetchedConversations] = await Promise.all([
        db.getAllUsers(),
        db.getConversationsForSpace(activeSpace.id),
    ]);
    setAllUsers(fetchedUsers);
    setChatConversations(fetchedConversations.sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));

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
    if (activeHub) {
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
            fetchedJobsTasks,
            fetchedHubs,
            fetchedBots,
            fetchedEscalationRules,
            fetchedContacts,
            fetchedHelpCenters,
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
            db.getBots(activeHub.id),
            db.getEscalationIntakeRules(activeHub.id),
            db.getContacts(activeSpace.id),
            db.getHelpCenters(activeHub.id),
        ]);
      
        setProjects(fetchedProjects);
        if (fetchedProjects.length > 0 && (!selectedProjectId || !fetchedProjects.some(p => p.id === selectedProjectId))) {
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
        setJobFlowTasks(fetchedJobsTasks);
        setSpaceHubs(fetchedHubs);
        setBots(fetchedBots);
        setEscalationIntakeRules(fetchedEscalationRules);
        setContacts(fetchedContacts);
        setHelpCenters(fetchedHelpCenters);
  
        if (fetchedConversations.length > 0) {
            const convoIds = fetchedConversations.map(c => c.id);
            const visitorIds = [...new Set(fetchedConversations.map(c => c.visitorId).filter(Boolean))];
            
            const fetchedVisitors = await Promise.all(
                visitorIds.map(id => db.getOrCreateVisitor(id!))
            );
            setVisitors(fetchedVisitors as Visitor[]);

            const unsub = db.getMessagesForConversations(convoIds, (messages) => {
                setChatMessages(messages);
            });
            messageUnsubscribeRef.current = unsub;
        } else {
            setChatMessages([]);
            setVisitors([]);
        }
    }
    setIsLoading(false);
  };


  useEffect(() => {
    if (activeSpace) {
      fetchData();
    } else if (appUser) {
        setIsLoading(false);
    }
    return () => {
      // Final cleanup when component dies
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
    };
  }, [appUser, activeSpace, activeHub]);

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
  
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/tasks`);
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


  if (isLoading) {
    return <ContentSkeleton />;
  }

  if (!appUser || !activeSpace || (view !== 'contacts' && !activeHub)) {
    return <ContentSkeleton />;
  }
  
  const handleUpdateTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    updatedTasks.forEach(task => {
        if(task.id) {
            db.updateTask(task.id, task);
        }
    })
  };

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
    if (!activeHub) {
        throw new Error("Cannot add task without an active hub.");
    }
    const now = new Date().toISOString();
    const creationActivity: Activity = {
        id: `act-creation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: appUser!.id,
        timestamp: now,
        type: 'task_creation',
    };
    const taskWithHub = { ...task, hubId: activeHub.id, spaceId: activeSpace.id, createdBy: appUser!.id, createdAt: now, activities: [...(task.activities || []), creationActivity] };
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

  const handleUpdateTickets = (updatedTickets: Ticket[]) => {
    setTickets(updatedTickets);
    updatedTickets.forEach(ticket => {
        if(ticket.id) {
            db.updateTicket(ticket.id, ticket);
        }
    })
  };
  
  const handleUpdateTicket = (updatedTicket: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
    db.updateTicket(updatedTicket.id, updatedTicket);
  };

  const handleCreateTicket = async (ticketData: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => {
    if (!appUser || !activeHub) return;
    
    const now = new Date().toISOString();
    const creationActivity: Activity = {
        id: `act-creation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: appUser.id,
        timestamp: now,
        type: 'ticket_creation',
    };

    let finalTicketData: Omit<Ticket, 'id'> = { 
        ...ticketData, 
        activities: [...(ticketData.activities || []), creationActivity] 
    };

    const convo = ticketData.conversationId ? chatConversations.find(c => c.id === ticketData.conversationId) : null;
    if (convo) {
      finalTicketData = {
        ...finalTicketData,
        lastMessagePreview: convo.lastMessage,
        lastMessageAt: convo.lastMessageAt,
        lastMessageAuthor: convo.lastMessageAuthor,
      }
    }
    
    const newTicket = await db.addTicket(finalTicketData);
    
    if (escalateNow && intakeRuleId) {
        await handleEscalateTicket(newTicket, intakeRuleId);
    } else {
        setTickets(prev => [...prev, newTicket]);
    }
    toast({ title: "Ticket created" });

    if (newTicket.conversationId) {
        await db.addChatMessage({
            conversationId: newTicket.conversationId,
            authorId: appUser.id,
            type: 'event',
            senderType: 'agent',
            content: `Ticket created: "${newTicket.title}"`,
            timestamp: new Date().toISOString(),
            linked_ticket_id: newTicket.id,
        });
    }
  };
  
  const handleEscalateTicket = async (ticket: Ticket, intakeRuleId: string) => {
    if (!appUser || !activeHub) return;

    const now = new Date().toISOString();
    let escalationUpdate: Partial<Ticket>['escalation'] = {};

    if (intakeRuleId.startsWith('intra-hub:')) {
        const projectId = intakeRuleId.split(':')[1];
        
        const linkedTaskData: Omit<Task, 'id'> = {
            name: `[Ticket] ${ticket.title}`,
            description: `Created from escalated ticket: ${ticket.id}\n\n> ${ticket.description || 'No description.'}`,
            project_id: projectId,
            hubId: activeHub.id,
            spaceId: activeSpace.id,
            status: 'Backlog',
            createdBy: appUser.id,
            createdAt: now,
            assigned_to: ticket.assignedTo || appUser.id,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            priority: ticket.priority,
            linkedTicketId: ticket.id,
            sprint_points: null,
            tags: ['escalated', ticket.type].filter(Boolean) as string[],
            time_estimate: null,
            parentId: null,
            relationships: [],
            comments: [],
            activities: [],
            attachments: [],
        };
        
        const newTask = await handleAddTask(linkedTaskData);
        if (newTask) {
            escalationUpdate = {
                status: 'sent',
                requestedAt: now,
                requestedBy: appUser.id,
                devBoardId: projectId,
                devItemId: newTask.id,
                lastKnownDevStatus: newTask.status,
                lastSyncedAt: now,
            };
        }
    } else {
        escalationUpdate = {
            status: 'queued',
            requestedAt: now,
            requestedBy: appUser.id,
            intakeRuleId: intakeRuleId,
        };
    }
    
    const updatedTicketData = {
        escalation: escalationUpdate,
        status: 'Escalated'
    };
    
    await db.updateTicket(ticket.id, updatedTicketData);
    
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updatedTicketData } : t));
    
    toast({ title: "Ticket Escalated", description: "A linked developer task has been created." });
  };
  
  const handleUpdateDeals = (updatedDeals: Deal[]) => {
    setDeals(updatedDeals);
    updatedDeals.forEach(deal => {
        if(deal.id) {
            db.updateDeal(deal.id, deal);
        }
    })
  };

  const handleAddDeal = async (dealData: DealFormValues) => {
    if (!appUser || !activeHub || !activeSpace) return;
    const now = new Date().toISOString();

    const fullDealData: Omit<Deal, 'id'> = {
      title: dealData.title,
      status: dealData.status,
      description: dealData.description || null,
      value: dealData.value || null,
      currency: 'USD',
      assignedTo: dealData.assignedTo || appUser.id,
      contactId: dealData.contactId || null,
      source: (dealData.source as any) || null,
      nextStep: dealData.nextStep || null,
      nextStepAt: dealData.nextStepAt?.toISOString() || null,
      closeDate: null,
      tags: [],
      hubId: activeHub.id,
      spaceId: activeSpace.id,
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

    const projectWithKey = { 
        ...project, 
        hubId: activeHub.id,
        taskCounter: 0,
    };

    const newProject = await db.addProject(projectWithKey);
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
 
  const handleSendMessageFromAgent = async (conversationId: string, messageContent: string, type: 'message' | 'note') => {
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
    
    if (type === 'message') {
        const updatedConversations = chatConversations.map(convo => {
          if (convo.id === conversationId) {
            return {
              ...convo,
              lastMessage: messageContent,
              lastMessageAt: newMessage.timestamp,
              lastMessageAuthor: appUser.name,
            }
          }
          return convo;
        }).sort((a,b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

        setChatConversations(updatedConversations);

        // Optimistically update ticket preview
        setTickets(prevTickets => prevTickets.map(ticket => {
            if (ticket.conversationId === conversationId) {
                return { ...ticket, lastMessagePreview: messageContent, lastMessageAt: newMessage.timestamp, lastMessageAuthor: appUser.name };
            }
            return ticket;
        }));
    }
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

  const handleBotDelete = async (botId: string) => {
    await db.deleteBot(botId);
    setBots(prev => prev.filter(b => b.id !== botId));
    toast({ title: "Bot Deleted" });
  };
  
  const handleSaveArticle = async (article: HelpCenterArticle | Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle | void> => {
    // This function will be handled entirely within the HelpCenterLayout now
    fetchData(); 
  };
  
  const handleLogTime = async (timeData: Omit<TimeEntry, 'id'>) => {
    const newTimeEntry = await db.addTimeEntry({...timeData, spaceId: activeSpace.id});
    setTimeEntries(prev => [...prev, newTimeEntry]);
  };
  
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  }

  const renderView = () => {
    const overviewProps = {
      projects,
      tasks,
      timeEntries,
      activeSpace,
      activeHub,
      allUsers,
      appUser,
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
      handleInvite: async (invite: Omit<Invite, 'id' | 'token' | 'status'>) => {
        const { token: _, ...rest } = invite; // Legacy token removal
        await db.addInvite(rest as any);
        fetchData();
      },
      projects,
      tasks,
      timeEntries,
      activeHub,
      onUpdateActiveHub: handleUpdateActiveHub,
      bots,
      onBotUpdate: handleBotUpdate,
      onBotAdd: handleBotAdd,
      onBotDelete: handleBotDelete,
      escalationRules,
      tickets,
      conversations: chatConversations,
    }

    const currentView = view as AppView;

    switch (currentView) {
      case 'overview': return <div className="overflow-y-auto p-8"><Overview {...overviewProps} /></div>;
      case 'tasks': return (
        <div className="flex h-full min-h-0 flex-1 min-w-0">
          {(projects.length > 0) && (
            <ProjectSidebar
              projects={projects}
              tasks={tasks}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onNewProject={handleNewProject}
            />
          )}
          <TaskBoard
            selectedProjectId={selectedProjectId}
            projects={projects}
            onSelectProject={handleSelectProject}
            allTasks={tasks}
            onUpdateTasks={handleUpdateTasks}
            activeHub={activeHub!}
            allUsers={allUsers}
            onUpdateActiveHub={handleUpdateActiveHub}
            onNewTaskRequest={handleNewTaskRequest}
            onTaskClick={handleTaskClick}
            onUpdateTask={handleUpdateTask}
            onAddTask={handleAddTask}
            onNewProject={handleNewProject}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
          />
        </div>
      );
      case 'tickets': return <TicketsBoard 
          tickets={tickets} 
          onUpdateTickets={handleUpdateTasks} 
          conversations={chatConversations}
          activeHub={activeHub!}
          activeSpace={activeSpace}
          allUsers={allUsers}
          onUpdateActiveHub={handleUpdateActiveHub}
          onNavigateToSettings={() => router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/settings`)}
          allHubs={spaceHubs}
          escalationRules={escalationRules}
          projects={projects}
          contacts={contacts}
          onDataRefresh={fetchData}
          onCreateTicket={handleCreateTicket}
          onEscalateTicket={handleEscalateTicket}
          allTasks={tasks}
          onTaskSelect={setSelectedTask}
      />;
      case 'deals': return <DealsBoard
          deals={deals}
          onUpdateDeals={handleUpdateDeals}
          onAddDeal={handleAddDeal}
          onDataRefresh={fetchData}
          contacts={contacts}
          activeHub={activeHub!}
          activeSpace={activeSpace}
          allUsers={allUsers}
          onUpdateActiveHub={handleUpdateActiveHub}
          onNavigateToSettings={() => router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/settings`)}
      />;
      case 'help-center': return <HelpCenterLayout bots={bots} />;
      case 'contacts': return <ContactsLayout activeSpace={activeSpace} />;
      case 'settings': return <SettingsLayout {...settingsProps} />;
      case 'team-timesheets': return <TeamTimesheets 
                                        allSpaces={userSpaces}
                                        allUsers={allUsers}
                                        projects={projects}
                                        tasks={tasks}
                                        timeEntries={timeEntries}
                                        appUser={appUser} 
                                        activeHub={activeHub}
                                      />;
      case 'inbox': return <InboxLayout
                            users={allUsers}
                            appUser={appUser}
                            visitors={visitors}
                            conversations={chatConversations}
                            messages={chatMessages}
                            onSendMessage={handleSendMessageFromAgent}
                            onAssignConversation={handleAssignConversation}
                            setHideMobileBottomNav={setHideMobileBottomNav}
                            activeHub={activeHub!}
                            activeSpace={activeSpace}
                            allHubs={allHubs}
                            escalationRules={escalationRules}
                            projects={projects}
                            contacts={contacts}
                            onDataRefresh={fetchData}
                            tickets={tickets}
                            onCreateTicket={handleCreateTicket}
                            onUpdateTicket={handleUpdateTicket}
                         />;
      default:
        return (
          <div className="p-8">
            <h1 className="text-2xl font-bold">Coming Soon: {view}</h1>
            <p>This view is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {renderView()}

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
          statuses={activeHub!.statuses?.map(s => s.name) || []}
          allUsers={allUsers}
          allTasks={tasks}
          projects={projects}
        />
      )}
    </div>
  );
}
