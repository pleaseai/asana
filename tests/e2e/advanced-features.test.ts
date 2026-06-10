/**
 * E2E tests for advanced features (Phase 6): attachments, custom fields,
 * batch operations, and search.
 *
 * These run against the real Asana API and require ASANA_ACCESS_TOKEN and
 * ASANA_WORKSPACE. Run with `bun run test:e2e:secure`.
 *
 * Note: task search requires a premium Asana workspace; those tests tolerate
 * a 402 Payment Required response so the suite passes on free workspaces.
 */

import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  cleanupTestEnvironment,
  cleanupTestTasks,
  createTestTask,
  setupTestEnvironment,
} from './helpers'

describe('Advanced Features E2E Tests', () => {
  let client: any
  let workspace: string
  const createdTaskGids: string[] = []
  const tempFiles: string[] = []

  beforeAll(() => {
    const env = setupTestEnvironment()
    client = env.client
    workspace = env.workspace
  })

  afterAll(async () => {
    await cleanupTestTasks(client, createdTaskGids)
    for (const file of tempFiles) {
      try {
        unlinkSync(file)
      }
      catch {}
    }
    cleanupTestEnvironment()
  })

  describe('Attachments', () => {
    test('should upload, list, and download an attachment', async () => {
      const task = await createTestTask(client, workspace, `[E2E] Attachment ${Date.now()}`)
      createdTaskGids.push(task.gid)

      // Upload
      const uploadPath = join(tmpdir(), `asana-e2e-${Date.now()}.txt`)
      writeFileSync(uploadPath, 'E2E attachment content')
      tempFiles.push(uploadPath)

      const { createReadStream } = await import('node:fs')
      const attachment = await client.attachments.createForObject({
        parent: task.gid,
        file: createReadStream(uploadPath),
      })
      expect(attachment.gid).toBeDefined()

      // List
      const listResponse = await client.attachments.findByParent(task.gid, {
        opt_fields: 'name,download_url',
      })
      const uploaded = (listResponse.data || []).find((item: any) => item.gid === attachment.gid)
      expect(uploaded).toBeDefined()

      // Download
      const detail = await client.attachments.findById(attachment.gid, {
        opt_fields: 'name,download_url',
      })
      expect(detail.download_url).toBeDefined()

      const response = await fetch(detail.download_url)
      expect(response.ok).toBe(true)
      const content = await response.text()
      expect(content).toBe('E2E attachment content')
    }, 30000)
  })

  describe('Custom Fields', () => {
    test('should list custom fields for the workspace', async () => {
      const response = await client.customFields.findByWorkspace(workspace, {
        opt_fields: 'name,resource_subtype',
      })

      // Workspace may have no custom fields (free tier); just verify shape
      expect(Array.isArray(response.data)).toBe(true)
    }, 15000)

    test('should read custom field values on a task', async () => {
      const task = await createTestTask(client, workspace, `[E2E] CustomField ${Date.now()}`)
      createdTaskGids.push(task.gid)

      const detail = await client.tasks.findById(task.gid, {
        opt_fields: 'custom_fields.name,custom_fields.display_value',
      })
      expect(Array.isArray(detail.custom_fields ?? [])).toBe(true)
    }, 15000)
  })

  describe('Batch Operations', () => {
    test('should create, update, and delete tasks in bulk', async () => {
      const { runBatch } = await import('../../src/lib/batch')
      const names = [1, 2, 3].map(i => `[E2E] Batch ${Date.now()}-${i}`)

      // Batch create
      const createResult = await runBatch(
        names,
        name => client.tasks.create({ name, workspace, notes: 'E2E test task - safe to delete' }),
        { describe: name => name, onProgress: () => {} },
      )
      expect(createResult.succeeded).toBe(3)
      const gids = (createResult.results as any[]).map(task => task.gid)
      createdTaskGids.push(...gids)

      // Batch update
      const updateResult = await runBatch(
        gids,
        gid => client.tasks.update(gid, { completed: true }),
        { describe: gid => gid, onProgress: () => {} },
      )
      expect(updateResult.succeeded).toBe(3)

      // Batch delete
      const deleteResult = await runBatch(
        gids,
        gid => client.tasks.delete(gid),
        { describe: gid => gid, onProgress: () => {} },
      )
      expect(deleteResult.succeeded).toBe(3)
    }, 60000)

    test('should report partial failures without aborting', async () => {
      const { runBatch } = await import('../../src/lib/batch')

      const result = await runBatch(
        ['1'], // not a real task GID
        gid => client.tasks.delete(gid),
        { describe: gid => gid, onProgress: () => {} },
      )
      expect(result.failed).toBe(1)
      expect(result.failures[0].item).toBe('1')
    }, 15000)
  })

  describe('Search', () => {
    test('should search projects via typeahead', async () => {
      const response = await client.typeahead.search(workspace, 'project', 'a', { count: 5 })

      expect(Array.isArray(response.data)).toBe(true)
    }, 15000)

    test('should search tasks (or report premium requirement)', async () => {
      try {
        const response = await client.tasks.search(workspace, { text: 'test', limit: 5 })
        expect(Array.isArray(response.data)).toBe(true)
      }
      catch (error: any) {
        // 402 Payment Required on non-premium workspaces is expected
        expect(error.status).toBe(402)
      }
    }, 15000)
  })
})
