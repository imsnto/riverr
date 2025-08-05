// DATA STRUCTURES

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
  members: Record<string, SpaceMember>; // From string[] to Record<string, SpaceMember>
  statuses?: Status[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role?: 'Admin' | 'Member'; // Optional global role, but per-space is preferred
}

export interface Invite {
  id: string;
  email: string;
  role: "Admin" | "Member";
  spaces: string[]; // array of space IDs
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy?: {
    id: string;
    name: string;
  }
}

export interface Project {
  id: string;
  space_id: string;
  name: string;
  status: "Active" | "Archived" | "On Hold";
  created_by: string;
  members: string[]; // This remains a string array of user IDs
  slack_channel_id?: string;
}

export interface Subtask {
  id: string;
  name: string;
  status: string;
  assigned_to: string;
  due_date: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  assigned_to: string;
  due_date: string;
  priority: "Low" | "Medium" | "High" | "Urgent" | null;
  sprint_points: number | null;
  tags: string[];
  time_estimate: number | null; // in hours
  relationships: string[]; // e.g., parent task, related tasks
  activities: Activity[];
  comments: Comment[];
  attachments?: Attachment[];
  linked_task_id?: string;
  subtasks?: Subtask[];
}

export interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  type: "status_change" | "comment" | "assignee_change";
  from?: string;
  to?: string;
  comment_id?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}

export interface Comment {
  id: string;
  user_id: string;
  comment: string;
  timestamp: string;
  attachments?: Attachment[];
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string;
  source: "Manual" | "Timer" | "Slack";
  notes: string;
  start_time: string;
  end_time: string;
  duration: number; // in hours
}

export interface SlackMeetingLog {
  id: string;
  user_id: string;
  project_id: string | null;
  channel_id: string;
  channel_name: string;
  meeting_start: string;
  meeting_end: string;
  duration: number; // in hours
  suggested_project_id?: string;
}

export interface Channel {
  id: string;
  space_id: string;
  name: string;
  description: string;
  is_private: boolean;
  members: string[];
}

export interface Reaction {
  emoji: string;
  user_ids: string[];
  count: number;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  timestamp: string;
  thread_id?: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
  reply_count?: number;
  linked_task_id?: string;
}

const defaultStatuses: Status[] = [
    { name: 'Backlog', color: '#6b7280' },
    { name: 'In Progress', color: '#3b82f6' },
    { name: 'Review', color: '#f59e0b' },
    { name: 'Done', color: '#22c55e' },
];


// MOCK DATA - This data can be used to seed the database.

export const users: Omit<User, 'id'>[] = [
  { name: 'Brad Miller', email: 'brad@riverr.app', avatarUrl: 'https://placehold.co/100x100.png', role: 'Admin' },
  { name: 'Alice', email: 'alice@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Admin' },
  { name: 'Charlie', email: 'charlie@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Member' },
  { name: 'Diana', email: 'diana@example.com', avatarUrl: 'https://placehold.co/100x100.png', role: 'Member' }
];

export const spaces: Space[] = [
  { 
    id: 'space-1', 
    name: 'Work', 
    members: {
      'user-1': { role: 'Admin' },
      'user-2': { role: 'Member', permissions: { canViewTasks: true, canEditTasks: true, canLogTime: true, canSeeAllTimesheets: false, canViewReports: true, canInviteMembers: false } },
      'user-3': { role: 'Member', permissions: { canViewTasks: true, canEditTasks: false, canLogTime: true, canSeeAllTimesheets: false, canViewReports: false, canInviteMembers: false } },
      'user-4': { role: 'Admin' }
    },
    statuses: [...defaultStatuses] 
  },
  { 
    id: 'space-2', 
    name: 'Personal', 
    members: {
      'user-1': { role: 'Admin' },
      'user-4': { role: 'Admin' }
    }, 
    statuses: [{name: 'To Do', color: '#3b82f6'}, {name: 'Done', color: '#22c55e'}] 
  },
  { 
    id: 'space-3', 
    name: 'Client X', 
    members: {
      'user-2': { role: 'Admin' },
      'user-3': { role: 'Member', permissions: { canViewTasks: true, canEditTasks: true, canLogTime: true, canSeeAllTimesheets: true, canViewReports: true, canInviteMembers: true } },
    },
    statuses: [...defaultStatuses.slice(0,2), {name: 'Client Review', color: '#a855f7'}, {name: 'Approved', color: '#22c55e'}] 
  }
];

