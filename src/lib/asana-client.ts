import Asana from 'asana'
import { getAccessToken, loadConfig, saveConfig } from './config'
import { refreshAccessToken } from './oauth'

let apiClientInstance: typeof Asana.ApiClient.instance | null = null
let tasksApiInstance: Asana.TasksApi | null = null
let usersApiInstance: Asana.UsersApi | null = null
let workspacesApiInstance: Asana.WorkspacesApi | null = null
let projectsApiInstance: Asana.ProjectsApi | null = null
let sectionsApiInstance: Asana.SectionsApi | null = null
let storiesApiInstance: Asana.StoriesApi | null = null
let tagsApiInstance: Asana.TagsApi | null = null
let attachmentsApiInstance: Asana.AttachmentsApi | null = null
let customFieldsApiInstance: Asana.CustomFieldsApi | null = null
let typeaheadApiInstance: Asana.TypeaheadApi | null = null
let teamsApiInstance: Asana.TeamsApi | null = null

function initializeApiClient(): typeof Asana.ApiClient.instance {
  if (apiClientInstance) {
    return apiClientInstance
  }

  const config = loadConfig()

  // Resolve the token via getAccessToken() so the ASANA_ACCESS_TOKEN env
  // fallback is honored. This enables brokered-egress sandboxes (ADR-005) to
  // run with a placeholder token while a broker injects the real credential.
  // Pass the already-loaded config to avoid a second readFileSync.
  const accessToken = getAccessToken(config)

  if (!accessToken) {
    throw new Error(
      'Asana access token not found. Set ASANA_ACCESS_TOKEN or run "asana auth login" first.',
    )
  }

  // OAuth tokens are refreshed up front by the CLI `preAction` hook
  // (see src/index.ts → refreshTokenIfNeeded), so by the time we initialize the
  // client the stored access token is already current.

  apiClientInstance = Asana.ApiClient.instance
  const token = apiClientInstance.authentications.token
  token.accessToken = accessToken

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
  if (!storiesApiInstance) {
    storiesApiInstance = new Asana.StoriesApi()
  }
  if (!tagsApiInstance) {
    tagsApiInstance = new Asana.TagsApi()
  }
  if (!attachmentsApiInstance) {
    attachmentsApiInstance = new Asana.AttachmentsApi()
  }
  if (!customFieldsApiInstance) {
    customFieldsApiInstance = new Asana.CustomFieldsApi()
  }
  if (!typeaheadApiInstance) {
    typeaheadApiInstance = new Asana.TypeaheadApi()
  }
  if (!teamsApiInstance) {
    teamsApiInstance = new Asana.TeamsApi()
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
      // Subtask operations
      getSubtasks: async (taskGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tasksApiInstance!.getSubtasksForTask(taskGid, optsWithLimit)
        return result
      },
      createSubtask: async (parentGid: string, taskData: any) => {
        const body = { data: taskData }
        const result = await tasksApiInstance!.createSubtaskForTask(body, parentGid, {})
        return result.data
      },
      setParent: async (taskGid: string, parentGid: string) => {
        const body = { data: { parent: parentGid } }
        const result = await tasksApiInstance!.setParentForTask(body, taskGid, {})
        return result.data
      },
      // Dependency operations (this task is blocked by its dependencies)
      getDependencies: async (taskGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tasksApiInstance!.getDependenciesForTask(taskGid, optsWithLimit)
        return result
      },
      addDependencies: async (taskGid: string, dependencies: string[]) => {
        const body = { data: { dependencies } }
        const result = await tasksApiInstance!.addDependenciesForTask(body, taskGid)
        return result.data
      },
      removeDependencies: async (taskGid: string, dependencies: string[]) => {
        const body = { data: { dependencies } }
        const result = await tasksApiInstance!.removeDependenciesForTask(body, taskGid)
        return result.data
      },
      // Dependent operations (these tasks are blocked by this task)
      getDependents: async (taskGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tasksApiInstance!.getDependentsForTask(taskGid, optsWithLimit)
        return result
      },
      addDependents: async (taskGid: string, dependents: string[]) => {
        const body = { data: { dependents } }
        const result = await tasksApiInstance!.addDependentsForTask(body, taskGid)
        return result.data
      },
      removeDependents: async (taskGid: string, dependents: string[]) => {
        const body = { data: { dependents } }
        const result = await tasksApiInstance!.removeDependentsForTask(body, taskGid)
        return result.data
      },
      // Follower operations
      addFollowers: async (taskGid: string, followers: string[]) => {
        const body = { data: { followers } }
        const result = await tasksApiInstance!.addFollowersForTask(body, taskGid, {})
        return result.data
      },
      removeFollowers: async (taskGid: string, followers: string[]) => {
        const body = { data: { followers } }
        const result = await tasksApiInstance!.removeFollowerForTask(body, taskGid, {})
        return result.data
      },
      // Tag assignment operations
      addTag: async (taskGid: string, tagGid: string) => {
        const body = { data: { tag: tagGid } }
        const result = await tasksApiInstance!.addTagForTask(body, taskGid)
        return result.data
      },
      removeTag: async (taskGid: string, tagGid: string) => {
        const body = { data: { tag: tagGid } }
        const result = await tasksApiInstance!.removeTagForTask(body, taskGid)
        return result.data
      },
      // Full-text search within a workspace (premium Asana feature)
      search: async (workspaceGid: string, opts: any = {}) => {
        const result = await tasksApiInstance!.searchTasksForWorkspace(workspaceGid, opts)
        return result
      },
    },
    stories: {
      createForTask: async (taskGid: string, storyData: Record<string, any>) => {
        const body = { data: storyData }
        const result = await storiesApiInstance!.createStoryForTask(body, taskGid, {})
        return result.data
      },
      findByTask: async (taskGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await storiesApiInstance!.getStoriesForTask(taskGid, optsWithLimit)
        return result
      },
    },
    tags: {
      create: async (tagData: Record<string, any>) => {
        const body = { data: tagData }
        const result = await tagsApiInstance!.createTag(body, {})
        return result.data
      },
      findById: async (tagGid: string, opts: any = {}) => {
        const result = await tagsApiInstance!.getTag(tagGid, opts)
        return result.data
      },
      findByWorkspace: async (workspaceGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tagsApiInstance!.getTagsForWorkspace(workspaceGid, optsWithLimit)
        return result
      },
      findByTask: async (taskGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await tagsApiInstance!.getTagsForTask(taskGid, optsWithLimit)
        return result
      },
      update: async (tagGid: string, updateData: Record<string, any>) => {
        const body = { data: updateData }
        const result = await tagsApiInstance!.updateTag(body, tagGid, {})
        return result.data
      },
      delete: async (tagGid: string) => {
        const result = await tagsApiInstance!.deleteTag(tagGid)
        return result.data
      },
    },
    attachments: {
      // `file` accepts an fs.ReadStream or Buffer so large files can stream
      createForObject: async (opts: Record<string, any>) => {
        const result = await attachmentsApiInstance!.createAttachmentForObject(opts)
        return result.data
      },
      findByParent: async (parentGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await attachmentsApiInstance!.getAttachmentsForObject(parentGid, optsWithLimit)
        return result
      },
      findById: async (attachmentGid: string, opts: any = {}) => {
        const result = await attachmentsApiInstance!.getAttachment(attachmentGid, opts)
        return result.data
      },
      delete: async (attachmentGid: string) => {
        const result = await attachmentsApiInstance!.deleteAttachment(attachmentGid)
        return result.data
      },
    },
    customFields: {
      findByWorkspace: async (workspaceGid: string, opts: any = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await customFieldsApiInstance!.getCustomFieldsForWorkspace(workspaceGid, optsWithLimit)
        return result
      },
      findById: async (customFieldGid: string, opts: any = {}) => {
        const result = await customFieldsApiInstance!.getCustomField(customFieldGid, opts)
        return result.data
      },
    },
    typeahead: {
      search: async (workspaceGid: string, resourceType: string, query: string, opts: any = {}) => {
        const result = await typeaheadApiInstance!.typeaheadForWorkspace(
          workspaceGid,
          resourceType,
          { query, ...opts },
        )
        return result
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
      findById: async (userGid: string, opts: Record<string, any> = {}) => {
        const result = await usersApiInstance!.getUser(userGid, opts)
        return result.data
      },
      // Endpoint is alphabetically sorted and capped at 2000 users by Asana
      findByWorkspace: async (workspaceGid: string, opts: Record<string, any> = {}) => {
        const result = await usersApiInstance!.getUsersForWorkspace(workspaceGid, opts)
        return result
      },
      findByTeam: async (teamGid: string, opts: Record<string, any> = {}) => {
        const result = await usersApiInstance!.getUsersForTeam(teamGid, opts)
        return result
      },
    },
    teams: {
      findById: async (teamGid: string, opts: Record<string, any> = {}) => {
        const result = await teamsApiInstance!.getTeam(teamGid, opts)
        return result.data
      },
      findByWorkspace: async (workspaceGid: string, opts: Record<string, any> = {}) => {
        const optsWithLimit = { limit: 100, ...opts }
        const result = await teamsApiInstance!.getTeamsForWorkspace(workspaceGid, optsWithLimit)
        return result
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
      findUsers: async (workspaceGid: string, opts: Record<string, any> = {}) => {
        const result = await usersApiInstance!.getUsersForWorkspace(workspaceGid, opts)
        return result
      },
    },
  }
}

/**
 * Commands that must NOT trigger an OAuth token refresh before running:
 * - `auth login` / `auth logout` manage credentials directly
 * - `self-update` does not call the Asana API
 * - `feedback` files a GitHub issue and never touches the Asana API, so a
 *   missing/expired Asana token must not block it
 */
const NO_REFRESH_COMMANDS = new Set(['auth login', 'auth logout', 'self-update', 'feedback'])

/**
 * Whether the given space-joined command path (e.g. "auth whoami", "task list")
 * should refresh the OAuth token before executing. Pure.
 */
export function shouldRefreshAuthForCommand(commandPath: string): boolean {
  return !NO_REFRESH_COMMANDS.has(commandPath)
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
  storiesApiInstance = null
  tagsApiInstance = null
  attachmentsApiInstance = null
  customFieldsApiInstance = null
  typeaheadApiInstance = null
  teamsApiInstance = null
}
