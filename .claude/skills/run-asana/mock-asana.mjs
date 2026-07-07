#!/usr/bin/env bun
/**
 * Stateful in-memory mock of the Asana REST API (v1.0), just enough to drive
 * the asana CLI end-to-end in a headless container with no real credentials.
 *
 * It is deliberately small: a task store that supports create/list/get/update/
 * delete, plus canned responses for the workspace/user/project endpoints the
 * documented commands touch. Everything else returns `{ data: [] }` so a command
 * never crashes on an unmocked endpoint.
 *
 * Run standalone to drive the CLI by hand:
 *   bun .claude/skills/run-asana/mock-asana.mjs            # prints its base URL
 * then in another shell point the launcher at it:
 *   ASANA_API_BASE_URL=<url> ASANA_ACCESS_TOKEN=fake \
 *     bun .claude/skills/run-asana/launch.ts -f json workspace list
 *
 * Or import { startMock } from a driver (see smoke.mjs).
 */

const json = (data, status = 200) => Response.json(data, { status })

export function startMock() {
  const tasks = new Map()
  const projects = new Map([
    ['555', { gid: '555', name: 'Demo Project', resource_type: 'project' }],
  ])
  let seq = 1000

  // Each handler owns one resource group and returns a Response for a path it
  // recognizes, or null to let the next handler try. Keeps every function and
  // the fetch dispatcher well under the 50-LOC limit.
  function handleTasks(path, method, url, body) {
    if (path === '/tasks' && method === 'POST') {
      const gid = String(++seq)
      const task = { gid, completed: false, resource_type: 'task', ...body?.data }
      tasks.set(gid, task)
      return json({ data: task })
    }
    if (path === '/tasks' && method === 'GET') {
      // Real Asana scopes a task list by workspace+assignee or by project.
      // Reject a scopeless list so a CLI bug that drops the filter surfaces
      // here instead of silently passing against the full store.
      if (!url.searchParams.has('workspace') && !url.searchParams.has('project')) {
        return json({ errors: [{ message: 'Missing required parameter: workspace or project' }] }, 400)
      }
      return json({ data: [...tasks.values()] })
    }
    // Asana GIDs are opaque strings — numeric in prod, but hyphenated in mock
    // setups (e.g. `task-1`), so match [\w-]+.
    const match = path.match(/^\/tasks\/([\w-]+)$/)
    if (!match) return null
    const gid = match[1]
    if (method === 'GET') {
      return json({ data: tasks.get(gid) ?? { gid, name: `Task ${gid}`, completed: false, resource_type: 'task' } })
    }
    if (method === 'PUT') {
      const updated = { ...(tasks.get(gid) ?? { gid }), ...body?.data }
      tasks.set(gid, updated)
      return json({ data: updated })
    }
    if (method === 'DELETE') {
      tasks.delete(gid)
      return json({ data: {} })
    }
    return null
  }

  function handleUsers(path) {
    if (path === '/users/me') {
      return json({ data: { gid: '999', name: 'Mock User', email: 'mock@example.com', resource_type: 'user' } })
    }
    const match = path.match(/^\/users\/([\w-]+)$/)
    if (match) {
      return json({ data: { gid: match[1], name: 'Mock User', resource_type: 'user' } })
    }
    return null
  }

  function handleWorkspaces(path) {
    if (path === '/workspaces') {
      return json({ data: [{ gid: '111', name: 'My Workspace', resource_type: 'workspace' }] })
    }
    if (/^\/workspaces\/[\w-]+$/.test(path)) {
      return json({ data: { gid: '111', name: 'My Workspace', resource_type: 'workspace' } })
    }
    return null
  }

  function handleProjects(path, method) {
    // Only the real project-list paths: top-level, or workspace/team-scoped.
    // A broad endsWith('/projects') would also swallow /tasks/{gid}/projects.
    if (method === 'GET' && (path === '/projects' || /^\/(workspaces|teams)\/[\w-]+\/projects$/.test(path))) {
      return json({ data: [...projects.values()] })
    }
    // Single-project fetch (`project get <gid>`), mirroring the task/user path.
    const match = path.match(/^\/projects\/([\w-]+)$/)
    if (match && method === 'GET') {
      const gid = match[1]
      return json({ data: projects.get(gid) ?? { gid, name: `Project ${gid}`, resource_type: 'project' } })
    }
    return null
  }

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname.replace(/^.*\/api\/1\.0/, '') // strip base prefix
      const method = req.method
      // Only body-bearing methods carry JSON; parsing a bodyless GET/DELETE
      // would throw needlessly.
      let body = null
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        try { body = await req.json() } catch { /* malformed body — leave null */ }
      }

      // Fall through the handlers in order; the last arm never crashes the CLI
      // on an unmocked read.
      return handleTasks(path, method, url, body)
        ?? handleUsers(path)
        ?? handleWorkspaces(path)
        ?? handleProjects(path, method)
        ?? json({ data: [] })
    },
  })

  const url = `http://localhost:${server.port}/api/1.0`
  return { url, port: server.port, stop: () => server.stop(true) }
}

if (import.meta.main) {
  const mock = startMock()
  process.stdout.write(`${mock.url}\n`)
  process.stderr.write(`[mock-asana] listening on ${mock.url} — Ctrl-C to stop\n`)
  // Bun.serve keeps the event loop alive, so the process stays up until Ctrl-C.
}