export const projects: Project[] = [
  { id: 'proj-1', space_id: 'space-1', name: 'Website Redesign', status: 'Active', created_by: 'user-1', members: ['user-1', 'user-2'], slack_channel_id: 'C111' },
  { id: 'proj-2', space_id: 'space-1', name: 'Mobile App Development', status: 'Active', created_by: 'user-1', members: ['user-1', 'user-3'], slack_channel_id: 'C222' },
  { id: 'proj-3', space_id: 'space-1', name: 'API Integration', status: 'On Hold', created_by: 'user-4', members: ['user-2', 'user-4'], slack_channel_id: 'C333' },
  { id: 'proj-4', space_id: 'space-2', name: 'Personal Website', status: 'Active', created_by: 'user-1', members: ['user-1'] },
  { id: 'proj-5', space_id: 'space-3', name: 'Marketing Campaign', status: 'Active', created_by: 'user-2', members: ['user-2', 'user-3'], slack_channel_id: 'C444' },
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    name: 'Design home page mockups',
    description: 'Create high-fidelity mockups in Figma for the new website homepage.',
    status: 'In Progress',
    assigned_to: 'user-1',
    due_date: '2024-08-15T23:59:59Z',
    priority: 'High',
    sprint_points: 8,
    tags: ['UI', 'Figma'],
    time_estimate: 16,
    relationships: [],
    activities: [
      { id: 'act-1', user_id: 'user-1', timestamp: '2024-07-20T16:48:00Z', type: 'status_change', from: 'Backlog', to: 'In Progress'},
      { id: 'act-2', user_id: 'user-1', timestamp: '2024-08-01T10:00:00Z', type: 'comment', comment_id: 'comment-1' },
    ],
    comments: [
      {
        id: 'comment-1',
        user_id: 'user-1',
        comment: 'How is this going? Can you upload the latest designs?',
        timestamp: '2024-08-01T10:00:00Z',
        attachments: [
          { id: 'att-1', name: 'wireframe-v1.png', url: 'https://placehold.co/600x400.png', type: 'image' }
        ]
      },
    ],
    attachments: [
      { id: 'att-1', name: 'wireframe-v1.png', url: 'https://placehold.co/600x400.png', type: 'image' }
    ],
    subtasks: [
      { id: 'sub-1', name: 'Design hero section', status: 'Done', assigned_to: 'user-1', due_date: '2024-08-10T23:59:59Z'},
      { id: 'sub-2', name: 'Design feature grid', status: 'In Progress', assigned_to: 'user-1', due_date: '2024-08-12T23:59:59Z'},
      { id: 'sub-3', name: 'Design footer', status: 'Backlog', assigned_to: 'user-1', due_date: null},
    ]
  },
  {
    id: 'task-2',
    project_id: 'proj-1',
    name: 'Develop landing page component',
    description: 'Code the main hero section of the landing page.',
    status: 'Backlog',
    assigned_to: 'user-2',
    due_date: '2024-08-20T23:59:59Z',
    priority: 'Medium',
    sprint_points: 5,
    tags: ['React', 'Web'],
    time_estimate: 24,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  },
  {
    id: 'task-3',
    project_id: 'proj-1',
    name: 'Set up analytics tracking',
    description: 'Integrate Google Analytics and set up event tracking for key user actions.',
    status: 'Done',
    assigned_to: 'user-1',
    due_date: '2024-08-10T23:59:59Z',
    priority: 'Low',
    sprint_points: 3,
    tags: ['Analytics'],
    time_estimate: 8,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  },
  {
    id: 'task-4',
    project_id: 'proj-2',
    name: 'Implement push notifications',
    description: 'Set up FCM and create the service to handle push notifications.',
    status: 'Review',
    assigned_to: 'user-3',
    due_date: '2024-08-18T23:59:59Z',
    priority: 'High',
    sprint_points: 8,
    tags: ['Mobile', 'Firebase'],
    time_estimate: 20,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  },
  {
    id: 'task-5',
    project_id: 'proj-2',
    name: 'User profile page',
    description: 'Create the user profile page where users can edit their details.',
    status: 'In Progress',
    assigned_to: 'user-1',
    due_date: '2024-08-25T23:59:59Z',
    priority: 'Medium',
    sprint_points: 5,
    tags: [],
    time_estimate: 12,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  },
  {
    id: 'task-6',
    project_id: 'proj-3',
    name: 'Research payment gateway APIs',
    description: 'Compare Stripe, Braintree, and PayPal APIs for our needs.',
    status: 'Backlog',
    assigned_to: 'user-4',
    due_date: '2024-09-01T23:59:59Z',
    priority: null,
    sprint_points: null,
    tags: ['API', 'Research'],
    time_estimate: 10,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  },
  {
    id: 'task-7',
    project_id: 'proj-5',
    name: 'Design social media assets',
    description: 'Create graphics for Facebook, Twitter, and Instagram for the upcoming launch.',
    status: 'Client Review',
    assigned_to: 'user-2',
    due_date: '2024-08-12T23:59:59Z',
    priority: 'High',
    sprint_points: 5,
    tags: ['Design', 'Marketing'],
    time_estimate: 15,
    relationships: [],
    activities: [],
    comments: [],
    attachments: [],
    subtasks: []
  }
];

