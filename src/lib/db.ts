'use client'
// src/lib/db.ts

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  deleteDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  limit,
  Timestamp,
  serverTimestamp,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Space,
  User,
  Project,
  Task,
  TimeEntry,
  SlackMeetingLog,
  Channel,
  Message,
  users,
  spaces,
  projects,
  tasks,
  timeEntries,
  slackMeetingLogs,
  channels,
  messages,
  Invite,
  SpaceMember,
  Permissions,
  jobFlowTemplates,
  JobFlowTemplate,
  Job,
  JobFlowTask,
  jobs,
  jobFlowTasks,
  JobFlowTaskTemplate,
  phaseTemplates,
  taskTemplates,
  PhaseTemplate,
  TaskTemplate,
  JobFlowPhase,
  Document,
  Hub,
  hubs,
  Status,
  Conversation,
  ChatMessage,
  Visitor,
  Bot,
  HelpCenter,
  HelpCenterCollection,
  HelpCenterArticle,
  visitors,
  Contact,
  ContactEvent,
  Ticket,
  Deal,
  DealAutomationRule,
  EscalationIntakeRule,
} from "./data";
import { FirestorePermissionError } from "./errors";
import { errorEmitter } from "./error-emitter";
import seedData from './riverr-help-data.json';


const whimsicalAdjectives = [
  "Clever", "Silly", "Witty", "Happy", "Brave", "Curious", "Dapper", "Eager", "Fancy",
  "Gentle", "Jolly", "Kindly", "Lucky", "Merry", "Nifty", "Plucky", "Quirky", "Sunny",
  "Thrifty", "Zippy", "Agile", "Blissful", "Calm", "Dandy", "Elated", "Fearless"
];

const whimsicalNouns = [
  "Alpaca", "Badger", "Capybara", "Dingo", "Echidna", "Fossa", "Gecko", "Hedgehog",
  "Impala", "Jerboa", "Koala", "Loris", "Mongoose", "Narwhal", "Okapi", "Pangolin",
  "Quokka", "Serval", "Tarsier", "Urial", "Wallaby", "Xerus", "Zebra", "Aardvark"
];

const generateWhimsicalName = () => {
  const adj = whimsicalAdjectives[Math.floor(Math.random() * whimsicalAdjectives.length)];
  const noun = whimsicalNouns[Math.floor(Math.random() * whimsicalNouns.length)];
  return `${adj} ${noun}`;
};


// --- Seeding ---
export const seedDatabase = async () => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("Database is empty, seeding data...");
    const batch = writeBatch(db);

    // Let's create mock users with specific IDs for reproducible seeding
    const userIds = ["user-1", "user-2", "user-3", "user-4"];
    users.forEach((user, i) => batch.set(doc(db, "users", userIds[i]), user));

    spaces.forEach((space) => batch.set(doc(db, "spaces", space.id), space));

    // Seed hubs with specific IDs
    hubs.forEach((hub) => {
      const { id, ...hubData } = hub;
      batch.set(doc(db, "hubs", id), hubData);
    });

    // Seed visitors, conversations, messages
    visitors.forEach((visitor) => {
      const { id, ...visitorData } = visitor;
      batch.set(doc(db, "visitors", id), visitorData);
    });

    conversations.forEach((convo) => {
      const { id, ...convoData } = convo;
      batch.set(doc(db, "conversations", id), convoData);
    });

    chatMessages.forEach((msg) => {
      const { id, ...msgData } = msg;
      batch.set(doc(db, "chat_messages", id), msgData);
    });

    await batch.commit();
    console.log("Database seeded successfully!");
  }
};

// --- User Management ---
export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists()
    ? ({ id: userDoc.id, ...userDoc.data() } as User)
    : null;
};

export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as User)
  );
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const q = query(collection(db, "users"), where("email", "==", email));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const userDoc = querySnapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() } as User;
};

export const addUser = async (
  user: Omit<User, "id">,
  uid: string
): Promise<User> => {
  await setDoc(doc(db, "users", uid), user);
  return { ...user, id: uid };
};

export const updateUser = async (
  userId: string,
  data: Partial<User>
): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, data);
};

// --- Invite Management ---
export const addInvite = async (invite: Omit<Invite, "id">): Promise<void> => {
  await addDoc(collection(db, "invites"), invite);
};

export const getInvitesForEmail = async (email: string): Promise<Invite[]> => {
  const q = query(
    collection(db, "invites"),
    where("email", "==", email),
    where("status", "==", "pending")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Invite)
  );
};

export const acceptInvite = async (invite: Invite, userId: string) => {
  const batch = writeBatch(db);

  const defaultMemberPermissions: Permissions = {
    canViewTasks: true,
    canEditTasks: false,
    canLogTime: true,
    canSeeAllTimesheets: false,
    canViewReports: false,
    canInviteMembers: false,
  };

  // Add user to each space
  for (const spaceId of invite.spaces) {
    const spaceRef = doc(db, "spaces", spaceId);

    const member: SpaceMember = { role: invite.role };

    if (invite.role === "Member") {
      member.permissions = invite.permissions || defaultMemberPermissions;
    }

    batch.update(spaceRef, {
      [`members.${userId}`]: member,
    });
  }

  // Mark invite as accepted
  const inviteRef = doc(db, "invites", invite.id);
  batch.update(inviteRef, { status: "accepted" });

  await batch.commit();
};

