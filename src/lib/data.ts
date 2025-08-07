// src/lib/data.ts
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Admin' | 'Member';
}

export interface Permissions {
    canViewTasks: boolean;
    canEditTasks: boolean;
    canLogTime: boolean;
    canSeeAllTimesheets: boolean;
    canViewReports: boolean;
    canInviteMembers: boolean;
}

export interface SpaceMember {
    role: 'Admin' | 'Member';
    permissions?: Permissions;
}

export interface Status {
    name: string;
    color: string;
}

export interface Space {
  id: string;
  name: string;
  members: Record<string, SpaceMember>; // key is user ID
  statuses: Status[];
  closingStatusName?: string;
}

export interface Project {
  id: string;
  name: string;
  space_id: string;
  members: string[]; // array of user IDs
  status: 'Active' | 'Archived' | 'On Hold';
  created_by: string; // user ID
}

export interface Task {
  id: string;
  project_id: string | null;
  name: string;
  description: string;
  status: string;
  assigned_to: string; // user ID
  due_date: string; // ISO 8601
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | null;
  sprint_points: number | null;
  tags: string[];
  time_estimate: number | null; // in hours
  relationships: { type: 'depends_on' | 'blocks'; taskId: string }[];
  activities: Activity[];
  comments: Comment[];
  attachments: Attachment[];
  parentId?: string | null;
}

export interface Activity {
  id: string;
  user_id: string;
  timestamp: string; // ISO 8601
  type: 'status_change' | 'assignee_change' | 'comment' | 'subtask_completion';
  from?: string;
  to?: string;
  comment_id?: string;
  comment?: string;
  subtask_name?: string;
}

export interface Comment {
    id: string;
    user_id: string;
    comment: string;
    timestamp: string;
    attachments: Attachment[];
}

export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'file';
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string;
  source: 'Timer' | 'Manual';
  notes: string;
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  duration: number; // in hours
}

export interface SlackMeetingLog {
    id: string;
    user_id: string;
    channel_name: string;
    meeting_start: string;
    duration: number; // in hours
    project_id: string | null;
}

export interface Channel {
    id: string;
    space_id: string;
    name: string;
    description: string;
    members: string[]; // user IDs
}

export interface Message {
    id: string;
    channel_id: string;
    user_id: string;
    content: string;
    timestamp: string; // ISO 8601
    attachments?: Attachment[];
    reactions?: { emoji: string; count: number, user_ids: string[] }[];
    thread_id?: string;
    reply_count?: number;
    linked_task_id?: string;
}

export interface Invite {
    id: string;
    email: string;
    role: 'Admin' | 'Member';
    spaces: string[]; // Space IDs
    permissions?: Permissions;
    token: string;
    status: 'pending' | 'accepted' | 'declined';
    invitedBy: string; // User ID
}

export interface JobFlowSubtaskTemplate {
    id: string;
    titleTemplate: string;
    defaultAssigneeId: string;
    estimatedDurationDays: number;
}

export interface JobFlowTaskTemplate {
    id: string;
    titleTemplate: string;
    descriptionTemplate?: string;
    defaultAssigneeId: string;
    estimatedDurationDays: number;
    subtaskTemplates?: JobFlowSubtaskTemplate[];
}

export interface JobFlowPhase {
    id: string;
    phaseIndex: number;
    name: string;
    tasks: JobFlowTaskTemplate[];
    requiresReview: boolean;
    defaultReviewerId?: string;
}

export interface JobFlowTemplate {
    id: string;
    name: string;
    space_id: string;
    description: string;
    phases: JobFlowPhase[];
    defaultView: 'kanban' | 'stepper' | 'list';
}

export interface PhaseTemplate {
    id: string;
    name: string;
    space_id: string;
    description?: string;
    tasks: JobFlowTaskTemplate[];
    requiresReview: boolean;
    defaultReviewerId?: string;
}

