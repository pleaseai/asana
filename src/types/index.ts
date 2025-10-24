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
