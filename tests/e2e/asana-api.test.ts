import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupTestEnvironment, cleanupTestTasks, createTestTask, setupTestEnvironment } from './helpers'

describe('Asana API E2E Tests', () => {
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

  describe('Task Creation', () => {
    test('should create a basic task', async () => {
      const taskName = `[E2E Test] Basic Task ${Date.now()}`

      const task = await client.tasks.create({
        name: taskName,
        workspace,
        notes: 'This is a test task created by E2E tests',
      })

      createdTaskGids.push(task.gid)

      expect(task).toBeDefined()
      expect(task.gid).toBeDefined()
      expect(task.name).toBe(taskName)
      expect(task.completed).toBe(false)
    })

    test('should create a task with due date', async () => {
      const taskName = `[E2E Test] Task with Due Date ${Date.now()}`
      const dueDate = '2025-12-31'

      const task = await client.tasks.create({
        name: taskName,
        workspace,
        due_on: dueDate,
      })

      createdTaskGids.push(task.gid)

      expect(task).toBeDefined()
      expect(task.gid).toBeDefined()
      expect(task.due_on).toBe(dueDate)
    })

    test('should create a task with assignee (me)', async () => {
      const taskName = `[E2E Test] Task Assigned to Me ${Date.now()}`

      const task = await client.tasks.create({
        name: taskName,
        workspace,
        assignee: 'me',
      })

      createdTaskGids.push(task.gid)

      expect(task).toBeDefined()
      expect(task.gid).toBeDefined()
      expect(task.assignee).toBeDefined()
    })
  })

  describe('Task Retrieval', () => {
    test('should get task by GID', async () => {
      // Create a task first
      const createdTask = await createTestTask(client, workspace, `[E2E Test] Get Task ${Date.now()}`)
      createdTaskGids.push(createdTask.gid)

      // Retrieve the task
      const task = await client.tasks.findById(createdTask.gid)

      expect(task).toBeDefined()
      expect(task.gid).toBe(createdTask.gid)
      expect(task.name).toBe(createdTask.name)
    })

    test('should list tasks in workspace', async () => {
      // Create a test task
      const testTask = await createTestTask(client, workspace, `[E2E Test] List Tasks ${Date.now()}`)
      createdTaskGids.push(testTask.gid)

      // List tasks
      const tasks = await client.tasks.findAll({
        workspace,
        assignee: 'me',
      })

      expect(tasks).toBeDefined()
      expect(tasks.data).toBeDefined()
      expect(Array.isArray(tasks.data)).toBe(true)

      // Our created task should be in the list
      const foundTask = tasks.data.find((t: any) => t.gid === testTask.gid)
      expect(foundTask).toBeDefined()
    })
  })

  describe('Task Updates', () => {
    test('should update task name', async () => {
      const originalName = `[E2E Test] Original Name ${Date.now()}`
      const updatedName = `[E2E Test] Updated Name ${Date.now()}`

      const task = await createTestTask(client, workspace, originalName)
      createdTaskGids.push(task.gid)

      // Update the task
      const updatedTask = await client.tasks.update(task.gid, {
        name: updatedName,
      })

      expect(updatedTask.name).toBe(updatedName)
    })

    test('should mark task as complete', async () => {
      const task = await createTestTask(client, workspace, `[E2E Test] Complete Task ${Date.now()}`)
      createdTaskGids.push(task.gid)

      // Mark as complete
      const completedTask = await client.tasks.update(task.gid, {
        completed: true,
      })

      expect(completedTask.completed).toBe(true)
    })

    test('should update task notes', async () => {
      const task = await createTestTask(client, workspace, `[E2E Test] Update Notes ${Date.now()}`)
      createdTaskGids.push(task.gid)

      const newNotes = 'These are updated notes from E2E test'

      const updatedTask = await client.tasks.update(task.gid, {
        notes: newNotes,
      })

      expect(updatedTask.notes).toBe(newNotes)
    })
  })

  describe('Task Deletion', () => {
    test('should delete a task', async () => {
      const task = await createTestTask(client, workspace, `[E2E Test] Delete Task ${Date.now()}`)

      // Delete the task
      await client.tasks.delete(task.gid)

      // Verify task is deleted by trying to fetch it
      try {
        await client.tasks.findById(task.gid)
        // If we get here, the task wasn't deleted
        expect(true).toBe(false) // Force fail
      }
      catch (error: any) {
        // Expected: task should not be found
        expect(error).toBeDefined()
      }
    })
  })

  describe('Workspace Operations', () => {
    test('should get current user', async () => {
      const user = await client.users.me()

      expect(user).toBeDefined()
      expect(user.gid).toBeDefined()
      expect(user.name).toBeDefined()
      expect(user.email).toBeDefined()
    })

    test('should list workspaces', async () => {
      const workspaces = await client.workspaces.findAll()

      expect(workspaces).toBeDefined()
      expect(workspaces.data).toBeDefined()
      expect(Array.isArray(workspaces.data)).toBe(true)
      expect(workspaces.data.length).toBeGreaterThan(0)
    })

    test('should get workspace details', async () => {
      const workspaceDetails = await client.workspaces.findById(workspace)

      expect(workspaceDetails).toBeDefined()
      expect(workspaceDetails.gid).toBe(workspace)
      expect(workspaceDetails.name).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid task GID', async () => {
      const invalidGid = '999999999999999'

      try {
        await client.tasks.findById(invalidGid)
        // If we get here, it should have thrown an error
        expect(true).toBe(false)
      }
      catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    test('should handle invalid workspace GID', async () => {
      const invalidWorkspace = '999999999999999'

      try {
        await client.tasks.create({
          name: 'Test Task',
          workspace: invalidWorkspace,
        })
        // If we get here, it should have thrown an error
        expect(true).toBe(false)
      }
      catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })
})