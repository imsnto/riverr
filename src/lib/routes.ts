

export const HUB_VIEWS = {
  overview: "/overview",
  tasks: "/tasks",
  inbox: "/inbox",
  documents: "/documents",
  "help-center": "/help-center",
  flows: "/flows",
  'team-timesheets': "/team-timesheets",
  settings: "/settings",
} as const;

export type AppView = keyof typeof HUB_VIEWS;