export const declineInvite = async (inviteId: string) => {
  const inviteRef = doc(db, "invites", inviteId);
  await updateDoc(inviteRef, { status: "declined" });
};

// --- Space Management ---
export const getSpacesForUser = async (userId: string): Promise<Space[]> => {
  if (!userId) return [];
  const q = query(
    collection(db, "spaces"),
    where(`members.${userId}.role`, 'in', ['Admin', 'Member'])
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Space)
  );
};

export const getAllSpaces = async (): Promise<Space[]> => {
  const querySnapshot = await getDocs(collection(db, "spaces"));
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Space)
  );
};

export const addSpace = async (space: Omit<Space, 'id'>) => {
  const docRef = await addDoc(collection(db, "spaces"), space);
  return docRef.id;
};

export const updateSpace = async (
  spaceId: string,
  data: Partial<Space>
): Promise<void> => {
  const spaceRef = doc(db, "spaces", spaceId);
  // Create a clean copy of the data object, removing any keys with 'undefined' values.
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
  await updateDoc(spaceRef, cleanData);
};

export const deleteSpace = async (spaceId: string): Promise<void> => {
  await deleteDoc(doc(db, "spaces", spaceId));
};

// --- Hub Management ---
export const getHub = async (hubId: string): Promise<Hub | null> => {
    const docRef = doc(db, "hubs", hubId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Hub;
    }
    return null;
}
export const getHubsForSpace = async (spaceId: string): Promise<Hub[]> => {
  const q = query(collection(db, 'hubs'), where('spaceId', '==', spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
};

export const addHub = (hub: Omit<Hub, 'id'>) => {
  const collectionRef = collection(db, 'hubs');

  addDoc(collectionRef, hub)
    .catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: collectionRef.path,
        operation: 'create',
        requestResourceData: hub,
      });

      errorEmitter.emit('permission-error', permissionError);
    });
};


export const updateHub = async (
  hubId: string,
  data: Partial<Hub>
): Promise<void> => {
  const hubRef = doc(db, "hubs", hubId);
  await updateDoc(hubRef, data);
};

const defaultStatuses: Status[] = [
  { name: 'Backlog', color: '#6b7280' },
  { name: 'In Progress', color: '#3b82f6' },
  { name: 'In Review', color: '#f59e0b' },
  { name: 'Done', color: '#22c55e' },
];

const defaultTicketStatuses: Status[] = [
  { name: 'New', color: '#6b7280' },
  { name: 'Open', color: '#3b82f6' },
  { name: 'Waiting on Customer', color: '#f59e0b' },
  { name: 'Escalated', color: '#ef4444' },
  { name: 'Closed', color: '#22c55e' },
];

export const createDefaultHubForSpace = async (spaceId: string, userId: string, hubData: Partial<Omit<Hub, 'id' | 'spaceId'>>) => {
  const finalHubData: Omit<Hub, 'id'> = {
    name: hubData.name || 'Default Hub',
    spaceId,
    type: hubData.type || 'project-management',
    createdAt: new Date().toISOString(),
    createdBy: userId,
    isDefault: hubData.isDefault || true,
    settings: hubData.settings || { components: ['overview', 'tasks', 'documents', 'messages'], defaultView: 'overview' },
    isPrivate: hubData.isPrivate || false,
    memberIds: hubData.memberIds || [],
    statuses: hubData.statuses || defaultStatuses,
    ticketStatuses: hubData.ticketStatuses || defaultTicketStatuses,
    ticketClosingStatusName: 'Closed',
    closingStatusName: hubData.closingStatusName,
  };
  const hubRef = await addDoc(collection(db, 'hubs'), finalHubData);
  return { id: hubRef.id, ...finalHubData };
};


function getHubComponentsForTemplate(template: string) {
  switch (template) {
    case 'project-management':
      return [
        'overview', 'tasks', 'documents', 'messages', 'flows', 'user-settings', 'space-settings'
      ];
    default:
      return ['overview', 'tasks'];
  }
}

// --- Project Management ---
export const getProjectsInHub = async (
  hubId: string
): Promise<Project[]> => {
  const q = query(collection(db, "projects"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Project)
  );
};

export const getProjectsInSpace = async (
  spaceId: string
): Promise<Project[]> => {
  const q = query(collection(db, "projects"), where("space_id", "==", spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Project)
  );
};


export const addProject = async (
  project: Omit<Project, "id">
): Promise<Project> => {
  const docRef = await addDoc(collection(db, "projects"), project);
  return { ...project, id: docRef.id };
};

export const updateProject = async (
  projectId: string,
  data: Partial<Project>
): Promise<void> => {
  const projectRef = doc(db, "projects", projectId);
  await updateDoc(projectRef, data);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  // Also delete tasks associated with the project
  const batch = writeBatch(db);
  const tasksQuery = query(
    collection(db, "tasks"),
    where("project_id", "==", projectId)
  );
  const tasksSnapshot = await getDocs(tasksQuery);
  tasksSnapshot.forEach((taskDoc) => {
    batch.delete(taskDoc.ref);
  });

  const projectRef = doc(db, "projects", projectId);
  batch.delete(projectRef);

  await batch.commit();
};

