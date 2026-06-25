/**
 * Parse `app.asana.com` URLs into the task/project/comment identifiers they
 * address. Shared by the CLI (`asana fetch`) and the WebFetch-intercept hook so
 * both recognize the exact same URL shapes.
 *
 * URL forms:
 *   V0 (legacy): https://app.asana.com/0/{project_id}/{task_id}
 *   V1 (new):    https://app.asana.com/1/{workspace_id}/project/{project_id}/task/{task_id}
 *                https://app.asana.com/1/{workspace_id}/task/{task_id}
 *                .../task/{task_id}/comment/{comment_id}
 */

const ASANA_HOST = 'app.asana.com'

export interface AsanaUrlMatch {
  type: 'task' | 'project' | 'comment'
  workspaceId?: string
  projectId?: string
  taskId?: string
  commentId?: string
}

/**
 * Match the Asana identifiers in a URL *pathname* (host already verified).
 * Pathname excludes query/fragment, so anchored `^…$` patterns are exact.
 *
 * Task/comment routes are matched by prefix on purpose: Asana appends view/focus
 * segments to real task URLs (e.g. the `/f` focus suffix), and those must still
 * resolve to the task. Project routes stay exact-anchored, and the comment route
 * is ordered before task so it is never shadowed.
 */
function matchAsanaPath(path: string): AsanaUrlMatch | null {
  // V1: Task with comment - /1/{workspace}/[project/{project}/]task/{task}/comment/{comment}
  const v1Comment = /^\/1\/(\d+)\/(?:project\/(\d+)\/)?task\/(\d+)\/comment\/(\d+)/.exec(path)
  if (v1Comment) {
    const [, workspaceId, projectId, taskId, commentId] = v1Comment
    return { type: 'comment', workspaceId, projectId, taskId, commentId }
  }

  // V1: Task in project - /1/{workspace}/project/{project}/task/{task}
  const v1TaskInProject = /^\/1\/(\d+)\/project\/(\d+)\/task\/(\d+)/.exec(path)
  if (v1TaskInProject) {
    const [, workspaceId, projectId, taskId] = v1TaskInProject
    return { type: 'task', workspaceId, projectId, taskId }
  }

  // V1: Task without project - /1/{workspace}/task/{task}
  const v1Task = /^\/1\/(\d+)\/task\/(\d+)/.exec(path)
  if (v1Task) {
    const [, workspaceId, taskId] = v1Task
    return { type: 'task', workspaceId, taskId }
  }

  // V1: Project - /1/{workspace}/project/{project}
  const v1Project = /^\/1\/(\d+)\/project\/(\d+)\/?$/.exec(path)
  if (v1Project) {
    const [, workspaceId, projectId] = v1Project
    return { type: 'project', workspaceId, projectId }
  }

  // V0 (legacy): Task - /0/{project}/{task}
  const v0Task = /^\/0\/(\d+)\/(\d+)/.exec(path)
  if (v0Task) {
    const [, projectId, taskId] = v0Task
    return { type: 'task', projectId, taskId }
  }

  // V0 (legacy): Project - /0/{project}
  const v0Project = /^\/0\/(\d+)\/?$/.exec(path)
  if (v0Project) {
    const [, projectId] = v0Project
    return { type: 'project', projectId }
  }

  return null
}

/**
 * Parse an Asana URL and extract its identifiers, or return null if it is not
 * a recognizable task/project/comment URL.
 *
 * Parses with the `URL` constructor and verifies `hostname === app.asana.com`
 * before matching, so a non-Asana URL that merely *contains* the string
 * `app.asana.com` (e.g. `https://app.asana.com.evil.com/0/1/2` or
 * `https://proxy.example.com/?to=https://app.asana.com/0/1/2`) is not matched.
 * A non-string or malformed URL throws in `new URL()` and is caught as null.
 */
export function parseAsanaUrl(url: string): AsanaUrlMatch | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }

  if (parsed.hostname !== ASANA_HOST) {
    return null
  }

  return matchAsanaPath(parsed.pathname)
}