export interface TaskTemplate {
    id: string;
    space_id: string;
    titleTemplate: string;
    descriptionTemplate?: string;
    defaultAssigneeId: string;
    estimatedDurationDays: number;
    subtaskTemplates?: JobFlowSubtaskTemplate[];
}


export interface Job {
    id: string;
    name: string;
    workflowTemplateId: string;
    space_id: string;
    currentPhaseIndex: number;
    status: 'active' | 'completed' | 'on-hold';
    createdBy: string;
    createdAt: string;
    roleUserMapping: Record<string, string>; // Maps defaultAssigneeId to a real userId
}

export interface JobFlowTask {
    id: string;
    jobId: string;
    taskId: string;
    phaseIndex: number;
    createdAt: string;
    reviewedBy?: string;
}


// --- MOCK DATA ---
export const adminMappings = {
    'C012AB3CD': 'proj-1',
    'C054EF7GH': 'proj-2'
}

export const users: Omit<User, 'id'>[] = [
  { name: 'Brad', email: 'brad@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Admin' },
  { name: 'Alice', email: 'alice@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Member' },
  { name: 'Charlie', email: 'charlie@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Member' },
  { name: 'Diana', email: 'diana@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Member' },
];

export const spaces: Space[] = [
    { 
        id: 'space-1', 
        name: 'Riverr',
        members: {
            'user-1': { role: 'Admin' },
            'user-2': { role: 'Member' },
            'user-3': { role: 'Member' }
        },
        statuses: [
            { name: 'Backlog', color: '#6b7280' },
            { name: 'In Progress', color: '#3b82f6' },
            { name: 'In Review', color: '#f59e0b' },
            { name: 'Done', color: '#22c55e' },
        ],
        closingStatusName: 'Done'
    },
     { 
        id: 'space-2', 
        name: 'Acme Inc.',
        members: {
            'user-1': { role: 'Admin' },
            'user-4': { role: 'Member' }
        },
        statuses: [
            { name: 'To Do', color: '#6b7280' },
            { name: 'Doing', color: '#3b82f6' },
            { name: 'Blocked', color: '#ef4444' },
            { name: 'Shipped', color: '#22c55e' },
        ]
    }
];

export const projects: Project[] = [
  { id: 'proj-1', name: 'Website Redesign', space_id: 'space-1', members: ['user-1', 'user-2'], status: 'Active', created_by: 'user-1' },
  { id: 'proj-2', name: 'Mobile App Launch', space_id: 'space-1', members: ['user-1', 'user-3'], status: 'Active', created_by: 'user-1' },
  { id: 'proj-3', name: 'Q3 Marketing Campaign', space_id: 'space-2', members: ['user-1', 'user-4'], status: 'On Hold', created_by: 'user-4' },
];

export const tasks: Task[] = [
  // Project 1 Tasks
  { id: 'task-1', project_id: 'proj-1', name: 'Design homepage mockup', description: 'Create a high-fidelity mockup in Figma.', status: 'In Progress', assigned_to: 'user-2', due_date: '2024-08-15T23:59:59Z', priority: 'High', sprint_points: 8, tags: ['design', 'figma'], time_estimate: 16, relationships: [], activities: [], comments: [], attachments: [] },
  { id: 'task-2', project_id: 'proj-1', name: 'Develop homepage layout', description: 'Code the HTML/CSS for the new homepage.', status: 'Backlog', assigned_to: 'user-1', due_date: '2024-08-20T23:59:59Z', priority: 'High', sprint_points: 13, tags: ['dev', 'css'], time_estimate: 24, relationships: [{ type: 'depends_on', taskId: 'task-1' }], activities: [], comments: [], attachments: [] },
  // Project 2 Tasks
  { id: 'task-3', project_id: 'proj-2', name: 'Setup App Store Connect', description: 'Prepare listings for both Apple App Store and Google Play.', status: 'Done', assigned_to: 'user-3', due_date: '2024-08-01T23:59:59Z', priority: 'Urgent', sprint_points: 5, tags: ['release'], time_estimate: 8, relationships: [], activities: [], comments: [], attachments: [] },
  { id: 'task-4', project_id: 'proj-2', name: 'Plan launch day social media', description: 'Draft posts for Twitter, LinkedIn, etc.', status: 'In Review', assigned_to: 'user-1', due_date: '2024-08-10T23:59:59Z', priority: 'Medium', sprint_points: 3, tags: ['marketing'], time_estimate: 6, relationships: [], activities: [], comments: [], attachments: [] },
];

