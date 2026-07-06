import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const API_BASE = 'https://app.asana.com/api/1.0'

let cachedToken: Promise<string> | undefined

/** Memoized so repeated AsanaClient.create() calls (one per seed/verify) read the config file once. */
function loadToken(): Promise<string> {
  cachedToken ??= resolveToken()
  return cachedToken
}

async function resolveToken(): Promise<string> {
  if (process.env.ASANA_ACCESS_TOKEN) {
    return process.env.ASANA_ACCESS_TOKEN
  }
  const configFile = Bun.file(join(homedir(), '.asana-cli', 'config.json'))
  if (await configFile.exists()) {
    const config = await configFile.json()
    if (config.accessToken) {
      return config.accessToken
    }
  }
  throw new Error('No Asana token found: set ASANA_ACCESS_TOKEN or run `asana auth login`')
}

/**
 * Ground-truth client for fixture setup and verification.
 * Talks to the Asana REST API directly so measurements of the interfaces
 * under test (CLI / MCP / Executor) are never mixed with harness traffic.
 */
export class AsanaClient {
  private constructor(private readonly token: string) {}

  static async create(): Promise<AsanaClient> {
    return new AsanaClient(await loadToken())
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const payload = await this.requestRaw<T>(method, path, body, query)
    return payload.data
  }

  private async requestRaw<T = any>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<{ data: T, next_page?: { offset: string } | null }> {
    const url = new URL(API_BASE + path)
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value)
    }
    const res = await fetch(url, {
      method,
      headers: {
        'authorization': `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify({ data: body }),
    })
    if (!res.ok) {
      throw new Error(`Asana ${method} ${path} → ${res.status}: ${await res.text()}`)
    }
    return await res.json() as { data: T, next_page?: { offset: string } | null }
  }

  me(): Promise<{ gid: string, name: string }> {
    return this.request('GET', '/users/me')
  }

  workspaces(): Promise<Array<{ gid: string, name: string }>> {
    return this.request('GET', '/workspaces')
  }

  /** teams the authenticated user is a member of (project creation requires membership) */
  myTeams(workspaceGid: string): Promise<Array<{ gid: string, name: string }>> {
    return this.request('GET', '/users/me/teams', undefined, { organization: workspaceGid })
  }

  createProject(workspaceGid: string, name: string, teamGid?: string): Promise<{ gid: string, name: string }> {
    return this.request('POST', '/projects', {
      workspace: workspaceGid,
      name,
      ...(teamGid ? { team: teamGid } : {}),
    })
  }

  getProject(gid: string): Promise<{ gid: string, name: string }> {
    return this.request('GET', `/projects/${gid}`)
  }

  createTask(fields: Record<string, unknown>): Promise<{ gid: string, name: string }> {
    return this.request('POST', '/tasks', fields)
  }

  getTask(gid: string): Promise<Record<string, any>> {
    return this.request('GET', `/tasks/${gid}`, undefined, {
      opt_fields: 'name,completed,due_on,notes,assignee.gid',
    })
  }

  async tasksInProject(projectGid: string): Promise<Array<Record<string, any>>> {
    const tasks: Array<Record<string, any>> = []
    let offset: string | undefined
    do {
      const page = await this.requestRaw<Array<Record<string, any>>>('GET', `/projects/${projectGid}/tasks`, undefined, {
        opt_fields: 'name,completed,due_on,notes,assignee.gid',
        limit: '100',
        ...(offset ? { offset } : {}),
      })
      tasks.push(...page.data)
      offset = page.next_page?.offset
    } while (offset)
    return tasks
  }

  stories(taskGid: string): Promise<Array<{ type: string, text: string }>> {
    return this.request('GET', `/tasks/${taskGid}/stories`, undefined, {
      opt_fields: 'type,text',
      limit: '100',
    })
  }

  deleteTask(gid: string): Promise<void> {
    return this.request('DELETE', `/tasks/${gid}`)
  }
}