// --- Task Management ---
export const getTasksInHub = async (hubId: string): Promise<Task[]> => {
  const q = query(
    collection(db, "tasks"),
    where("hubId", "==", hubId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Task)
  );
};

export const getTasksForUser = async (userId: string): Promise<Task[]> => {
  const q = query(collection(db, "tasks"), where("assigned_to", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Task)
  );
};

export const getAllTasks = async (hubId: string): Promise<Task[]> => {
  const q = query(collection(db, "tasks"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Task)
  );
};

export const addTask = async (task: Omit<Task, "id">): Promise<Task> => {
  const docRef = await addDoc(collection(db, "tasks"), task);
  return { ...task, id: docRef.id };
};

export const updateTask = async (
  taskId: string,
  data: Partial<Task>
): Promise<void> => {
  const taskRef = doc(db, "tasks", taskId);
  // Firestore does not allow 'undefined' fields. Remove id before updating.
  const { id: _omit, ...dataWithoutId } = data;
  await updateDoc(taskRef, dataWithoutId);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const taskRef = doc(db, "tasks", taskId);
  await deleteDoc(taskRef);
};

// --- Ticket Management ---
export const getTicketsInHub = async (hubId: string): Promise<Ticket[]> => {
  const q = query(collection(db, "tickets"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Ticket)
  );
};

export const addTicket = async (ticket: Omit<Ticket, "id">): Promise<Ticket> => {
  const docRef = await addDoc(collection(db, "tickets"), ticket);
  return { ...ticket, id: docRef.id };
};

export const updateTicket = async (
  ticketId: string,
  data: Partial<Ticket>
): Promise<void> => {
  const ticketRef = doc(db, "tickets", ticketId);
  await updateDoc(ticketRef, data);
};

// --- Deal Management ---
export const getDealsInHub = async (hubId: string): Promise<Deal[]> => {
  const q = query(collection(db, "deals"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
};

export const addDeal = async (deal: Omit<Deal, "id">): Promise<Deal> => {
  const docRef = await addDoc(collection(db, "deals"), deal);
  return { ...deal, id: docRef.id };
};

export const updateDeal = async (dealId: string, data: Partial<Deal>): Promise<void> => {
  const dealRef = doc(db, "deals", dealId);
  await updateDoc(dealRef, data);
};

// --- Escalation & Automation Management ---
export const getEscalationIntakeRules = async (hubId: string): Promise<EscalationIntakeRule[]> => {
  const rulesRef = collection(db, 'hubs', hubId, 'escalation_intake');
  const snapshot = await getDocs(rulesRef);
  return snapshot.docs.map(doc => ({ id: doc.id, hubId, ...doc.data() } as EscalationIntakeRule));
};

export const saveEscalationIntakeRule = async (hubId: string, rule: Omit<EscalationIntakeRule, 'id' | 'hubId'>, ruleId?: string): Promise<EscalationIntakeRule> => {
  if (ruleId) {
    const ruleRef = doc(db, 'hubs', hubId, 'escalation_intake', ruleId);
    await updateDoc(ruleRef, rule);
    return { ...rule, id: ruleId, hubId };
  } else {
    const collRef = collection(db, 'hubs', hubId, 'escalation_intake');
    const docRef = await addDoc(collRef, rule);
    return { ...rule, id: docRef.id, hubId };
  }
};

export const deleteEscalationIntakeRule = async (hubId: string, ruleId: string): Promise<void> => {
  const ruleRef = doc(db, 'hubs', hubId, 'escalation_intake', ruleId);
  await deleteDoc(ruleRef);
};


export const getDealAutomationRules = async (hubId: string): Promise<DealAutomationRule[]> => {
  const q = query(collection(db, "deal_automation_rules"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DealAutomationRule));
};

export const saveDealAutomationRule = async (rule: Omit<DealAutomationRule, 'id'>, ruleId?: string): Promise<DealAutomationRule> => {
  if (ruleId) {
    const ruleRef = doc(db, "deal_automation_rules", ruleId);
    await updateDoc(ruleRef, rule);
    return { ...rule, id: ruleId };
  } else {
    const docRef = await addDoc(collection(db, "deal_automation_rules"), rule);
    return { ...rule, id: docRef.id };
  }
};

export const deleteDealAutomationRule = async (ruleId: string): Promise<void> => {
  const ruleRef = doc(db, "deal_automation_rules", ruleId);
  await deleteDoc(ruleRef);
};


// --- Time & Log Management ---
export const getTimeEntriesInHub = async (
  projectIds: string[]
): Promise<TimeEntry[]> => {
  if (!projectIds || projectIds.length === 0) return [];

  // Firestore 'in' queries are limited to 30 items.
  // If there are more projects, we need to split into multiple queries.
  const results: TimeEntry[] = [];
  for (let i = 0; i < projectIds.length; i += 30) {
    const chunk = projectIds.slice(i, i + 30);
    const q = query(
      collection(db, "time_entries"),
      where("project_id", "in", chunk)
    );
    const querySnapshot = await getDocs(q);
    const chunkResults = querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as TimeEntry)
    );
    results.push(...chunkResults);
  }
  return results;
};

