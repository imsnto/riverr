
export const HUB_VIEWS = {
  overview: "/overview",
  tasks: "/tasks",
  tickets: "/tickets",
  deals: "/deals",
  inbox: "/inbox",
  "help-center": "/help-center",
  "support-intelligence": "/support-intelligence",
  'team-timesheets': "/team-timesheets",
  settings: "/settings",
  contacts: "/contacts",
} as const;

export type AppView = keyof typeof HUB_VIEWS;
