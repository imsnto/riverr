
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
  limit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
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
  ChatContact,
  Bot,
  HelpCenter,
  HelpCenterCollection,
  HelpCenterArticle,
} from "./data";
import { randomBytes } from "crypto";
import { FirestorePermissionError } from "./errors";
import { errorEmitter } from "./error-emitter";

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
    hubs.forEach((hub) => {
        const hubRef = doc(collection(db, "hubs"));
        batch.set(hubRef, hub);
    });
    // Note: projects, tasks etc. are not seeded anymore as they should be created within hubs
    
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
  return { id: userDoc.id, ...doc.data() } as User;
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

export const createDefaultHubForSpace = async (spaceId: string, userId: string, hubData: Partial<Omit<Hub, 'id' | 'spaceId'>>) => {
    const finalHubData: Omit<Hub, 'id'> = {
        name: hubData.name || 'Default Hub',
        spaceId,
        type: hubData.type || 'project-management',
        createdAt: new Date().toISOString(),
        createdBy: userId,
        isDefault: hubData.isDefault || true,
        settings: hubData.settings || { components: ['tasks', 'documents', 'messages'], defaultView: 'tasks' },
        isPrivate: hubData.isPrivate || false,
        memberIds: hubData.memberIds || [],
        statuses: hubData.statuses || defaultStatuses,
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
      assigned_to: subtaskAssigneeId,
      due_date: parentDueDate.toISOString(), // Subtasks get same due date as parent
      priority: null,
      sprint_points: null,
      tags: ["JobFlow", jobName],
      time_estimate: null,
      relationships: [],
      activities: [],
      comments: [],
      attachments: [],
      parentId: parentTaskId,
      spaceId: '',
    };
    const subtaskRef = doc(collection(db, "tasks"));
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

    const taskRef = doc(collection(db, "tasks"));
    const taskData: Omit<Task, "id"> = {
      project_id: null,
      hubId: hubId,
      name: taskTitle,
      description: taskDescription,
      status: "Pending",
      assigned_to: assigneeId,
      due_date: dueDate.toISOString(),
      priority: "Medium",
      sprint_points: null,
      tags: ["JobFlow", jobName],
      time_estimate: taskTemplate.estimatedDurationDays * 8, // Assume 8 hours per day
      relationships: [],
      activities: [],
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
        hubId
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
  hubId: string,
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
    hubId: hubId,
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
    hubId,
    spaceId,
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
      job.space_id
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

// --- Inbox / Chat Management ---
export const getConversationsForHub = async (hubId: string): Promise<Conversation[]> => {
    const q = query(collection(db, 'conversations'), where('hubId', '==', hubId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
};

export const getMessagesForConversations = async (conversationIds: string[]): Promise<ChatMessage[]> => {
    if (conversationIds.length === 0) return [];
    const messages: ChatMessage[] = [];
    // Firestore 'in' query is limited to 30 items
    for (let i = 0; i < conversationIds.length; i+=30) {
        const chunk = conversationIds.slice(i, i + 30);
        const q = query(collection(db, 'chat_messages'), where('conversationId', 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
        });
    }
    return messages;
}

export const addChatMessage = async (message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> => {
    const collRef = collection(db, 'chat_messages');
    try {
        const docRef = await addDoc(collRef, message);
        return { ...message, id: docRef.id };
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: collRef.path,
            operation: 'create',
            requestResourceData: message,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export const updateConversation = async (conversationId: string, data: Partial<Conversation>): Promise<void> => {
    const convRef = doc(db, 'conversations', conversationId);
    try {
        await updateDoc(convRef, data);
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
  } catch(serverError: any) {
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

export const getOrCreateContact = async (contactId: string, details?: Partial<ChatContact>): Promise<ChatContact> => {
    const contactRef = doc(db, 'chat_contacts', contactId);
    try {
        const contactSnap = await getDoc(contactRef);
        if (contactSnap.exists()) {
            return { id: contactSnap.id, ...contactSnap.data() } as ChatContact;
        } else {
            const newContact: Omit<ChatContact, 'id'> = {
                name: details?.name || 'Anonymous User',
                email: details?.email || 'N/A',
                avatarUrl: details?.avatarUrl || `https://placehold.co/100x100.png?text=${(details?.name?.[0] || 'U')}`,
                location: details?.location || 'Unknown',
                lastSeen: new Date().toISOString(),
                companyName: 'N/A',
                sessions: 1,
                companyId: 'N/A',
                companyUsers: 1,
                companyPlan: 'N/A',
                companySpend: '$0.00',
            };
            
            setDoc(contactRef, newContact)
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: contactRef.path,
                        operation: 'create',
                        requestResourceData: newContact,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });

            return { id: contactId, ...newContact };
        }
    } catch (serverError: any) {
        if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: contactRef.path,
                operation: 'get'
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        throw serverError;
    }
}

// --- Help Center Management ---
export const getHelpCenters = async (hubId: string): Promise<HelpCenter[]> => {
    const q = query(collection(db, 'help_centers'), where('hubId', '==', hubId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenter));
}

export const addHelpCenter = async (helpCenter: Omit<HelpCenter, 'id'>): Promise<HelpCenter> => {
    const docRef = await addDoc(collection(db, 'help_centers'), helpCenter);
    return { id: docRef.id, ...helpCenter };
}

export const getHelpCenterCollections = async (helpCenterId: string): Promise<HelpCenterCollection[]> => {
    const q = query(collection(db, 'help_center_collections'), where('helpCenterId', '==', helpCenterId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
}

export const addHelpCenterCollection = async (collectionData: Omit<HelpCenterCollection, 'id'>): Promise<HelpCenterCollection> => {
    const docRef = await addDoc(collection(db, 'help_center_collections'), collectionData);
    return { id: docRef.id, ...collectionData };
}

export const getHelpCenterArticles = async (helpCenterId: string): Promise<HelpCenterArticle[]> => {
    const q = query(collection(db, 'help_center_articles'), where('helpCenterId', '==', helpCenterId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
}

export const addHelpCenterArticle = async (articleData: Omit<HelpCenterArticle, 'id'>): Promise<HelpCenterArticle> => {
    const docRef = await addDoc(collection(db, 'help_center_articles'), articleData);
    return { id: docRef.id, ...articleData };
}

export const updateHelpCenterArticle = async (articleId: string, data: Partial<HelpCenterArticle>): Promise<void> => {
  const articleRef = doc(db, "help_center_articles", articleId);
  await updateDoc(articleRef, data);
};