export const addTimeEntry = async (
  timeData: Omit<TimeEntry, "id">
): Promise<TimeEntry> => {
  const docRef = await addDoc(collection(db, "time_entries"), timeData);
  return { ...timeData, id: docRef.id };
};

export const getSlackMeetingLogsInSpace = async (
  spaceId: string
): Promise<SlackMeetingLog[]> => {
  // This function is problematic with hubs. For now, we'll keep it as-is
  // but it should probably be refactored to be hub-aware.
  const q = query(collection(db, "slack_meeting_logs"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as SlackMeetingLog)
  );
};

// --- Channel & Message Management ---
export const getChannelsInHub = async (
  hubId: string
): Promise<Channel[]> => {
  const q = query(collection(db, "channels"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Channel)
  );
};

export const addChannel = async (
  channel: Omit<Channel, "id">
): Promise<Channel> => {
  const collRef = collection(db, "channels");
  try {
    const docRef = await addDoc(collRef, channel);
    return { ...channel, id: docRef.id };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: channel,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const updateChannel = async (
  channelId: string,
  data: Partial<Channel>
): Promise<void> => {
  const channelRef = doc(db, "channels", channelId);
  try {
    await updateDoc(channelRef, data);
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: channelRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const deleteChannel = async (channelId: string): Promise<void> => {
  const batch = writeBatch(db);

  // Delete all messages in the channel
  const messagesQuery = query(
    collection(db, "messages"),
    where("channel_id", "==", channelId)
  );
  const messagesSnapshot = await getDocs(messagesQuery);
  messagesSnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Delete the channel itself
  const channelRef = doc(db, "channels", channelId);
  batch.delete(channelRef);

  await batch.commit();
};

export const getMessagesInChannel = async (
  channelId: string
): Promise<Message[]> => {
  const q = query(
    collection(db, "messages"),
    where("channel_id", "==", channelId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Message)
  );
};

export const addMessage = async (
  message: Omit<Message, "id">
): Promise<Message> => {
  const docRef = await addDoc(collection(db, "messages"), message);
  const savedMessage = { ...message, id: docRef.id };

  if (message.thread_id) {
    const parentMessageRef = doc(db, "messages", message.thread_id);
    const parentMessageSnap = await getDoc(parentMessageRef);
    if (parentMessageSnap.exists()) {
      const parentMessage = parentMessageSnap.data();
      const currentReplies = parentMessage.reply_count || 0;
      await updateDoc(parentMessageRef, { reply_count: currentReplies + 1 });
    }
  }

  return savedMessage;
};

// --- Job Flow Management ---
export const getJobFlowTemplates = async (
  hubId: string
): Promise<JobFlowTemplate[]> => {
  const q = query(
    collection(db, "job_flow_templates"),
    where("hubId", "==", hubId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as JobFlowTemplate)
  );
};

export const addJobFlowTemplate = async (
  template: Omit<JobFlowTemplate, "id">
): Promise<JobFlowTemplate> => {
  const docRef = await addDoc(collection(db, "job_flow_templates"), template);
  return { ...template, id: docRef.id };
};

export const getPhaseTemplates = async (
  hubId: string
): Promise<PhaseTemplate[]> => {
  const q = query(
    collection(db, "phase_templates"),
    where("hubId", "==", hubId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as PhaseTemplate)
  );
};

export const getTaskTemplates = async (
  hubId: string
): Promise<TaskTemplate[]> => {
  const q = query(
    collection(db, "task_templates"),
    where("hubId", "==", hubId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as TaskTemplate)
  );
};

export const addPhaseTemplate = async (
  template: Omit<PhaseTemplate, "id">
): Promise<PhaseTemplate> => {
  const docRef = await addDoc(collection(db, "phase_templates"), template);
  return { ...template, id: docRef.id };
};

export const addTaskTemplate = async (
  template: Omit<TaskTemplate, "id">
): Promise<TaskTemplate> => {
  const docRef = await addDoc(collection(db, "task_templates"), template);
  return { ...template, id: docRef.id };
};

export const getAllJobs = async (hubId: string): Promise<Job[]> => {
  const q = query(collection(db, "jobs"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Job)
  );
};

export const getAllJobFlowTasks = async (
  hubId: string
): Promise<JobFlowTask[]> => {
  // This is inefficient. In a real app, you might query by job IDs that are in the space.
  // For now, let's get all jobs in the space and then get their tasks.
  const jobsInHub = await getAllJobs(hubId);
  if (jobsInHub.length === 0) return [];

  const jobIds = jobsInHub.map((j) => j.id);
  const q = query(
    collection(db, "job_flow_tasks"),
    where("jobId", "in", jobIds)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as JobFlowTask)
  );
};

const createSubtasks = (
  batch: any,
  subtaskTemplates: any[],
  parentTaskId: string,
  roleUserMapping: Record<string, string>,
  jobName: string,
  parentDueDate: Date,
  hubId: string,
  spaceId: string,
  createdBy: string
) => {
  for (const subtaskTemplate of subtaskTemplates) {
    const subtaskAssigneeId =
      roleUserMapping[subtaskTemplate.defaultAssigneeId];
    if (!subtaskAssigneeId) {
      console.warn(
        `No user mapped for subtask assignee ID ${subtaskTemplate.defaultAssigneeId}. Skipping subtask.`
      );
      continue;
    }

    const now = new Date().toISOString();
    const subtaskRef = doc(collection(db, "tasks"));
    const subtaskCreationActivity: Activity = {
      id: `act-creation-job-${subtaskRef.id}`,
      user_id: createdBy,
      timestamp: now,
      type: 'task_creation',
    };

    const subtaskTitle = subtaskTemplate.titleTemplate.replace(
      /\{\{job_name\}\}/g,
      jobName
    );
    const subtaskData: Omit<Task, "id"> = {
      project_id: null,
      hubId: hubId,
      name: subtaskTitle,
      description: "",
      status: "Pending",
      createdBy: createdBy,
      createdAt: now,
      assigned_to: subtaskAssigneeId,
      due_date: parentDueDate.toISOString(), // Subtasks get same due date as parent
      priority: null,
      sprint_points: null,
      tags: ["JobFlow", jobName],
      time_estimate: null,
      relationships: [],
      activities: [subtaskCreationActivity],
      comments: [],
      attachments: [],
      parentId: parentTaskId,
      spaceId: spaceId,
    };
    batch.set(subtaskRef, subtaskData);
  }
};

const createTasksForPhase = async (
  batch: any,
  phase: JobFlowPhase,
  jobId: string,
  jobName: string,
  roleUserMapping: Record<string, string>,
  hubId: string,
  spaceId: string,
  createdBy: string
) => {
  let lastDueDate = new Date();
  for (const taskTemplate of phase.tasks) {
    const assigneeId = roleUserMapping[taskTemplate.defaultAssigneeId];
    if (!assigneeId) {
      throw new Error(
        `No user mapped for assignee ID ${taskTemplate.defaultAssigneeId} in phase "${phase.name}".`
      );
    }

    const taskTitle = taskTemplate.titleTemplate.replace(
      /\{\{job_name\}\}/g,
      jobName
    );
    const taskDescription = (taskTemplate.descriptionTemplate || "").replace(
      /\{\{job_name\}\}/g,
      jobName
    );

    const dueDate = new Date(lastDueDate);
    dueDate.setDate(dueDate.getDate() + taskTemplate.estimatedDurationDays);

    const now = new Date().toISOString();
    const taskRef = doc(collection(db, "tasks"));
    const taskCreationActivity: Activity = {
      id: `act-creation-job-${taskRef.id}`,
      user_id: createdBy,
      timestamp: now,
      type: 'task_creation',
    };
    const taskData: Omit<Task, "id"> = {
      project_id: null,
      hubId: hubId,
      name: taskTitle,
      description: taskDescription,
      status: "Pending",
      createdBy: createdBy,
      createdAt: now,
      assigned_to: assigneeId,
      due_date: dueDate.toISOString(),
      priority: "Medium",
      sprint_points: null,
      tags: ["JobFlow", jobName],
      time_estimate: taskTemplate.estimatedDurationDays * 8, // Assume 8 hours per day
      relationships: [],
      activities: [taskCreationActivity],
      comments: [],
      attachments: [],
      parentId: null,
      spaceId: spaceId,
    };
    batch.set(taskRef, taskData);
    lastDueDate = dueDate; // Set the last due date for the next task in sequence

    if (
      taskTemplate.subtaskTemplates &&
      taskTemplate.subtaskTemplates.length > 0
    ) {
      createSubtasks(
        batch,
        taskTemplate.subtaskTemplates,
        taskRef.id,
        roleUserMapping,
        jobName,
        dueDate,
        hubId,
        spaceId,
        createdBy
      );
    }

    const jobFlowTaskData: Omit<JobFlowTask, "id"> = {
      jobId: jobId,
      phaseIndex: phase.phaseIndex,
      taskId: taskRef.id,
      createdAt: new Date().toISOString(),
    };
    const jobFlowTaskRef = doc(collection(db, "job_flow_tasks"));
    batch.set(jobFlowTaskRef, jobFlowTaskData);
  }
};

export const launchJob = async (
  jobName: string,
  template: JobFlowTemplate,
  roleUserMapping: Record<string, string>,
  createdBy: string,
  spaceId: string,
): Promise<Job> => {
  const batch = writeBatch(db);

  const newJobData: Omit<Job, "id"> = {
    name: jobName,
    workflowTemplateId: template.id,
    currentPhaseIndex: 0,
    status: "active",
    createdBy: createdBy,
    createdAt: new Date().toISOString(),
    roleUserMapping: roleUserMapping,
    space_id: spaceId,
    hubId: template.hubId,
  };
  const jobRef = doc(collection(db, "jobs"));
  batch.set(jobRef, newJobData);

  const firstPhase = template.phases.find((p) => p.phaseIndex === 0);
  if (!firstPhase) {
    throw new Error("Template has no starting phase.");
  }

  await createTasksForPhase(
    batch,
    firstPhase,
    jobRef.id,
    jobName,
    roleUserMapping,
    template.hubId,
    spaceId,
    createdBy
  );

  await batch.commit();

  return { ...newJobData, id: jobRef.id };
};

export const updateJobPhase = async (
  job: Job,
  template: JobFlowTemplate,
  tasks: Task[],
  jobFlowTasks: JobFlowTask[]
) => {
  const currentPhaseIndex = job.currentPhaseIndex;
  const currentPhase = template.phases.find(
    (p) => p.phaseIndex === currentPhaseIndex
  );
  if (!currentPhase) throw new Error("Current phase not found in template.");

  const batch = writeBatch(db);

  // Clear the review flag from the just-completed phase's tasks
  const completedPhaseTasksQuery = query(
    collection(db, "job_flow_tasks"),
    where("jobId", "==", job.id),
    where("phaseIndex", "==", currentPhaseIndex)
  );
  const completedPhaseTasksSnapshot = await getDocs(completedPhaseTasksQuery);
  completedPhaseTasksSnapshot.forEach((doc) => {
    batch.update(doc.ref, { reviewedBy: null });
  });

  // Logic to advance phase
  const nextPhaseIndex = currentPhaseIndex + 1;
  const nextPhase = template.phases.find(
    (p) => p.phaseIndex === nextPhaseIndex
  );

  if (nextPhase) {
    await createTasksForPhase(
      batch,
      nextPhase,
      job.id,
      job.name,
      job.roleUserMapping,
      job.hubId,
      job.space_id,
      job.createdBy
    );

    const jobRef = doc(db, "jobs", job.id);
    batch.update(jobRef, { currentPhaseIndex: nextPhaseIndex });
  } else {
    // No more phases, complete the job
    const jobRef = doc(db, "jobs", job.id);
    batch.update(jobRef, { status: "completed" });
  }

  await batch.commit();
};

export const reviewJobPhase = async (
  jobId: string,
  phaseIndex: number,
  userId: string
) => {
  const q = query(
    collection(db, "job_flow_tasks"),
    where("jobId", "==", jobId),
    where("phaseIndex", "==", phaseIndex)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty)
    throw new Error("Could not find job flow task to review.");

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { reviewedBy: userId });
  });

  await batch.commit();
};