export const timeEntries: TimeEntry[] = [
    { id: 'time-1', user_id: 'user-2', project_id: 'proj-1', task_id: 'task-1', source: 'Timer', notes: 'Worked on initial wireframes', start_time: '2024-08-05T09:00:00Z', end_time: '2024-08-05T11:30:00Z', duration: 2.5 },
    { id: 'time-2', user_id: 'user-1', project_id: 'proj-2', task_id: 'task-4', source: 'Manual', notes: 'Drafting tweets', start_time: '2024-08-05T13:00:00Z', end_time: '2024-08-05T14:00:00Z', duration: 1 },
];

export const slackMeetingLogs: SlackMeetingLog[] = [
    { id: 'log-1', user_id: 'user-1', channel_name: 'proj-website', meeting_start: '2024-08-04T16:00:00Z', duration: 1, project_id: null },
    { id: 'log-2', user_id: 'user-3', channel_name: 'proj-mobile-app', meeting_start: '2024-08-02T10:00:00Z', duration: 0.5, project_id: 'proj-2' },
]

export const channels: Channel[] = [
    { id: 'chan-1', space_id: 'space-1', name: 'general', description: 'General chat for the Riverr team', members: ['user-1', 'user-2', 'user-3'] },
    { id: 'chan-2', space_id: 'space-1', name: 'website-dev', description: 'Discussion for the new website', members: ['user-1', 'user-2'] },
];

export const messages: Message[] = [
    { id: 'msg-1', channel_id: 'chan-2', user_id: 'user-1', content: "Hey @Alice, can you take a look at the latest mockups for the homepage? I think we're ready for development.", timestamp: '2024-08-05T10:00:00Z', reply_count: 2 },
    { id: 'msg-2', channel_id: 'chan-2', user_id: 'user-2', content: "Sure thing, Brad! They look great. I'll get started on the component structure.", timestamp: '2024-08-05T10:05:00Z', thread_id: 'msg-1' },
     { id: 'msg-3', channel_id: 'chan-2', user_id: 'user-1', content: "Perfect, let me know if you need any assets.", timestamp: '2024-08-05T10:06:00Z', thread_id: 'msg-1' }
];

export const taskTemplates: TaskTemplate[] = [
    {
        id: 'task-tpl-1',
        space_id: 'space-1',
        titleTemplate: 'Client Kick-off Meeting',
        descriptionTemplate: 'Schedule and hold the initial kick-off meeting with {{job_name}}.',
        defaultAssigneeId: 'user-1', // Brad - Account Manager
        estimatedDurationDays: 1,
        subtaskTemplates: [
            { id: 'sub-tpl-1a', titleTemplate: 'Send welcome email', defaultAssigneeId: 'user-1', estimatedDurationDays: 0 },
            { id: 'sub-tpl-1b', titleTemplate: 'Prepare meeting agenda', defaultAssigneeId: 'user-1', estimatedDurationDays: 0 },
        ]
    },
    {
        id: 'task-tpl-2',
        space_id: 'space-1',
        titleTemplate: 'Onboarding Call with {{job_name}}',
        defaultAssigneeId: 'user-3', // Charlie - Onboarding Specialist
        estimatedDurationDays: 1,
    }
];


