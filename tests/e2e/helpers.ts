import type { AsanaConfig } from '../../src/types'
import { getAsanaClient, resetClient } from '../../src/lib/asana-client'
import { saveConfig } from '../../src/lib/config'

export function setupTestEnvironment() {
  const accessToken = process.env.ASANA_ACCESS_TOKEN
  const workspace = process.env.ASANA_WORKSPACE

  if (!accessToken) {
    throw new Error(
      'ASANA_ACCESS_TOKEN is required for E2E tests. Please set it in your .env file.',
    )
  }

  if (!workspace) {
    throw new Error(
      'ASANA_WORKSPACE is required for E2E tests. Please set it in your .env file.',
    )
  }

  // Save test config
  const testConfig: AsanaConfig = {
    accessToken,
    workspace,
    authType: 'pat',
  }

  saveConfig(testConfig)
  resetClient()

  return {
    accessToken,
    workspace,
    client: getAsanaClient(),
  }
}

export function cleanupTestEnvironment() {
  resetClient()
}

export async function createTestTask(client: any, workspace: string, name: string) {
  const task = await client.tasks.create({
    name,
    workspace,
    notes: 'E2E test task - safe to delete',
  })
  return task
}

export async function deleteTestTask(client: any, taskGid: string) {
  try {
    await client.tasks.delete(taskGid)
  }
  catch (error) {
    console.warn(`Failed to delete test task ${taskGid}:`, error)
  }
}

export async function cleanupTestTasks(client: any, taskGids: string[]) {
  for (const gid of taskGids) {
    await deleteTestTask(client, gid)
  }
}