// --- Document Management ---
export const getDocumentsInHub = async (
  hubId: string
): Promise<Document[]> => {
  const q = query(collection(db, "documents"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Document)
  );
};

export const getDocument = async (docId: string): Promise<Document | null> => {
  const docRef = doc(db, "documents", docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Document;
  }
  return null;
};

export const addDocument = async (
  docData: Omit<Document, "id">
): Promise<Document> => {
  const docRef = await addDoc(collection(db, "documents"), docData);
  return { ...docData, id: docRef.id };
};

export const updateDocument = async (
  docId: string,
  data: Partial<Document>
): Promise<void> => {
  const docRef = doc(db, "documents", docId);
  try {
    await updateDoc(docRef, data);
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const deleteDocument = async (docId: string): Promise<void> => {
  await deleteDoc(doc(db, "documents", docId));
};

export async function uploadImageToFirebase(file: File, hubId: string, docId: string): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `hubs/${hubId}/docs/${docId}/images/${crypto.randomUUID()}-${safeName}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });

  return await getDownloadURL(storageRef);
}


// --- Contact, Visitor, and Conversation Management ---
export const findOrCreateContact = async (spaceId: string, details: { email?: string, name?: string }): Promise<Contact> => {
    if (details.email) {
      const q = query(collection(db, "contacts"), where("primaryEmail", "==", details.email.toLowerCase()), where("spaceId", "==", spaceId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Contact;
      }
    }
  
    // Create new if not found
    const now = new Date();
    const newContactData: Omit<Contact, 'id'> = {
      spaceId: spaceId,
      name: details.name || null,
      emails: details.email ? [details.email.toLowerCase()] : [],
      primaryEmail: details.email?.toLowerCase() || null,
      phones: [],
      primaryPhone: null,
      company: null,
      source: 'chat',
      externalIds: {},
      tags: [],
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      lastMessageAt: null,
      lastOrderAt: null,
      lastCallAt: null,
      isMerged: false,
      mergeParentId: null,
    };
    return addContact(newContactData);
};


export const getContacts = async (spaceId: string): Promise<Contact[]> => {
  const q = query(collection(db, 'contacts'), where('spaceId', '==', spaceId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
};

export const addContact = async (contactData: Omit<Contact, 'id'>): Promise<Contact> => {
  const collRef = collection(db, 'contacts');
  try {
    const docRef = await addDoc(collRef, contactData);
    return { id: docRef.id, ...contactData };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: contactData,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const getContactEvents = async (contactId: string): Promise<ContactEvent[]> => {
  const collRef = collection(db, 'contacts', contactId, 'events');
  const q = query(collRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactEvent));
}

export const addContactEvent = async (contactId: string, eventData: Omit<ContactEvent, 'id'>): Promise<ContactEvent> => {
  const collRef = collection(db, 'contacts', contactId, 'events');
  const docRef = await addDoc(collRef, eventData);
  return { id: docRef.id, ...eventData };
}

export const deleteContactEvent = async (contactId: string, eventId: string): Promise<void> => {
  const eventRef = doc(db, 'contacts', contactId, 'events', eventId);
  await deleteDoc(eventRef);
};


// --- Inbox / Chat Management ---
export const getConversationsForHub = async (hubId: string): Promise<Conversation[]> => {
  const q = query(collection(db, 'conversations'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
};

export const getMessagesForConversations = (
  conversationIds: string[], 
  onUpdate: (messages: ChatMessage[]) => void,
  publicOnly: boolean = false,
) => {
  if (conversationIds.length === 0) {
    onUpdate([]);
    return () => {}; // Return empty cleanup
  }

  const unsubscribers: (() => void)[] = [];
  const chunkMap = new Map();

  for (let i = 0; i < conversationIds.length; i += 30) {
    const chunk = conversationIds.slice(i, i + 30);
    const chunkIndex = i;
    
    const baseQuery = collection(db, 'chat_messages');
    let q;
    if (publicOnly) {
      q = query(baseQuery, where('conversationId', 'in', chunk), where('type', '==', 'message'), orderBy('timestamp', 'asc'));
    } else {
      q = query(baseQuery, where('conversationId', 'in', chunk), orderBy('timestamp', 'asc'));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() } as ChatMessage));
      
      chunkMap.set(chunkIndex, messages);
      
      const allMessages = Array.from(chunkMap.values())
        .flat()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      onUpdate(allMessages);
    });
    unsubscribers.push(unsub);
  }

  return () => unsubscribers.forEach(fn => fn());
};

export const addChatMessage = async (message: Omit<ChatMessage, "id">): Promise<ChatMessage> => {
    const collRef = collection(db, "chat_messages");
    const docRef = await addDoc(collRef, message);
    const saved = { ...message, id: docRef.id };
  
    // Only update summaries for actual messages, not system events or notes
    if (message.conversationId && message.type === 'message') {
      let authorName = "System";
      if (message.senderType === 'agent') {
        const userDoc = await getDoc(doc(db, 'users', message.authorId));
        if (userDoc.exists()) authorName = userDoc.data().name;
      } else { // 'contact'
        const visitorDoc = await getDoc(doc(db, 'visitors', message.authorId));
        if (visitorDoc.exists()) authorName = visitorDoc.data().name;
      }
  
      const conversationUpdateData = {
        lastMessageAt: message.timestamp,
        lastMessage: (message.content || "").slice(0, 140),
        lastMessageAuthor: authorName,
        updatedAt: serverTimestamp(),
      };
      await updateConversation(message.conversationId, conversationUpdateData as any);
  
      const ticketsQuery = query(collection(db, "tickets"), where("conversationId", "==", message.conversationId), limit(1));
      const ticketSnap = await getDocs(ticketsQuery);
      if (!ticketSnap.empty) {
        const ticketDoc = ticketSnap.docs[0];
        await updateTicket(ticketDoc.id, {
          lastMessagePreview: (message.content || "").slice(0, 140),
          lastMessageAt: message.timestamp,
          lastMessageAuthor: authorName,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    
    return saved;
  };

export const updateConversation = async (conversationId: string, data: Partial<Conversation>): Promise<void> => {
  const convRef = doc(db, 'conversations', conversationId);
  try {
    await updateDoc(convRef, data);
    if (data.contactId) {
      const ticketsQuery = query(collection(db, "tickets"), where("conversationId", "==", conversationId), limit(1));
      const ticketSnap = await getDocs(ticketsQuery);
      if (!ticketSnap.empty) {
        const ticketDoc = ticketSnap.docs[0];
        await updateDoc(ticketDoc.ref, { contactId: data.contactId });
      }
    }
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: convRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export const addConversation = async (conversation: Omit<Conversation, 'id'>): Promise<Conversation> => {
  const collRef = collection(db, 'conversations');
  try {
    const docRef = await addDoc(collRef, conversation);
    return { ...conversation, id: docRef.id };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: conversation,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}


// --- Bot Management ---
export const getBots = async (hubId: string): Promise<Bot[]> => {
  const q = query(collection(db, "bots"), where("hubId", "==", hubId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bot));
};

export const getBot = async (botId: string): Promise<Bot | null> => {
  const botDocRef = doc(db, "bots", botId);
  try {
    const botDoc = await getDoc(botDocRef);
    return botDoc.exists() ? ({ id: botDoc.id, ...botDoc.data() } as Bot) : null;
  } catch (serverError: any) {
    if (serverError.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({
        path: botDocRef.path,
        operation: 'get'
      });
      errorEmitter.emit('permission-error', permissionError);
    }
    throw serverError;
  }
};

export const addBot = async (bot: Omit<Bot, "id">): Promise<Bot> => {
  const collRef = collection(db, "bots");
  try {
    const docRef = await addDoc(collRef, bot);
    return { ...bot, id: docRef.id };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: bot,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const updateBot = async (botId: string, data: Partial<Bot>): Promise<void> => {
  const botRef = doc(db, "bots", botId);
  await updateDoc(botRef, data);
};

export const deleteBot = async (botId: string): Promise<void> => {
  const botRef = doc(db, "bots", botId);
  await deleteDoc(botRef);
};

export const getOrCreateVisitor = async (visitorId: string, details?: Partial<Visitor>): Promise<Visitor> => {
  const visitorRef = doc(db, 'visitors', visitorId);
  try {
    const visitorSnap = await getDoc(visitorRef);
    if (visitorSnap.exists()) {
      const existingVisitor = { id: visitorSnap.id, ...visitorSnap.data() } as Visitor;
      if (!existingVisitor.name) {
        const newName = generateWhimsicalName();
        await updateDoc(visitorRef, { name: newName });
        existingVisitor.name = newName;
      }
      return existingVisitor;
    } else {
      const name = details?.name || generateWhimsicalName();
      const newVisitor: Omit<Visitor, 'id'> = {
        name: name,
        email: details?.email || 'N/A',
        avatarUrl: details?.avatarUrl || `https://placehold.co/100x100.png?text=${(name?.[0] || 'U')}`,
        location: {pathname: details?.location?.pathname || '', domain: details?.location?.domain || ''},
        lastSeen: new Date().toISOString(),
        companyName: 'N/A',
        sessions: 1,
        companyId: 'N/A',
        companyUsers: 1,
        companyPlan: 'N/A',
        companySpend: '$0.00',
      };

      setDoc(visitorRef, newVisitor)
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: visitorRef.path,
            operation: 'create',
            requestResourceData: newVisitor,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      return { id: visitorId, ...newVisitor };
    }
  } catch (serverError: any) {
    if (serverError.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({
        path: visitorRef.path,
        operation: 'get'
      });
      errorEmitter.emit('permission-error', permissionError);
    }
    throw serverError;
  }
}

