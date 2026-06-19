/**
 * E2E tests for subtasks and dependencies (Phase 3).
 *
 * These run against the real Asana API and require ASANA_ACCESS_TOKEN and
 * ASANA_WORKSPACE. Run with `bun run test:e2e:secure`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  cleanupTestEnvironment,
  cleanupTestTasks,
  createTestTask,
  hasE2ECredentials,
  setupTestEnvironment,
} from './helpers'

describe.skipIf(!hasE2ECredentials)('Subtasks & Dependencies E2E Tests', () => {
  let client: any
  let workspace: string
  const createdTaskGids: string[] = []

  beforeAll(() => {
    const env = setupTestEnvironment()
    client = env.client
    workspace = env.workspace
  })

  afterAll(async () => {
    await cleanupTestTasks(client, createdTaskGids)
    cleanupTestEnvironment()
  })

  describe('Subtasks', () => {
    test('should create a subtask under a parent task', async () => {
      const parent = await createTestTask(client, workspace, `[E2E] Parent ${Date.now()}`)
      createdTaskGids.push(parent.gid)

      const subtask = await client.tasks.createSubtask(parent.gid, {
        name: `[E2E] Subtask ${Date.now()}`,
      })
      createdTaskGids.push(subtask.gid)

      expect(subtask.gid).toBeDefined()

      const subtasks = await client.tasks.getSubtasks(parent.gid)
      const gids = (subtasks.data || []).map((item: any) => item.gid)
      expect(gids).toContain(subtask.gid)
    })

    test('should convert an existing task into a subtask', async () => {
      const parent = await createTestTask(client, workspace, `[E2E] Convert Parent ${Date.now()}`)
      const child = await createTestTask(client, workspace, `[E2E] Convert Child ${Date.now()}`)
      createdTaskGids.push(parent.gid, child.gid)

      await client.tasks.setParent(child.gid, parent.gid)

      const subtasks = await client.tasks.getSubtasks(parent.gid)
      const gids = (subtasks.data || []).map((item: any) => item.gid)
      expect(gids).toContain(child.gid)
    })

    test('should support multi-level subtask hierarchies', async () => {
      const grandparent = await createTestTask(client, workspace, `[E2E] L0 ${Date.now()}`)
      createdTaskGids.push(grandparent.gid)

      const parent = await client.tasks.createSubtask(grandparent.gid, { name: '[E2E] L1' })
      createdTaskGids.push(parent.gid)

      const child = await client.tasks.createSubtask(parent.gid, { name: '[E2E] L2' })
      createdTaskGids.push(child.gid)

      const level1 = await client.tasks.getSubtasks(grandparent.gid)
      const level2 = await client.tasks.getSubtasks(parent.gid)

      expect((level1.data || []).map((i: any) => i.gid)).toContain(parent.gid)
      expect((level2.data || []).map((i: any) => i.gid)).toContain(child.gid)
    })
  })

  describe('Dependencies', () => {
    test('should add, list, and remove a dependency', async () => {
      const blocked = await createTestTask(client, workspace, `[E2E] Blocked ${Date.now()}`)
      const blocker = await createTestTask(client, workspace, `[E2E] Blocker ${Date.now()}`)
      createdTaskGids.push(blocked.gid, blocker.gid)

      await client.tasks.addDependencies(blocked.gid, [blocker.gid])

      const dependencies = await client.tasks.getDependencies(blocked.gid)
      expect((dependencies.data || []).map((i: any) => i.gid)).toContain(blocker.gid)

      // The blocker should now report the blocked task as a dependent.
      const dependents = await client.tasks.getDependents(blocker.gid)
      expect((dependents.data || []).map((i: any) => i.gid)).toContain(blocked.gid)

      await client.tasks.removeDependencies(blocked.gid, [blocker.gid])
      const afterRemove = await client.tasks.getDependencies(blocked.gid)
      expect((afterRemove.data || []).map((i: any) => i.gid)).not.toContain(blocker.gid)
    })

    test('should reject a self-dependency cycle gracefully', async () => {
      const task = await createTestTask(client, workspace, `[E2E] SelfDep ${Date.now()}`)
      createdTaskGids.push(task.gid)

      // Asana rejects making a task depend on itself; the API call should fail.
      await expect(client.tasks.addDependencies(task.gid, [task.gid])).rejects.toBeDefined()
    })

    test('should reject a circular dependency gracefully', async () => {
      const a = await createTestTask(client, workspace, `[E2E] CycleA ${Date.now()}`)
      const b = await createTestTask(client, workspace, `[E2E] CycleB ${Date.now()}`)
      createdTaskGids.push(a.gid, b.gid)

      await client.tasks.addDependencies(a.gid, [b.gid])

      // b depending on a would close the cycle; Asana should reject this.
      await expect(client.tasks.addDependencies(b.gid, [a.gid])).rejects.toBeDefined()
    })
  })
})