export const phaseTemplates: PhaseTemplate[] = [
    {
        id: 'phase-tpl-1',
        space_id: 'space-1',
        name: 'Client Onboarding',
        description: 'Initial phase to onboard a new client.',
        tasks: [
            {
                id: 'task-tpl-1',
                titleTemplate: 'Client Kick-off Meeting',
                descriptionTemplate: 'Schedule and hold the initial kick-off meeting with {{job_name}}.',
                defaultAssigneeId: 'user-1', // Brad - Account Manager
                estimatedDurationDays: 1,
                subtaskTemplates: [
                    { id: 'sub-tpl-1a', titleTemplate: 'Send welcome email', defaultAssigneeId: 'user-1', estimatedDurationDays: 0 },
                    { id: 'sub-tpl-1b', titleTemplate: 'Prepare meeting agenda', defaultAssigneeId: 'user-1', estimatedDurationDays: 0 },
                ]
            }
        ],
        requiresReview: true,
        defaultReviewerId: 'user-1'
    }
]

export const jobFlowTemplates: JobFlowTemplate[] = [
  {
    id: 'jft-1',
    space_id: 'space-1',
    name: 'Client Onboarding Pipeline',
    description: 'A standard pipeline for bringing new clients into the fold.',
    defaultView: 'kanban',
    phases: [
      { id: 'phase-1', phaseIndex: 0, name: 'Lead In', requiresReview: false, tasks: [
        { id: 'task-tpl-j1-p1-t1', titleTemplate: 'Qualify Lead: {{job_name}}', defaultAssigneeId: 'user-1', estimatedDurationDays: 1 }
      ]},
      { id: 'phase-2', phaseIndex: 1, name: 'Contact Made', requiresReview: false, tasks: [
        { id: 'task-tpl-j1-p2-t1', titleTemplate: 'Initial Outreach Call with {{job_name}}', defaultAssigneeId: 'user-1', estimatedDurationDays: 1 }
      ]},
      { id: 'phase-3', phaseIndex: 2, name: 'Demo Scheduled', requiresReview: true, defaultReviewerId: 'user-1', tasks: [
         { id: 'task-tpl-j1-p3-t1', titleTemplate: 'Schedule Product Demo for {{job_name}}', defaultAssigneeId: 'user-2', estimatedDurationDays: 2 }
      ]},
      { id: 'phase-4', phaseIndex: 3, name: 'Proposal Sent', requiresReview: false, tasks: [
        { id: 'task-tpl-j1-p4-t1', titleTemplate: 'Send Proposal to {{job_name}}', defaultAssigneeId: 'user-1', estimatedDurationDays: 3 }
      ]},
    ],
  },
   {
    id: 'jft-2',
    space_id: 'space-1',
    name: 'New Employee Onboarding',
    description: 'A checklist for onboarding new employees.',
    defaultView: 'stepper',
    phases: [
      { id: 'phase-j2-1', phaseIndex: 0, name: 'Pre-Onboarding', requiresReview: true, defaultReviewerId: 'user-4', tasks: [
          { id: 'task-tpl-j2-p1-t1', titleTemplate: 'Send Welcome Packet to {{job_name}}', defaultAssigneeId: 'user-4', estimatedDurationDays: 1},
          { id: 'task-tpl-j2-p1-t2', titleTemplate: 'Setup IT Equipment for {{job_name}}', defaultAssigneeId: 'user-1', estimatedDurationDays: 2}
      ]},
      { id: 'phase-j2-2', phaseIndex: 1, name: 'First Week', requiresReview: false, tasks: [
          { id: 'task-tpl-j2-p2-t1', titleTemplate: 'HR Orientation for {{job_name}}', defaultAssigneeId: 'user-4', estimatedDurationDays: 1}
      ]},
    ],
  },
  {
    id: 'jft-3',
    space_id: 'space-1',
    name: 'Simple Checklist',
    description: 'A basic list of tasks.',
    defaultView: 'list',
    phases: [
      { id: 'phase-j3-1', phaseIndex: 0, name: 'To Do', requiresReview: false, tasks: [
        { id: 'task-tpl-j3-p1-t1', titleTemplate: 'Task A for {{job_name}}', defaultAssigneeId: 'user-1', estimatedDurationDays: 1 },
        { id: 'task-tpl-j3-p1-t2', titleTemplate: 'Task B for {{job_name}}', defaultAssigneeId: 'user-2', estimatedDurationDays: 2 },
      ]},
    ]
  }
];


