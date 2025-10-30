export interface AsanaConfig {
  accessToken: string
  refreshToken?: string
  authType?: 'pat' | 'oauth'
  workspace?: string
  expiresAt?: number
}

export interface TaskOptions {
  name: string
  notes?: string
  assignee?: string
  dueOn?: string
  workspace?: string
  project?: string
}

export interface TaskListOptions {
  assignee?: string
  workspace?: string
  project?: string
  completed?: boolean
}

export interface TaskUpdateOptions {
  name?: string
  notes?: string
  assignee?: string
  dueOn?: string
  startOn?: string
  completed?: boolean | string // Commander.js parses as string "true"/"false"
}

export interface TaskMoveOptions {
  project: string
  section?: string
}

export interface ProjectCreateOptions {
  name: string
  workspace?: string
  team?: string
  notes?: string
  color?: string
  public?: boolean
}

export interface ProjectListOptions {
  workspace?: string
  team?: string
  archived?: boolean
}

export interface ProjectUpdateOptions {
  name?: string
  notes?: string
  color?: string
  archived?: boolean | string
  public?: boolean | string
}

export interface SectionCreateOptions {
  name: string
  insertBefore?: string
  insertAfter?: string
}

export interface SectionUpdateOptions {
  name?: string
}
