
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
} from "./data";
import { randomBytes } from "crypto";

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
    projects.forEach((project) =>
      batch.set(doc(db, "projects", project.id), project)
    );
    tasks.forEach((task) => batch.set(doc(db, "tasks", task.id), task));
    timeEntries.forEach((entry) =>
      batch.set(doc(db, "time_entries", entry.id), entry)
    );
    slackMeetingLogs.forEach((log) =>
      batch.set(doc(db, "slack_meeting_logs", log.id), log)
    );
    channels.forEach((channel) =>
      batch.set(doc(db, "channels", channel.id), channel)
    );
    messages.forEach((message) =>
      batch.set(doc(db, "messages", message.id), message)
    );
    jobFlowTemplates.forEach((template) =>
      batch.set(doc(db, "job_flow_templates", template.id), template)
    );
    phaseTemplates.forEach((template) =>
      batch.set(doc(db, "phase_templates", template.id), template)
    );
    taskTemplates.forEach((template) =>
      batch.set(doc(db, "task_templates", template.id), template)
    );
    jobs.forEach((job) => batch.set(doc(db, "jobs", job.id), job));
    jobFlowTasks.forEach((jft) =>
      batch.set(doc(db, "job_flow_tasks", jft.id), jft)
    );

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
  const q = query(
    collection(db, "spaces"),
    where(`members.${userId}`, "!=", null)
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

export const addSpace = async (space: Omit<Space, "id">) => {
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
export const addHub = async (hub: Omit<Hub, "id">): Promise<Hub> => {
  const docRef = await addDoc(collection(db, "hubs"), hub);
  return { ...hub, id: docRef.id };
};

export const getHubsForSpace = async (spaceId: string): Promise<Hub[]> => {
  const q = query(collection(db, "hubs"), where("spaceId", "==", spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Hub)
  );
};

// --- Project Management ---
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
export const getTasksInProject = async (projectId: string): Promise<Task[]> => {
  const q = query(
    collection(db, "tasks"),
    where("project_id", "==", projectId)
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

export const getAllTasks = async (): Promise<Task[]> => {
  const querySnapshot = await getDocs(collection(db, "tasks"));
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
export const getTimeEntriesInSpace = async (
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
  const projectsInSpace = await getProjectsInSpace(spaceId);
  const projectIds = projectsInSpace.map((p) => p.id);

  // This logic is a bit flawed. It assumes unassigned logs belong to the current space.
  // In a real app, you might have a space_id on the log or filter by user's slack ID.
  // For now, we'll return all unassigned logs + logs for projects in the current space.

  const unassignedQ = query(
    collection(db, "slack_meeting_logs"),
    where("project_id", "==", null)
  );
  const unassignedSnapshot = await getDocs(unassignedQ);
  const unassignedLogs = unassignedSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as SlackMeetingLog)
  );

  if (projectIds.length === 0) return unassignedLogs;

  const q = query(
    collection(db, "slack_meeting_logs"),
    where("project_id", "in", projectIds)
  );
  const querySnapshot = await getDocs(q);
  const assignedLogs = querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as SlackMeetingLog)
  );

  return [...unassignedLogs, ...assignedLogs];
};

// --- Channel & Message Management ---
export const getChannelsInSpace = async (
  spaceId: string
): Promise<Channel[]> => {
  const q = query(collection(db, "channels"), where("space_id", "==", spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Channel)
  );
};

export const addChannel = async (
  channel: Omit<Channel, "id">
): Promise<Channel> => {
  const docRef = await addDoc(collection(db, "channels"), channel);
  return { ...channel, id: docRef.id };
};

export const updateChannel = async (
  channelId: string,
  data: Partial<Channel>
): Promise<void> => {
  const channelRef = doc(db, "channels", channelId);
  await updateDoc(channelRef, data);
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
  spaceId: string
): Promise<JobFlowTemplate[]> => {
  const q = query(
    collection(db, "job_flow_templates"),
    where("space_id", "==", spaceId)
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
  spaceId: string
): Promise<PhaseTemplate[]> => {
  const q = query(
    collection(db, "phase_templates"),
    where("space_id", "==", spaceId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as PhaseTemplate)
  );
};

export const getTaskTemplates = async (
  spaceId: string
): Promise<TaskTemplate[]> => {
  const q = query(
    collection(db, "task_templates"),
    where("space_id", "==", spaceId)
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

export const getAllJobs = async (spaceId: string): Promise<Job[]> => {
  const q = query(collection(db, "jobs"), where("space_id", "==", spaceId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Job)
  );
};

export const getAllJobFlowTasks = async (
  spaceId: string
): Promise<JobFlowTask[]> => {
  // This is inefficient. In a real app, you might query by job IDs that are in the space.
  // For now, let's get all jobs in the space and then get their tasks.
  const jobsInSpace = await getAllJobs(spaceId);
  if (jobsInSpace.length === 0) return [];

  const jobIds = jobsInSpace.map((j) => j.id);
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
  parentDueDate: Date
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
  roleUserMapping: Record<string, string>
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
        dueDate
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
  spaceId: string
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
    roleUserMapping
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
      job.roleUserMapping
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
export const getDocumentsInSpace = async (
  spaceId: string
): Promise<Document[]> => {
  const q = query(collection(db, "documents"), where("spaceId", "==", spaceId));
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
  await updateDoc(docRef, data);
};

export const deleteDocument = async (docId: string): Promise<void> => {
  await deleteDoc(doc(db, "documents", docId));
};

    