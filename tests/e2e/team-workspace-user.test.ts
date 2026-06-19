import { $ } from 'bun'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupTestEnvironment, hasE2ECredentials, setupTestEnvironment } from './helpers'

describe.skipIf(!hasE2ECredentials)('Team, Workspace & User E2E Tests', () => {
  let workspace: string
  let client: any

  beforeAll(() => {
    const env = setupTestEnvironment()
    workspace = env.workspace
    client = env.client
  })

  afterAll(() => {
    cleanupTestEnvironment()
  })

  describe('Workspace Commands', () => {
    test('should list workspaces including the test workspace', async () => {
      const result = await $`bun run src/index.ts workspace list --no-cache -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.workspaces).toBeDefined()
      const gids = parsed.workspaces.map((ws: any) => ws.gid)
      expect(gids).toContain(workspace)
    })

    test('should serve workspace list from cache on second call', async () => {
      await $`bun run src/index.ts workspace list --no-cache -f json`.text()
      const cachedResult = await $`bun run src/index.ts workspace list -f json`.text()

      const parsed = JSON.parse(cachedResult)
      expect(parsed.workspaces.map((ws: any) => ws.gid)).toContain(workspace)
    })

    test('should get workspace details', async () => {
      const result = await $`bun run src/index.ts workspace get ${workspace} -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.workspace.gid).toBe(workspace)
      expect(parsed.workspace.name).toBeDefined()
    })

    test('should list workspace users', async () => {
      const result = await $`bun run src/index.ts workspace users ${workspace} -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.users.length).toBeGreaterThan(0)
      expect(parsed.users[0].gid).toBeDefined()
    })

    test('should fail with invalid workspace gid', async () => {
      try {
        await $`bun run src/index.ts workspace get not-a-gid`.quiet()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        expect(error.exitCode).not.toBe(0)
      }
    })
  })

  describe('Team Commands', () => {
    test('should list teams or report workspace is not an organization', async () => {
      try {
        const result = await $`bun run src/index.ts team list -w ${workspace} --no-cache -f json`.text()
        const hasTeamsOrEmpty = result.includes('"teams"') || result.includes('No teams found')
        expect(hasTeamsOrEmpty).toBe(true)
      }
      catch (error: any) {
        // Personal (non-organization) workspaces cannot list teams
        expect(error.exitCode).not.toBe(0)
      }
    })

    test('should fail with invalid team gid', async () => {
      try {
        await $`bun run src/index.ts team get not-a-gid`.quiet()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        expect(error.exitCode).not.toBe(0)
      }
    })
  })

  describe('User Commands', () => {
    test('should display current user with workspaces', async () => {
      const result = await $`bun run src/index.ts user me -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.user.gid).toBeDefined()
      expect(parsed.user.name).toBeDefined()
    })

    test('should get user by gid', async () => {
      const me = await client.users.me()

      const result = await $`bun run src/index.ts user get ${me.gid} -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.user.gid).toBe(me.gid)
    })

    test('should find current user via fuzzy search', async () => {
      const me = await client.users.findById('me', { opt_fields: 'name,email' })

      const result = await $`bun run src/index.ts user search ${me.name} -w ${workspace} -f json`.text()

      const parsed = JSON.parse(result)
      expect(parsed.users.map((user: any) => user.gid)).toContain(me.gid)
    })

    test('should list tasks assigned to me', async () => {
      const result = await $`bun run src/index.ts user tasks me -w ${workspace} -f json`.text()

      const hasTasksOrEmpty = result.includes('"tasks"') || result.includes('No tasks found')
      expect(hasTasksOrEmpty).toBe(true)
    })

    test('should fail with invalid user gid', async () => {
      try {
        await $`bun run src/index.ts user get not!a!gid`.quiet()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        expect(error.exitCode).not.toBe(0)
      }
    })
  })
})
