/**
 * E2E tests for collaboration features (Phase 4): comments, followers, tags.
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

describe.skipIf(!hasE2ECredentials)('Collaboration E2E Tests', () => {
  let client: any
  let workspace: string
  const createdTaskGids: string[] = []
  const createdTagGids: string[] = []

  beforeAll(() => {
    const env = setupTestEnvironment()
    client = env.client
    workspace = env.workspace
  })

  afterAll(async () => {
    await cleanupTestTasks(client, createdTaskGids)
    for (const tagGid of createdTagGids) {
      try {
        await client.tags.delete(tagGid)
      }
      catch (error) {
        console.warn(`Failed to delete test tag ${tagGid}:`, error)
      }
    }
    cleanupTestEnvironment()
  })

  describe('Comments', () => {
    test('should add a plain text comment and list it back', async () => {
      const task = await createTestTask(client, workspace, `[E2E] Comment ${Date.now()}`)
      createdTaskGids.push(task.gid)

      const commentText = `E2E comment ${Date.now()}`
      const story = await client.stories.createForTask(task.gid, { text: commentText })
      expect(story.gid).toBeDefined()

      const stories = await client.stories.findByTask(task.gid, {
        opt_fields: 'text,resource_subtype',
      })
      const comments = (stories.data || []).filter(
        (item: any) => item.resource_subtype === 'comment_added',
      )
      expect(comments.map((item: any) => item.text)).toContain(commentText)
    })

    test('should add a rich text (HTML) comment', async () => {
      const task = await createTestTask(client, workspace, `[E2E] RichComment ${Date.now()}`)
      createdTaskGids.push(task.gid)

      const story = await client.stories.createForTask(task.gid, {
        html_text: '<body>E2E <strong>bold</strong> comment</body>',
      })
      expect(story.gid).toBeDefined()
      expect(story.text).toContain('bold')
    })
  })

  describe('Followers', () => {
    test('should add, list, and remove a follower', async () => {
      const task = await createTestTask(client, workspace, `[E2E] Follower ${Date.now()}`)
      createdTaskGids.push(task.gid)

      const me = await client.users.me()

      await client.tasks.addFollowers(task.gid, [me.gid])
      const withFollower = await client.tasks.findById(task.gid, {
        opt_fields: 'followers.name',
      })
      expect((withFollower.followers || []).map((u: any) => u.gid)).toContain(me.gid)

      await client.tasks.removeFollowers(task.gid, [me.gid])
      const withoutFollower = await client.tasks.findById(task.gid, {
        opt_fields: 'followers.name',
      })
      expect((withoutFollower.followers || []).map((u: any) => u.gid)).not.toContain(me.gid)
    })
  })

  describe('Tags', () => {
    test('should create, get, update, and delete a tag', async () => {
      const tag = await client.tags.create({
        name: `[E2E] Tag ${Date.now()}`,
        workspace,
        color: 'dark-red',
      })
      createdTagGids.push(tag.gid)

      expect(tag.gid).toBeDefined()

      const fetched = await client.tags.findById(tag.gid, { opt_fields: 'name,color' })
      expect(fetched.color).toBe('dark-red')

      const updated = await client.tags.update(tag.gid, { color: 'light-blue' })
      expect(updated.color).toBe('light-blue')
    })

    test('should assign a tag to multiple tasks and remove it', async () => {
      const tag = await client.tags.create({
        name: `[E2E] MultiTag ${Date.now()}`,
        workspace,
      })
      createdTagGids.push(tag.gid)

      const taskA = await createTestTask(client, workspace, `[E2E] TagA ${Date.now()}`)
      const taskB = await createTestTask(client, workspace, `[E2E] TagB ${Date.now()}`)
      createdTaskGids.push(taskA.gid, taskB.gid)

      await client.tasks.addTag(taskA.gid, tag.gid)
      await client.tasks.addTag(taskB.gid, tag.gid)

      const tagsOnA = await client.tags.findByTask(taskA.gid)
      const tagsOnB = await client.tags.findByTask(taskB.gid)
      expect((tagsOnA.data || []).map((t: any) => t.gid)).toContain(tag.gid)
      expect((tagsOnB.data || []).map((t: any) => t.gid)).toContain(tag.gid)

      await client.tasks.removeTag(taskA.gid, tag.gid)
      const afterRemove = await client.tags.findByTask(taskA.gid)
      expect((afterRemove.data || []).map((t: any) => t.gid)).not.toContain(tag.gid)
    })

    test('should list workspace tags including newly created ones', async () => {
      const tag = await client.tags.create({
        name: `[E2E] ListTag ${Date.now()}`,
        workspace,
      })
      createdTagGids.push(tag.gid)

      const tags = await client.tags.findByWorkspace(workspace, { opt_fields: 'name' })
      expect((tags.data || []).map((t: any) => t.gid)).toContain(tag.gid)
    })
  })
})
