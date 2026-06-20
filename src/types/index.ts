export interface AsanaConfig {
  accessToken: string
  refreshToken?: string
  authType?: 'pat' | 'oauth'
  workspace?: string
  expiresAt?: number
  scopes?: string[]
}

export interface TaskOptions {
  name: string
  notes?: string
  assignee?: string
  dueOn?: string
  /** Deprecated alias for `dueOn`, kept for backward compatibility with `--due`. */
  due?: string
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

export interface SubtaskCreateOptions {
  name: string
  notes?: string
  assignee?: string
  dueOn?: string
}

export interface SubtaskListOptions {
  recursive?: boolean
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

export interface CommentAddOptions {
  html?: boolean
}

export interface TagListOptions {
  workspace?: string
}

export interface TagCreateOptions {
  name: string
  workspace?: string
  color?: string
  notes?: string
}

export interface TagUpdateOptions {
  name?: string
  color?: string
  notes?: string
}

export interface TeamListOptions {
  workspace?: string
  cache?: boolean // Commander sets false when --no-cache is passed
}

export interface WorkspaceListOptions {
  cache?: boolean
}

export interface UserSearchOptions {
  workspace?: string
}

export interface UserTasksOptions {
  workspace?: string
  completed?: boolean
}

export interface SectionCreateOptions {
  name: string
  insertBefore?: string
  insertAfter?: string
}

export interface SectionUpdateOptions {
  name?: string
}

export interface AttachmentDownloadOptions {
  output?: string
  force?: boolean
}

export interface CustomFieldListOptions {
  workspace?: string
}

export interface BatchFileOptions {
  file: string
}

export interface BatchCreateOptions extends BatchFileOptions {
  workspace?: string
}

export interface SearchOptions {
  workspace?: string
  limit?: string
  completed?: boolean | string // Commander.js parses as string "true"/"false"
  assignee?: string
}
