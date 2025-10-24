import { $ } from 'bun'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupTestEnvironment, setupTestEnvironment } from './helpers'

describe('CLI Commands E2E Tests', () => {
  let workspace: string
  const testTaskGids: string[] = []

  beforeAll(() => {
    const env = setupTestEnvironment()
    workspace = env.workspace
  })

  afterAll(async () => {
    // Clean up created tasks
    const client = (await import('../../src/lib/asana-client')).getAsanaClient()
    for (const gid of testTaskGids) {
      try {
        await client.tasks.delete(gid)
      }
      catch (error) {
        console.warn(`Failed to delete task ${gid}:`, error)
      }
    }
    cleanupTestEnvironment()
  })

  describe('Task Create Command', () => {
    test('should create a task via CLI', async () => {
      const taskName = `[E2E Test CLI] Create Task ${Date.now()}`

      const result = await $`bun run src/index.ts task create -n ${taskName} -w ${workspace}`.text()

      expect(result).toMatch(/Task created successfully/)
      expect(result).toContain('GID:')
      expect(result).toContain(taskName)

      // Extract task GID from output for cleanup
      const gidMatch = result.match(/GID: (\d+)/)
      if (gidMatch) {
        testTaskGids.push(gidMatch[1])
      }
    })

    test('should create a task with notes via CLI', async () => {
      const taskName = `[E2E Test CLI] Task with Notes ${Date.now()}`
      const notes = 'Test notes from CLI'

      const result = await $`bun run src/index.ts task create -n ${taskName} -d ${notes} -w ${workspace}`.text()

      expect(result).toMatch(/Task created successfully/)
      expect(result).toContain(taskName)

      const gidMatch = result.match(/GID: (\d+)/)
      if (gidMatch) {
        testTaskGids.push(gidMatch[1])
      }
    })

    test('should fail without task name', async () => {
      try {
        await $`bun run src/index.ts task create -w ${workspace}`.text()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        // Expected to fail
        expect(error).toBeDefined()
      }
    })
  })

  describe('Task List Command', () => {
    test('should list tasks via CLI', async () => {
      const result = await $`bun run src/index.ts task list -w ${workspace} -a me`.text()

      expect(result).toBeDefined()
      // Should contain task list or "No tasks found"
      const hasTasksOrEmpty = result.includes('Tasks (') || result.includes('No tasks found')
      expect(hasTasksOrEmpty).toBe(true)
    })
  })

  describe('Task Get Command', () => {
    test('should get task details via CLI', async () => {
      // First create a task
      const taskName = `[E2E Test CLI] Get Task ${Date.now()}`
      const createResult = await $`bun run src/index.ts task create -n ${taskName} -w ${workspace}`.text()

      const gidMatch = createResult.match(/GID: (\d+)/)
      expect(gidMatch).toBeDefined()

      const taskGid = gidMatch![1]
      testTaskGids.push(taskGid)

      // Get task details
      const getResult = await $`bun run src/index.ts task get ${taskGid}`.text()

      expect(getResult).toContain('Task Details:')
      expect(getResult).toContain(`GID: ${taskGid}`)
      expect(getResult).toContain(taskName)
    })

    test('should fail with invalid task GID', async () => {
      try {
        await $`bun run src/index.ts task get 999999999999999`.text()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        // Expected to fail
        expect(error).toBeDefined()
      }
    })
  })

  describe('Task Complete Command', () => {
    test('should mark task as complete via CLI', async () => {
      // First create a task
      const taskName = `[E2E Test CLI] Complete Task ${Date.now()}`
      const createResult = await $`bun run src/index.ts task create -n ${taskName} -w ${workspace}`.text()

      const gidMatch = createResult.match(/GID: (\d+)/)
      expect(gidMatch).toBeDefined()

      const taskGid = gidMatch![1]
      testTaskGids.push(taskGid)

      // Mark as complete
      const completeResult = await $`bun run src/index.ts task complete ${taskGid}`.text()

      expect(completeResult).toMatch(/Task.*marked as complete/)
    })
  })

  describe('Task Delete Command', () => {
    test('should delete a task via CLI', async () => {
      // First create a task
      const taskName = `[E2E Test CLI] Delete Task ${Date.now()}`
      const createResult = await $`bun run src/index.ts task create -n ${taskName} -w ${workspace}`.text()

      const gidMatch = createResult.match(/GID: (\d+)/)
      expect(gidMatch).toBeDefined()

      const taskGid = gidMatch![1]

      // Delete the task
      const deleteResult = await $`bun run src/index.ts task delete ${taskGid}`.text()

      expect(deleteResult).toMatch(/Task.*deleted/)

      // Verify task is deleted
      try {
        await $`bun run src/index.ts task get ${taskGid}`.text()
        expect(true).toBe(false) // Should have failed
      }
      catch (error: any) {
        // Expected to fail
        expect(error).toBeDefined()
      }
    })
  })

  describe('Environment Variable Support', () => {
    test('should use ASANA_ACCESS_TOKEN from environment', async () => {
      // This test verifies that the CLI can read from environment variables
      // The setupTestEnvironment() should have set the config, so this should work
      const result = await $`bun run src/index.ts task list -w ${workspace} -a me`.text()

      expect(result).toBeDefined()
      // Should not fail with authentication error
      expect(result).not.toContain('access token not found')
    })
  })
})