export const updateVisitor = async (visitorId: string, updates: Partial<Visitor>): Promise<void> => {
  const visitorRef = doc(db, 'visitors', visitorId);
  try {
    const visitorSnap = await getDoc(visitorRef);
    if (visitorSnap.exists()) {
      await updateDoc(visitorRef, {
        ...updates,
        lastSeen: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Failed to update visitor:", error);
  }
};

// --- Help Center Management ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
  const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
}

export const addHelpCenter = async (helpCenter: Omit<HelpCenter, 'id'>): Promise<HelpCenter> => {
  const collRef = collection(db, 'help_centers');
  try {
    const docRef = await addDoc(collRef, helpCenter);
    return { id: docRef.id, ...helpCenter };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: helpCenter,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export const updateHelpCenter = async (helpCenterId: string, data: Partial<HelpCenter>): Promise<void> => {
  const hcRef = doc(db, 'help_centers', helpCenterId);
  await updateDoc(hcRef, data);
}

export const getHelpCenterCollections = async (hubId: string): Promise<HelpCenterCollection[]> => {
  const q = query(collection(db, 'help_center_collections'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
}

export const addHelpCenterCollection = async (collectionData: Omit<HelpCenterCollection, 'id'>): Promise<HelpCenterCollection> => {
  const docRef = await addDoc(collection(db, 'help_center_collections'), collectionData);
  return { id: docRef.id, ...collectionData };
}

export const updateHelpCenterCollection = async (collectionId: string, data: Partial<HelpCenterCollection>): Promise<void> => {
  const collectionRef = doc(db, "help_center_collections", collectionId);
  await updateDoc(collectionRef, data);
}

export const deleteHelpCenterCollection = async (collectionId: string): Promise<void> => {
  const collectionRef = doc(db, "help_center_collections", collectionId);
  await deleteDoc(collectionRef);
}

export const getHelpCenterArticles = async (hubId: string): Promise<HelpCenterArticle[]> => {
  const q = query(collection(db, 'help_center_articles'), where('hubId', '==', hubId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
}

export const addHelpCenterArticle = async (articleData: Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
  const collRef = collection(db, 'help_center_articles');
  try {
    const docRef = await addDoc(collRef, articleData);
    return { id: docRef.id, ...articleData };
  } catch (serverError) {
    const permissionError = new FirestorePermissionError({
      path: collRef.path,
      operation: 'create',
      requestResourceData: articleData,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
}

export const updateHelpCenterArticle = async (articleId: string, data: Partial<HelpCenterArticle>): Promise<void> => {
  const articleRef = doc(db, "help_center_articles", articleId);
  await updateDoc(articleRef, data);
};

export const deleteHelpCenterArticle = async (articleId: string): Promise<void> => {
    const articleRef = doc(db, "help_center_articles", articleId);
    await deleteDoc(articleRef);
};

export const updateHelpCenterContent = async (
  helpCenterId: string,
  selectedIds: { articles: string[], collections: string[] },
  allArticles: HelpCenterArticle[],
  allCollections: HelpCenterCollection[]
) => {
  const batch = writeBatch(db);

  // Process articles
  allArticles.forEach(article => {
    const articleRef = doc(db, 'help_center_articles', article.id);
    const shouldBeInHC = selectedIds.articles.includes(article.id);
    const isInHC = article.helpCenterIds?.includes(helpCenterId);

    if (shouldBeInHC && !isInHC) {
      batch.update(articleRef, { helpCenterIds: arrayUnion(helpCenterId) });
    } else if (!shouldBeInHC && isInHC) {
      batch.update(articleRef, { helpCenterIds: arrayRemove(helpCenterId) });
    }
  });

  // Process collections
  allCollections.forEach(collection => {
    const collectionRef = doc(db, 'help_center_collections', collection.id);
    const shouldBeInHC = selectedIds.collections.includes(collection.id);
    const isInHC = collection.helpCenterIds?.includes(helpCenterId);

    if (shouldBeInHC && !isInHC) {
      batch.update(collectionRef, { helpCenterIds: arrayUnion(helpCenterId) });
    } else if (!shouldBeInHC && isInHC) {
      batch.update(collectionRef, { helpCenterIds: arrayRemove(helpCenterId) });
    }
  });

  await batch.commit();
}

    