export const timeEntries: TimeEntry[] = [
  { id: 'time-1', user_id: 'user-1', project_id: 'proj-2', task_id: 'task-5', start_time: '2024-08-05T09:00:00Z', end_time: '2024-08-05T11:00:00Z', duration: 2, source: 'Timer', notes: 'Worked on profile page layout.' },
  { id: 'time-2', user_id: 'user-2', project_id: 'proj-1', task_id: 'task-2', start_time: '2024-08-05T10:00:00Z', end_time: '2024-08-05T14:00:00Z', duration: 4, source: 'Manual', notes: 'Initial setup for landing page component.' },
  { id: 'time-3', user_id: 'user-3', project_id: 'proj-2', task_id: 'task-4', start_time: '2024-08-05T13:00:00Z', end_time: '2024-08-05T17:00:00Z', duration: 4, source: 'Timer', notes: 'Configuring FCM and testing notifications.' },
  { id: 'time-4', user_id: 'user-1', project_id: 'proj-1', start_time: '2024-08-04T14:00:00Z', end_time: '2024-08-04T15:00:00Z', duration: 1, source: 'Slack', notes: 'Project sync meeting' },
  { id: 'time-5', user_id: 'user-1', project_id: 'proj-1', task_id: 'task-1', start_time: '2024-08-06T09:00:00Z', end_time: '2024-08-06T12:00:00Z', duration: 3, source: 'Timer', notes: 'Refining homepage mockups.' },
  { id: 'time-6', user_id: 'user-2', project_id: 'proj-5', task_id: 'task-7', start_time: '2024-08-06T11:00:00Z', end_time: '2024-08-06T15:00:00Z', duration: 4, source: 'Manual', notes: 'Drafting Instagram post designs.' },

];

