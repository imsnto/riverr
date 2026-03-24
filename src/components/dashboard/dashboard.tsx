
// src/components/dashboard/dashboard.tsx
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
import { reindexArticleAction, addChatMessage as addChatMessageAction } from '@/app/actions/chat';
import TicketsBoard from './tickets-board';
import { ContentSkeleton } from './content-skeleton';
import { LayoutTemplate } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';

const isUnread = (mention: any, lastRead: string | null) => {
  if (!lastRead) return true;
  const mentionDate = new Date('timestamp' in mention ? mention.timestamp : mention.createdAt);
  return mentionDate > new Date(lastRead);
};

function generateProjectKey(name: string): string {
    return name
        .split(/\s+/)
        .map(word => word[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 3);
}

export default function Dashboard({ view }: { view: string }) {
  const { appUser, activeSpace, userSpaces, setUserSpaces, setActiveSpace, activeHub, setActiveHub } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);
  const conversationUnsubscribeRef = useRef<(() => void) | null>(null);
  const contactsUnsubscribeRef = useRef<(() => void) | null>(null);
  const [hideMobileBottomNav, setHideMobileBottomNav] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [slackLogs, setSlackLogs] = useState<SlackMeetingLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allHubs, setAllHubs] = useState<Hub[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [escalationRules, setEscalationIntakeRules] = useState<EscalationIntakeRule[]>([]);
  const [helpCenters, setHelpCenters] = useState<HelpCenter[]>([]);
  const [lastMentionsRead, setLastMentionsRead] = useState<string | null>(null);
  const [unreadMentions, setUnreadMentions] = useState<any[]>([]);
  const [jobFlowTemplates, setJobFlowTemplates] = useState<JobFlowTemplate[]>([]);
  const [phaseTemplates, setPhaseTemplates] = useState<PhaseTemplate[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobFlowTasks, setJobFlowTasks] = useState<JobFlowTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const fetchData = async () => {
    if (!appUser) {
        setIsLoading(false);
        return;
    }
    
    const fetchedUsers = await db.getAllUsers();
    setAllUsers(fetchedUsers);

    if (!activeSpace) {
        setIsLoading(false);
        return;
    }

    if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
        messageUnsubscribeRef.current = null;
    }
    if (conversationUnsubscribeRef.current) {
        conversationUnsubscribeRef.current();
        conversationUnsubscribeRef.current = null;
    }
    if (contactsUnsubscribeRef.current) {
        contactsUnsubscribeRef.current();
        contactsUnsubscribeRef.current = null;
    }

    contactsUnsubscribeRef.current = db.subscribeToContacts(activeSpace.id, (updatedContacts) => {
        updatedContacts.sort((a, b) => {
            const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
            const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
            return dateB.getTime() - dateA.getTime();
        });
        setContacts(updatedContacts);
    });

    const hubs = await db.getHubsForSpace(activeSpace.id);
    const hubIds = hubs.map(h => h.id);
    setAllHubs(hubs);

    const targetHubIds = activeHub ? [activeHub.id] : hubIds;

    if (targetHubIds.length > 0) {
        const qConvos = query(
            collection(firestoreDb, 'conversations'), 
            where('hubId', 'in', targetHubIds.slice(0, 10))
        );
        conversationUnsubscribeRef.current = onSnapshot(qConvos, (snapshot) => {
            const convos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
            convos.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
            setChatConversations(convos);
            
            const visitorIds = [...new Set(convos.map(c => c.visitorId).filter(Boolean))];
            Promise.all(visitorIds.map(id => db.getOrCreateVisitor(id!))).then(v => setVisitors(v as Visitor[]));

            const convoIds = convos.map(c => c.id);
            if (messageUnsubscribeRef.current) messageUnsubscribeRef.current();
            messageUnsubscribeRef.current = db.getMessagesForConversations(convoIds, (messages) => { setChatMessages(messages); });
        }, (error) => {
            console.error("Conversation sync failed:", error);
        });
    }

    const allUserSpaces = await db.getSpacesForUser(appUser.id);
    const allProjectIds: string[] = [];
    for (const space of allUserSpaces) {
        const hubsInSpace = await db.getHubsForSpace(space.id);
        for (const hub of hubsInSpace) {
            const hubProjects = await db.getProjectsInHub(hub.id);
            allProjectIds.push(...hubProjects.map(p => p.id));
        }
    }
    const fetchedTimeEntries = await db.getTimeEntriesInHub(allProjectIds);
    setTimeEntries(fetchedTimeEntries);

    if (activeHub) {
        const [
            fetchedProjects, fetchedTasks, fetchedTickets, fetchedDeals, fetchedSlackLogs,
            fetchedJobFlowTemplates, fetchedPhaseTemplates, fetchedTaskTemplates, fetchedJobs,
            fetchedJobsTasks, fetchedBots, fetchedEscalationRules, fetchedHelpCenters,
        ] = await Promise.all([
            db.getProjectsInHub(activeHub.id),
            db.getAllTasks(activeHub.id),
            db.getTicketsInHub(activeHub.id),
            db.getDealsInHub(activeHub.id),
            db.getSlackMeetingLogsInSpace(activeSpace.id), 
            db.getJobFlowTemplates(activeHub.id),
            db.getPhaseTemplates(activeHub.id),
            db.getTaskTemplates(activeHub.id),
            db.getAllJobs(activeHub.id),
            db.getAllJobFlowTasks(activeHub.id),
            db.getBots(activeHub.id),
            db.getEscalationIntakeRules(activeHub.id),
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
        setBots(fetchedBots);
        setEscalationIntakeRules(fetchedEscalationRules);
        setHelpCenters(fetchedHelpCenters);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (appUser) {
      setIsLoading(true);
      fetchData();
    }
    return () => { 
        if (messageUnsubscribeRef.current) messageUnsubscribeRef.current(); 
        if (conversationUnsubscribeRef.current) conversationUnsubscribeRef.current();
        if (contactsUnsubscribeRef.current) contactsUnsubscribeRef.current();
    };
  }, [appUser?.id, activeSpace?.id, activeHub?.id]);

  useEffect(() => {
    if (!appUser) return;
    const calculateMentions = () => {
        const allMentions: any[] = [];
        const userMention = `@${appUser.name}`;
        tasks.forEach(task => {
            const taskMentions = (task.activities || [])
                .filter(activity => activity.type === 'comment' && activity.comment?.includes(userMention))
                .map(activity => ({ ...activity, parentType: 'task' as const, parentId: task.id, parentName: task.name }));
            allMentions.push(...taskMentions);
        });
        const unread = allMentions.filter(m => isUnread(m, lastMentionsRead));
        unread.sort((a, b) => new Date('timestamp' in b ? b.timestamp : b.createdAt).getTime() - new Date('timestamp' in a ? a.timestamp : a.createdAt).getTime());
        setUnreadMentions(unread);
    };
    calculateMentions();
  }, [appUser, tasks, lastMentionsRead]);
  
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (projectId) router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/tasks`);
  };

  const handleNewProject = () => { setEditingProject(null); setIsProjectFormOpen(true); }
  const handleEditProject = (p: Project) => { setEditingProject(p); setIsProjectFormOpen(true); };
  const handleDeleteProject = async (pid: string) => {
      await db.deleteProject(pid);
      const newProjects = projects.filter(p => p.id !== pid);
      setProjects(newProjects);
      if (selectedProjectId === pid) setSelectedProjectId(newProjects.length > 0 ? newProjects[0].id : null);
      toast({ title: 'Project Deleted' });
  }

  const handleUpdateTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    updatedTasks.forEach(task => { if(task.id) db.updateTask(task.id, task); })
  };

  const handleNewTaskRequest = (status?: string) => {
    if (!appUser || !activeHub || !selectedProjectId) {
      toast({ title: "Cannot Create Task", description: "Please select a project before creating a new task.", variant: "destructive" });
      return;
    }
    const newTaskTemplate: Task & { isNew?: boolean } = {
      id: `new-task-${Date.now()}`, name: "", description: "", project_id: selectedProjectId,
      hubId: activeHub.id, spaceId: activeSpace!.id, status: status || (activeHub.statuses && activeHub.statuses[0].name) || "Backlog",
      assigned_to: appUser.id, createdBy: appUser.id, createdAt: new Date().toISOString(),
      due_date: new Date().toISOString(), priority: "Medium", sprint_points: null, tags: [],
      time_estimate: null, parentId: null, relationships: [], comments: [], activities: [], attachments: [], isNew: true,
    };
    setSelectedTask(newTaskTemplate as Task);
  };

  const handleUpdateTask = (task: Task, tempId?: string) => {
    setTasks(prev => {
        const idx = prev.findIndex(t => t.id === (tempId || task.id));
        if (idx !== -1) { const nt = [...prev]; nt[idx] = task; return nt; }
        return [...prev, task];
    });
    if (selectedTask && selectedTask.id === (tempId || task.id)) setSelectedTask(task);
    db.updateTask(task.id, task);
  };
  
  const handleAddTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    if (!activeHub) throw new Error("No active hub.");
    const now = new Date().toISOString();
    
    let taskKey = task.taskKey;
    if (!taskKey && task.project_id) {
        const project = projects.find(p => p.id === task.project_id);
        if (project) {
            const nextNumber = (project.taskCounter || 0) + 1;
            const pKey = project.key || generateProjectKey(project.name);
            taskKey = `${pKey}-${nextNumber}`;
        }
    }

    const creationActivity: Activity = { id: `act-creation-${Date.now()}`, user_id: appUser!.id, timestamp: now, type: 'task_creation' };
    const taskWithHub = { 
        ...task, 
        taskKey,
        hubId: activeHub.id, 
        spaceId: activeSpace!.id, 
        createdBy: appUser!.id, 
        createdAt: now, 
        activities: [...(task.activities || []), creationActivity] 
    };
    const newTask = await db.addTask(taskWithHub);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }

  const handleDeleteTask = async (tid: string) => {
      await db.deleteTask(tid);
      setTasks(prev => prev.filter(t => t.id !== tid));
      if (selectedTask && selectedTask.id === tid) setSelectedTask(null);
  }

  const handleUpdateTickets = (updatedTickets: Ticket[]) => {
    setTickets(updatedTickets);
    updatedTickets.forEach(ticket => { if(ticket.id) db.updateTicket(ticket.id, ticket); })
  };
  
  const handleUpdateTicket = (ut: Ticket) => {
    setTickets(prev => prev.map(t => t.id === ut.id ? ut : t));
    db.updateTicket(ut.id, ut);
  };

  const handleCreateTicket = async (td: Omit<Ticket, 'id'>, escalateNow: boolean, intakeRuleId?: string) => {
    if (!appUser || !activeHub) return;
    const now = new Date().toISOString();
    const creationActivity: Activity = { id: `act-creation-${Date.now()}`, user_id: appUser.id, timestamp: now, type: 'ticket_creation' };
    let finalTicketData: Omit<Ticket, 'id'> = { ...td, activities: [...(td.activities || []), creationActivity] };
    const convo = td.conversationId ? chatConversations.find(c => c.id === td.conversationId) : null;
    if (convo) finalTicketData = { ...finalTicketData, lastMessagePreview: convo.lastMessage, lastMessageAt: convo.lastMessageAt, lastMessageAuthor: convo.lastMessageAuthor };
    const newTicket = await db.addTicket(finalTicketData);
    if (escalateNow && intakeRuleId) await handleEscalateTicket(newTicket, intakeRuleId);
    else setTickets(prev => [...prev, newTicket]);
    toast({ title: "Ticket created" });
    if (newTicket.conversationId) {
        await addChatMessageAction({ conversationId: newTicket.conversationId, authorId: appUser.id, type: 'event', senderType: 'agent', content: `Ticket created: "${newTicket.title}"`, timestamp: new Date().toISOString(), linked_ticket_id: newTicket.id });
    }
  };
  
  const handleEscalateTicket = async (ticket: Ticket, intakeRuleId: string) => {
    if (!appUser || !activeHub) return;
    const now = new Date().toISOString();
    let escalationUpdate: Partial<Ticket>['escalation'] = {};
    if (intakeRuleId.startsWith('intra-hub:')) {
        const projectId = intakeRuleId.split(':')[1];
        const linkedTaskData: Omit<Task, 'id'> = {
            name: `[Ticket] ${ticket.title}`, description: `Created from escalated ticket: ${ticket.id}\n\n> ${ticket.description || 'No description.'}`,
            project_id: projectId, hubId: activeHub.id, spaceId: activeSpace!.id, status: 'Backlog',
            createdBy: appUser.id, createdAt: now, assigned_to: ticket.assignedTo || appUser.id,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), priority: ticket.priority,
            linkedTicketId: ticket.id, sprint_points: null, tags: ['escalated', ticket.type].filter(Boolean) as string[],
            time_estimate: null, parentId: null, relationships: [], comments: [], activities: [], attachments: [],
        };
        const newTask = await handleAddTask(linkedTaskData);
        if (newTask) escalationUpdate = { status: 'sent', requestedAt: now, requestedBy: appUser.id, devBoardId: projectId, devItemId: newTask.id, lastKnownDevStatus: newTask.status, lastSyncedAt: now };
    } else escalationUpdate = { status: 'queued', requestedAt: now, requestedBy: appUser.id, intakeRuleId: intakeRuleId };
    const upd = { escalation: escalationUpdate, status: 'Escalated' };
    await db.updateTicket(ticket.id, upd);
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...upd } : t));
    toast({ title: "Ticket Escalated", description: "A linked developer task has been created." });
  };
  
  const handleUpdateDeals = (uds: Deal[]) => {
    setDeals(uds);
    uds.forEach(d => { if(d.id) db.updateDeal(d.id, d); })
  };

  const handleAddDeal = async (dd: DealFormValues) => {
    if (!appUser || !activeHub || !activeSpace) return;
    const now = new Date().toISOString();
    const fdd: Omit<Deal, 'id'> = {
      title: dd.title, status: dd.status, description: dd.description || null, value: dd.value || null,
      currency: 'USD', closeDate: null, nextStep: dd.nextStep || null, nextStepAt: dd.nextStepAt?.toISOString() || null,
      assignedTo: dd.assignedTo || appUser.id, contactId: dd.contactId || null, source: (dd.source as any) || null,
      tags: [], hubId: activeHub.id, spaceId: activeSpace.id, createdAt: now, createdBy: appUser.id, updatedAt: now, lastActivityAt: now, isStale: false,
    };
    const newDeal = await db.addDeal(fdd);
    setDeals(prev => [...prev, newDeal]);
    toast({ title: 'Deal Created' });
  };

  const handleUpdateActiveHub = async (ud: Partial<Hub>) => {
    if (!activeHub) return;
    try {
        await db.updateHub(activeHub.id, ud);
        const updatedHub = { ...activeHub, ...ud };
        setActiveHub(updatedHub);
        setAllHubs(prev => prev.map(h => h.id === activeHub.id ? updatedHub : h));
    } catch(e) { toast({ variant: 'destructive', title: 'Failed to update hub' }); }
  }

  const handleAddProject = async (p: Omit<Project, 'id' | 'hubId'>) => {
    if (!activeHub) return;
    const newProject = await db.addProject({ ...p, hubId: activeHub.id, taskCounter: 0 });
    setProjects(prev => [...prev, newProject]);
    setSelectedProjectId(newProject.id);
  }

  const handleUpdateProject = async (pid: string, d: Partial<Project>) => {
      await db.updateProject(pid, d);
      setProjects(prev => prev.map(p => p.id === pid ? { ...p, ...d } : p));
  }
  
  const handleSaveProject = async (values: Omit<Project, 'id' | 'hubId'>, pid?: string) => {
    if (!activeHub) { toast({ variant: 'destructive', title: 'No active hub selected' }); return; }
    try {
        const projectKey = values.key || generateProjectKey(values.name);
        const pd = { ...values, hubId: activeHub.id, key: projectKey };
        if (pid) { await handleUpdateProject(pid, pd); toast({ title: 'Project Updated' }); }
        else { await handleAddProject(pd); toast({ title: 'Project Created' }); }
    } catch (e) { toast({ variant: 'destructive', title: 'Save failed' }) }
  }

  const handleSpaceSave = async (sd: Partial<Omit<Space, 'id'>>, sid?: string) => {
    if (!sid) return;
    await db.updateSpace(sid, sd);
    toast({ title: 'Space Updated' });
    const us = await db.getSpacesForUser(appUser!.id);
    setUserSpaces(us);
    const aus = us.find(s => s.id === sid); 
    if (aus) setActiveSpace(aus);
 };
 
  const handleSendMessageFromAgent = async (cid: string, content: string, type: 'message' | 'note') => {
    if (!appUser) return;
    
    const messageData: Omit<ChatMessage, "id"> = { 
      conversationId: cid, 
      authorId: appUser.id, 
      type, 
      senderType: 'agent', 
      content, 
      timestamp: new Date().toISOString() 
    };

    await addChatMessageAction(messageData);
  };

  const handleAssignConversation = async (cid: string, aid: string[]) => {
    const status = aid.length > 0 ? 'open' : 'unassigned';
    await db.updateConversation(cid, { 
        assigneeId: aid.length > 0 ? aid[0] : null, 
        assignedAgentIds: aid,
        status 
    });
  };
  
  // ---- BOT FORGE CRUD HANDLERS ----
  const handleBotUpdate = async (bid: string, d: Partial<Bot>) => {
    await db.updateBot(bid, d);
    setBots(prev => prev.map(b => b.id === bid ? { ...b, ...d } : b));
    toast({ title: "Bot Updated" });
  }
  const handleBotAdd = async (b: Omit<Bot, 'id'>) => { 
    const nb = await db.addBot(b); 
    setBots(prev => [...prev, nb]); 
  }
  const handleBotDelete = async (bid: string) => { 
    await db.deleteBot(bid); 
    setBots(prev => prev.filter(b => b.id !== bid)); 
    toast({ title: "Bot Deleted" }); 
  };

  const handleLogTime = async (td: Omit<TimeEntry, 'id'>) => {
    const nte = await db.addTimeEntry({...td, spaceId: activeSpace!.id});
    setTimeEntries(prev => [...prev, nte]);
  };

  const renderView = () => {
    const hubRequiredViews = ['overview', 'tasks', 'tickets', 'deals', 'inbox', 'help-center'];
    const isHubRequired = hubRequiredViews.includes(view);

    if (isHubRequired && !activeHub) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-card">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <LayoutTemplate className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Select a Hub</h3>
                <p className="text-muted-foreground max-sm">
                    Please select a hub from the sidebar workspace menu to view your {view}.
                </p>
            </div>
        );
    }

    const op = { projects, tasks, timeEntries, activeSpace, activeHub, allUsers, appUser, unreadMentions, onTaskSelect: setSelectedTask, jobs, jobFlowTemplates, jobFlowTasks, onUpdateTask: handleUpdateTask, onDataRefresh: fetchData };
    const sp = { allUsers, allSpaces: userSpaces, allHubs, onSave: handleSpaceSave, onDelete: db.deleteSpace, appUser, onInvite: fetchData, handleInvite: async (i: any) => { await db.addInvite(i); fetchData(); }, projects, tasks, timeEntries, activeHub, onUpdateActiveHub: handleUpdateActiveHub, bots, onBotUpdate: handleBotUpdate, onBotAdd: handleBotAdd, onBotDelete: handleBotDelete, escalationRules, tickets, conversations: chatConversations, activeSpace, helpCenters };
    const cv = view as AppView;
    switch (cv) {
      case 'overview': return <div className="overflow-y-auto p-8"><Overview {...op} /></div>;
      case 'tasks': return (
        <div className="flex h-full min-h-0 flex-1 min-w-0">
          {(projects.length > 0) && (<ProjectSidebar projects={projects} tasks={tasks} selectedProjectId={selectedProjectId} onSelectProject={handleSelectProject} onNewProject={handleNewProject} />)}
          <TaskBoard selectedProjectId={selectedProjectId} projects={projects} onSelectProject={handleSelectProject} allTasks={tasks} onUpdateTasks={handleUpdateTasks} activeHub={activeHub!} allUsers={allUsers} onUpdateActiveHub={handleUpdateActiveHub} onNewTaskRequest={handleNewTaskRequest} onTaskClick={setSelectedTask} onUpdateTask={handleUpdateTask} onAddTask={handleAddTask} onNewProject={handleNewProject} onEditProject={handleEditProject} onDeleteProject={handleDeleteProject} />
        </div>
      );
      case 'tickets': return <TicketsBoard tickets={tickets} onUpdateTickets={handleUpdateTickets} conversations={chatConversations} activeHub={activeHub!} activeSpace={activeSpace!} allHubs={allHubs} allUsers={allUsers} onUpdateActiveHub={handleUpdateActiveHub} onNavigateToSettings={() => router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/settings`)} escalationRules={escalationRules} projects={projects} contacts={contacts} onDataRefresh={fetchData} onCreateTicket={handleCreateTicket} onEscalateTicket={handleEscalateTicket} allTasks={tasks} onTaskSelect={setSelectedTask} />;
      case 'deals': return <DealsBoard deals={deals} onUpdateDeals={handleUpdateDeals} onAddDeal={handleAddDeal} onDataRefresh={fetchData} contacts={contacts} activeHub={activeHub!} activeSpace={activeSpace!} allUsers={allUsers} onUpdateActiveHub={handleUpdateActiveHub} onNavigateToSettings={() => router.push(`/space/${activeSpace?.id}/hub/${activeHub?.id}/settings`)} />;
      case 'help-center': return <HelpCenterLayout bots={bots} />;
      case 'contacts': return <ContactsLayout activeSpace={activeSpace} contacts={contacts} />;
      case 'settings': return <SettingsLayout {...sp} />;
      case 'team-timesheets': return <TeamTimesheets allSpaces={userSpaces} allUsers={allUsers} projects={projects} tasks={tasks} timeEntries={timeEntries} appUser={appUser!} activeHub={activeHub} />;
      case 'inbox': return <InboxLayout users={allUsers} appUser={appUser!} visitors={visitors} conversations={activeHub ? chatConversations.filter(c => c.hubId === activeHub.id) : []} messages={chatMessages} onSendMessage={handleSendMessageFromAgent} onAssignConversation={handleAssignConversation} setHideMobileBottomNav={setHideMobileBottomNav} activeHub={activeHub!} activeSpace={activeSpace!} allHubs={allHubs} escalationRules={escalationRules} projects={projects} contacts={contacts} onDataRefresh={fetchData} tickets={tickets} onCreateTicket={handleCreateTicket} onUpdateTicket={handleUpdateTicket} />;
      default: return <div className="p-8"><h1 className="text-2xl font-bold">Coming Soon: {view}</h1></div>;
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {isLoading ? <ContentSkeleton /> : renderView()}
      <ProjectFormDialog isOpen={isProjectFormOpen} onOpenChange={setIsProjectFormOpen} onSave={handleSaveProject} project={editingProject} spaceId={activeSpace?.id || ''} spaceMembers={allUsers.filter(u => activeSpace?.members[u.id])} />
      {selectedTask && (
        <TaskDetailsDialog 
            task={selectedTask} 
            timeEntries={timeEntries.filter(t => t.task_id === selectedTask?.id)} 
            isOpen={!!selectedTask} 
            onOpenChange={(o) => { if (!o) setSelectedTask(null); }} 
            onUpdateTask={handleUpdateTask} 
            onAddTask={handleAddTask} 
            onRemoveTask={handleDeleteTask} 
            onTaskSelect={setSelectedTask} 
            onLogTime={handleLogTime} 
            statuses={activeHub?.statuses?.map(s => s.name) || []} 
            allUsers={allUsers} 
            allTasks={tasks} 
            projects={projects} 
        />
      )}
    </div>
  );
}
