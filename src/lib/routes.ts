

export const HUB_VIEWS = {
  overview: "/overview",
  mytasks: "/mytasks",
  mentions: "/mentions",
  tasks: "/tasks",
  inbox: "/inbox",
  messages: "/messages",
  documents: "/documents",
  "help-center": "/help-center",
  flows: "/flows",
  'team-timesheets': "/team-timesheets",
  settings: "/settings",
  'all-threads': "/all-threads",
  channels: "/channels"
} as const;

export type AppView = keyof typeof HUB_VIEWS;