export const jobs: Job[] = [
    { id: 'job-1', name: 'Onboard Acme Corp', workflowTemplateId: 'jft-1', space_id: 'space-1', currentPhaseIndex: 0, status: 'active', createdBy: 'user-1', createdAt: '2024-08-01T10:00:00Z', roleUserMapping: {'user-1': 'user-1', 'user-2': 'user-2'} },
    { id: 'job-2', name: 'Onboard Globex Inc', workflowTemplateId: 'jft-1', space_id: 'space-1', currentPhaseIndex: 1, status: 'active', createdBy: 'user-1', createdAt: '2024-08-02T11:00:00Z', roleUserMapping: {'user-1': 'user-1', 'user-2': 'user-2'} },
    { id: 'job-3', name: 'Onboard Jane Doe', workflowTemplateId: 'jft-2', space_id: 'space-2', currentPhaseIndex: 0, status: 'active', createdBy: 'user-4', createdAt: '2024-08-03T12:00:00Z', roleUserMapping: {'user-4': 'user-4', 'user-1': 'user-1'} },
    { id: 'job-4', name: 'Onboard Synergy Inc', workflowTemplateId: 'jft-1', space_id: 'space-1', currentPhaseIndex: 3, status: 'active', createdBy: 'user-1', createdAt: '2024-08-05T14:00:00Z', roleUserMapping: {'user-1': 'user-1', 'user-2': 'user-2'} },
    { id: 'job-5', name: 'Onboard John Smith', workflowTemplateId: 'jft-2', space_id: 'space-2', currentPhaseIndex: 1, status: 'active', createdBy: 'user-4', createdAt: '2024-08-06T15:00:00Z', roleUserMapping: {'user-4': 'user-4', 'user-1': 'user-1'} },
    { id: 'job-6', name: 'Q3 Report', workflowTemplateId: 'jft-3', space_id: 'space-1', currentPhaseIndex: 0, status: 'active', createdBy: 'user-1', createdAt: '2024-08-07T16:00:00Z', roleUserMapping: {'user-1': 'user-1', 'user-2': 'user-2'} },
    { id: 'job-7', name: 'Q4 Planning', workflowTemplateId: 'jft-3', space_id: 'space-1', currentPhaseIndex: 0, status: 'completed', createdBy: 'user-1', createdAt: '2024-07-01T16:00:00Z', roleUserMapping: {'user-1': 'user-1', 'user-2': 'user-2'} },

];

