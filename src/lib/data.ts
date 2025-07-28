// DATA STRUCTURES
export interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Member";
  slack_id: string;
  avatarUrl: string;
}

export interface Project {
  id: string;
  name: string;
  status: "Active" | "Archived" | "On Hold";
  created_by: string;
  members: string[];
  slack_channel_id?: string;
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: "Backlog" | "In Progress" | "Review" | "Done";
  assigned_to: string;
  due_date: string;
  comments: Comment[];
}

export interface Comment {
  user_id: string;
  comment: string;
  timestamp: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  task_id?: string;
  start_time: string;
  end_time: string;
  duration: number; // in hours
  source: "Manual" | "Timer" | "Slack";
  notes: string;
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

// MOCK DATA
export const users: User[] = [
  { id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'Admin', slack_id: 'U12345', avatarUrl: 'https://placehold.co/100x100' },
  { id: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'Member', slack_id: 'U67890', avatarUrl: 'https://placehold.co/100x100' },
  { id: 'user-3', name: 'Charlie', email: 'charlie@example.com', role: 'Member', slack_id: 'UABCDE', avatarUrl: 'https://placehold.co/100x100' },
  { id: 'user-4', name: 'Diana', email: 'diana@example.com', role: 'Admin', slack_id: 'UFGHJI', avatarUrl: 'https://placehold.co/100x100' },
];

export const currentUser = users[0]; // Alice is the current user (Admin)
// export const currentUser = users[1]; // Bob is the current user (Member)

export const projects: Project[] = [
  { id: 'proj-1', name: 'Website Redesign', status: 'Active', created_by: 'user-1', members: ['user-1', 'user-2'], slack_channel_id: 'C111' },
  { id: 'proj-2', name: 'Mobile App Development', status: 'Active', created_by: 'user-4', members: ['user-1', 'user-3', 'user-4'], slack_channel_id: 'C222' },
  { id: 'proj-3', name: 'API Integration', status: 'On Hold', created_by: 'user-1', members: ['user-2', 'user-3'] },
  { id: 'proj-4', name: 'Marketing Campaign', status: 'Archived', created_by: 'user-4', members: ['user-4'] },
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    name: 'Design home page mockups',
    description: 'Create high-fidelity mockups in Figma for the new website homepage.',
    status: 'In Progress',
    assigned_to: 'user-2',
    due_date: '2024-08-15T23:59:59Z',
    comments: [
      { user_id: 'user-1', comment: 'How is this going?', timestamp: '2024-08-01T10:00:00Z' },
    ],
  },
  {
    id: 'task-2',
    project_id: 'proj-1',
    name: 'Develop landing page component',
    description: 'Code the main hero section of the landing page.',
    status: 'Backlog',
    assigned_to: 'user-1',
    due_date: '2024-08-20T23:59:59Z',
    comments: [],
  },
  {
    id: 'task-3',
    project_id: 'proj-2',
    name: 'Setup push notification service',
    description: 'Integrate with OneSignal for push notifications.',
    status: 'Done',
    assigned_to: 'user-3',
    due_date: '2024-07-30T23:59:59Z',
    comments: [],
  },
  {
    id: 'task-4',
    project_id: 'proj-2',
    name: 'Implement login screen UI',
    description: 'Build the login and registration screens based on the wireframes.',
    status: 'Review',
    assigned_to: 'user-4',
    due_date: '2024-08-10T23:59:59Z',
    comments: [],
  },
  {
    id: 'task-5',
    project_id: 'proj-2',
    name: 'User profile page',
    description: 'Create the user profile page where users can edit their details.',
    status: 'In Progress',
    assigned_to: 'user-1',
    due_date: '2024-08-25T23:59:59Z',
    comments: [],
  },
];

export const timeEntries: TimeEntry[] = [
  { id: 'time-1', user_id: 'user-1', project_id: 'proj-2', task_id: 'task-5', start_time: '2024-08-05T09:00:00Z', end_time: '2024-08-05T11:00:00Z', duration: 2, source: 'Timer', notes: 'Worked on profile page layout.' },
  { id: 'time-2', user_id: 'user-2', project_id: 'proj-1', task_id: 'task-1', start_time: '2024-08-05T10:00:00Z', end_time: '2024-08-05T14:00:00Z', duration: 4, source: 'Manual', notes: 'Finalized mockup revisions.' },
  { id: 'time-3', user_id: 'user-3', project_id: 'proj-2', task_id: 'task-3', start_time: '2024-07-29T13:00:00Z', end_time: '2024-07-29T16:30:00Z', duration: 3.5, source: 'Timer', notes: '' },
  { id: 'time-4', user_id: 'user-1', project_id: 'proj-1', start_time: '2024-08-04T14:00:00Z', end_time: '2024-08-04T15:00:00Z', duration: 1, source: 'Slack', notes: 'Project sync meeting' },
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
    user_id: 'user-1',
    project_id: null,
    channel_id: 'C888',
    channel_name: 'project-handoff',
    meeting_start: '2024-08-06T11:00:00Z',
    meeting_end: '2024-08-06T12:00:00Z',
    duration: 1,
    suggested_project_id: undefined,
  },
];

export const adminMappings = {
  'C111': 'proj-1', // #proj-website-redesign
  'C222': 'proj-2', // #mobile-app-dev
};