export const slackMeetingLogs: SlackMeetingLog[] = [
  {
    id: 'slack-1',
    user_id: 'user-1',
    project_id: 'proj-1',
    channel_id: 'C111',
    channel_name: 'proj-website-redesign',
    meeting_start: '2024-08-04T14:00:00Z',
    meeting_end: '2024-08-04T15:00:00Z',
    duration: 1,
  },
  {
    id: 'slack-2',
    user_id: 'user-2',
    project_id: null,
    channel_id: 'C999',
    channel_name: 'general-chatter',
    meeting_start: '2024-08-05T16:00:00Z',
    meeting_end: '2024-08-05T16:30:00Z',
    duration: 0.5,
  },
  {
    id: 'slack-3',
    user_id: 'user-3',
    project_id: null,
    channel_id: 'C888',
    channel_name: 'project-handoff',
    meeting_start: '2024-08-06T11:00:00Z',
    meeting_end: '2024-08-06T12:00:00Z',
    duration: 1,
    suggested_project_id: undefined,
  },
  {
    id: 'slack-4',
    user_id: 'user-4',
    project_id: null,
    channel_id: 'C333',
    channel_name: 'proj-api-integration',
    meeting_start: '2024-08-07T10:00:00Z',
    meeting_end: '2024-08-07T10:30:00Z',
    duration: 0.5,
    suggested_project_id: 'proj-3',
  },
];

export const adminMappings = {
  'C111': 'proj-1', // #proj-website-redesign
  'C222': 'proj-2', // #mobile-app-dev
  'C333': 'proj-3', // #api-integration
  'C444': 'proj-5', // #marketing-campaign
};

export const channels: Channel[] = [
  { id: 'chan-1', space_id: 'space-1', name: 'general', description: 'General announcements and discussions for the Work space.', is_private: false, members: ['user-1', 'user-2', 'user-3', 'user-4'] },
  { id: 'chan-2', space_id: 'space-1', name: 'proj-website-redesign', description: 'Discussions related to the website redesign project.', is_private: false, members: ['user-1', 'user-2'] },
  { id: 'chan-3', space_id: 'space-1', name: 'random', description: 'For water cooler conversations and memes.', is_private: false, members: ['user-1', 'user-2', 'user-3', 'user-4'] },
  { id: 'chan-4', space_id: 'space-1', name: 'design-critiques', description: 'Private channel for the design team.', is_private: true, members: ['user-1', 'user-2'] },
  { id: 'chan-5', space_id: 'space-2', name: 'weekend-plans', description: 'What\'s everyone up to this weekend?', is_private: false, members: ['user-1', 'user-4'] },
  { id: 'chan-6', space_id: 'space-3', name: 'client-comms', description: 'Official communication with Client X.', is_private: false, members: ['user-2', 'user-3'] },
];

export const messages: Message[] = [
  { id: 'msg-1', channel_id: 'chan-1', user_id: 'user-1', content: 'Welcome to the Work space!', timestamp: '2024-08-01T09:00:00Z', reactions: [], reply_count: 0 },
  { id: 'msg-2', channel_id: 'chan-2', user_id: 'user-2', content: 'Hey @Brad, can you look at the latest mockups for the homepage?', timestamp: '2024-08-01T10:30:00Z', reactions: [{ emoji: '👍', count: 1, user_ids: ['user-1']}], reply_count: 1 },
  { id: 'msg-3', channel_id: 'chan-2', user_id: 'user-1', content: 'Sure, taking a look now. They look great!', timestamp: '2024-08-01T10:32:00Z', thread_id: 'msg-2', reactions: [] },
  { id: 'msg-4', channel_id: 'chan-3', user_id: 'user-3', content: 'Has anyone seen that new cat video? It\'s hilarious.', timestamp: '2024-08-01T11:00:00Z', reactions: [], reply_count: 0 },
  { id: 'msg-5', channel_id: 'chan-5', user_id: 'user-4', content: 'I\'m going hiking this weekend, can\'t wait!', timestamp: '2024-08-02T14:00:00Z', reactions: [], reply_count: 0 },
  { id: 'msg-6', channel_id: 'chan-6', user_id: 'user-2', content: 'Just sent the weekly update to Client X.', timestamp: '2024-08-03T17:00:00Z', reactions: [], reply_count: 0 },
];