export const jobFlowTasks: JobFlowTask[] = [
    // Existing
    { id: 'jftask-1', jobId: 'job-1', taskId: 'task-jft-1', phaseIndex: 0, createdAt: '2024-08-01T10:00:00Z' },
    { id: 'jftask-2', jobId: 'job-2', taskId: 'task-jft-2', phaseIndex: 0, createdAt: '2024-08-02T11:00:00Z' },
    { id: 'jftask-3', jobId: 'job-2', taskId: 'task-jft-3', phaseIndex: 1, createdAt: '2024-08-02T11:00:00Z' },
    { id: 'jftask-4', jobId: 'job-3', taskId: 'task-jft-4', phaseIndex: 0, createdAt: '2024-08-03T12:00:00Z' },

    // New for job-4 (jft-1)
    { id: 'jftask-5', jobId: 'job-4', taskId: 'task-jft-5', phaseIndex: 0, createdAt: '2024-08-05T14:00:00Z' },
    { id: 'jftask-6', jobId: 'job-4', taskId: 'task-jft-6', phaseIndex: 1, createdAt: '2024-08-05T14:00:00Z' },
    { id: 'jftask-7', jobId: 'job-4', taskId: 'task-jft-7', phaseIndex: 2, createdAt: '2024-08-05T14:00:00Z', reviewedBy: 'user-1' },
    { id: 'jftask-8', jobId: 'job-4', taskId: 'task-jft-8', phaseIndex: 3, createdAt: '2024-08-05T14:00:00Z' },

    // New for job-5 (jft-2)
    { id: 'jftask-9', jobId: 'job-5', taskId: 'task-jft-9', phaseIndex: 0, createdAt: '2024-08-06T15:00:00Z' },
    { id: 'jftask-10', jobId: 'job-5', taskId: 'task-jft-10', phaseIndex: 1, createdAt: '2024-08-06T15:00:00Z' },

    // New for job-6 (jft-3)
    { id: 'jftask-11', jobId: 'job-6', taskId: 'task-jft-11', phaseIndex: 0, createdAt: '2024-08-07T16:00:00Z' },

     // New for job-7 (jft-3)
    { id: 'jftask-12', jobId: 'job-7', taskId: 'task-jft-12', phaseIndex: 0, createdAt: '2024-07-01T16:00:00Z' },

];

// Let's add the tasks for the jobs
tasks.push(
    // Existing
    { id: 'task-jft-1', project_id: null, name: 'Qualify Lead: Onboard Acme Corp', description: '', status: 'In Progress', assigned_to: 'user-1', due_date: '2024-08-02T10:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-2', project_id: null, name: 'Qualify Lead: Onboard Globex Inc', description: '', status: 'Done', assigned_to: 'user-1', due_date: '2024-08-03T11:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-3', project_id: null, name: 'Initial Outreach Call with Onboard Globex Inc', description: '', status: 'In Progress', assigned_to: 'user-1', due_date: '2024-08-04T11:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-4', project_id: null, name: 'Send Welcome Packet to Onboard Jane Doe', description: '', status: 'In Progress', assigned_to: 'user-4', due_date: '2024-08-04T12:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    
    // New tasks for seeded jobs
    { id: 'task-jft-5', project_id: null, name: 'Qualify Lead: Onboard Synergy Inc', description: '', status: 'Done', assigned_to: 'user-1', due_date: '2024-08-06T14:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-6', project_id: null, name: 'Initial Outreach Call with Onboard Synergy Inc', description: '', status: 'Done', assigned_to: 'user-1', due_date: '2024-08-07T14:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-7', project_id: null, name: 'Schedule Product Demo for Onboard Synergy Inc', description: '', status: 'Done', assigned_to: 'user-2', due_date: '2024-08-09T14:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-8', project_id: null, name: 'Send Proposal to Onboard Synergy Inc', description: '', status: 'In Progress', assigned_to: 'user-1', due_date: '2024-08-12T14:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-9', project_id: null, name: 'Send Welcome Packet to Onboard John Smith', description: '', status: 'Done', assigned_to: 'user-4', due_date: '2024-08-07T15:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-10', project_id: null, name: 'HR Orientation for Onboard John Smith', description: '', status: 'Pending', assigned_to: 'user-4', due_date: '2024-08-08T15:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-11', project_id: null, name: 'Task A for Q3 Report', description: '', status: 'In Progress', assigned_to: 'user-1', due_date: '2024-08-08T16:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null },
    { id: 'task-jft-12', project_id: null, name: 'Task A for Q4 Planning', description: '', status: 'Done', assigned_to: 'user-1', due_date: '2024-07-02T16:00:00Z', priority: 'Medium', sprint_points: null, tags: ['JobFlow'], time_estimate: null, relationships: [], activities: [], comments: [], attachments: [], parentId: null }
);
