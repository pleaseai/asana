import Asana from 'asana'
import { loadConfig, saveConfig } from './config'
import { refreshAccessToken } from './oauth'

let apiClientInstance: typeof Asana.ApiClient.instance | null = null
let tasksApiInstance: Asana.TasksApi | null = null
let usersApiInstance: Asana.UsersApi | null = null
let workspacesApiInstance: Asana.WorkspacesApi | null = null
let projectsApiInstance: Asana.ProjectsApi | null = null
let sectionsApiInstance: Asana.SectionsApi | null = null

function initializeApiClient(): typeof Asana.ApiClient.instance {
  if (apiClientInstance) {
    return apiClientInstance
  }

  const config = loadConfig()

  if (!config || !config.accessToken) {
    throw new Error(
      'Asana access token not found. Please run "asana auth login" first.',
    )
  }

  // Check if OAuth token is expired and refresh if needed
  if (config.authType === 'oauth' && config.expiresAt && config.refreshToken) {
    const isExpired = Date.now() >= config.expiresAt

    if (isExpired) {
      console.warn('Token expired, will refresh on next API call')
    }
  }

  apiClientInstance = Asana.ApiClient.instance
  const token = apiClientInstance.authentications.token
  token.accessToken = config.accessToken

  return apiClientInstance
}

/**
 * Get Asana client with legacy-style API wrapper
 * This provides backward compatibility with the old Client.create() API
 */
export function getAsanaClient() {
  const apiClient = initializeApiClient()

  // Initialize API instances
  if (!tasksApiInstance) {
    tasksApiInstance = new Asana.TasksApi()
  }
  if (!usersApiInstance) {
    usersApiInstance = new Asana.UsersApi()
  }
  if (!workspacesApiInstance) {
    workspacesApiInstance = new Asana.WorkspacesApi()
  }
  if (!projectsApiInstance) {
    projectsApiInstance = new Asana.ProjectsApi()
  }
  if (!sectionsApiInstance) {
    sectionsApiInstance = new Asana.SectionsApi()
  }

  // Return a wrapper object that matches the old API structure
  return {
    apiClient,
    tasks: {
      create: async (taskData: any) => {
        const body = { data: taskData }
        const result = await tasksApiInstance!.createTask(body, {})
        return result.data
      },
      findById: async (taskGid: string, opts: any = {}) => {
        const result = await tasksApiInstance!.getTask(taskGid, opts)
        return result.data
      },
      findAll: async (opts: any = {}) => {
        // Add limit to avoid pagination errors
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tasksApiInstance!.getTasks(optsWithLimit)
        return result
      },
      findByProject: async (projectGid: string, opts: any = {}) => {
        const result = await tasksApiInstance!.getTasksForProject(projectGid, opts)
        return result
      },
      update: async (taskGid: string, updateData: any) => {
        const body = { data: updateData }
        const result = await tasksApiInstance!.updateTask(body, taskGid, {})
        return result.data
      },
      delete: async (taskGid: string) => {
        const result = await tasksApiInstance!.deleteTask(taskGid)
        return result.data
      },
      addProject: async (taskGid: string, data: any) => {
        const body = { data }
        const result = await tasksApiInstance!.addProjectForTask(body, taskGid, {})
        return result.data
      },
      removeProject: async (taskGid: string, data: any) => {
        const body = { data }
        const result = await tasksApiInstance!.removeProjectForTask(body, taskGid, {})
        return result.data
      },
    },
    projects: {
      create: async (projectData: Record<string, any>) => {
        const body = { data: projectData }
        const result = await projectsApiInstance!.createProject(body, {})
        return result.data
      },
      findById: async (projectGid: string, opts: Record<string, any> = {}) => {
        const result = await projectsApiInstance!.getProject(projectGid, opts)
        return result.data
      },
      findByWorkspace: async (workspaceGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await projectsApiInstance!.getProjectsForWorkspace(workspaceGid, optsWithLimit)
        return result
      },
      findByTeam: async (teamGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await projectsApiInstance!.getProjectsForTeam(teamGid, optsWithLimit)
        return result
      },
      update: async (projectGid: string, updateData: Record<string, any>) => {
        const body = { data: updateData }
        const result = await projectsApiInstance!.updateProject(body, projectGid, {})
        return result.data
      },
      delete: async (projectGid: string) => {
        const result = await projectsApiInstance!.deleteProject(projectGid)
        return result.data
      },
    },
    sections: {
      findByProject: async (projectGid: string, opts: any = {}) => {
        const result = await sectionsApiInstance!.getSectionsForProject(projectGid, opts)
        return result
      },
      createInProject: async (projectGid: string, sectionData: Record<string, any>) => {
        const body = { data: sectionData }
        const result = await sectionsApiInstance!.createSectionForProject(body, projectGid, {})
        return result.data
      },
      update: async (sectionGid: string, updateData: any) => {
        const body = { data: updateData }
        const result = await sectionsApiInstance!.updateSection(body, sectionGid, {})
        return result.data
      },
      delete: async (sectionGid: string) => {
        const result = await sectionsApiInstance!.deleteSection(sectionGid)
        return result.data
      },
    },
    users: {
      me: async () => {
        const result = await usersApiInstance!.getUser('me', {})
        return result.data
      },
    },
    workspaces: {
      findAll: async () => {
        const result = await workspacesApiInstance!.getWorkspaces({})
        return result
      },
      findById: async (workspaceGid: string) => {
        const result = await workspacesApiInstance!.getWorkspace(workspaceGid, {})
        return result.data
      },
    },
  }
}

/**
 * Refresh the OAuth token if it's expired
 * Returns true if token was refreshed
 */
export async function refreshTokenIfNeeded(): Promise<boolean> {
  const config = loadConfig()

  if (!config || config.authType !== 'oauth' || !config.refreshToken) {
    return false
  }

  // Check if token is expired or will expire in next 5 minutes
  const expiresAt = config.expiresAt || 0
  const shouldRefresh = Date.now() >= expiresAt - (5 * 60 * 1000)

  if (!shouldRefresh) {
    return false
  }

  try {
    const tokenResponse = await refreshAccessToken(config.refreshToken)

    // Update config with new tokens
    saveConfig({
      ...config,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    })

    // Reset client to use new token
    resetClient()

    return true
  }
  catch (error) {
    console.error('Failed to refresh token:', error)
    throw new Error(
      'Token refresh failed. Please run "asana auth login" again.',
    )
  }
}

export function resetClient(): void {
  apiClientInstance = null
  tasksApiInstance = null
  usersApiInstance = null
  workspacesApiInstance = null
  projectsApiInstance = null
  sectionsApiInstance = null
}
