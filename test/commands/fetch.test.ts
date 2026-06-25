import { describe, expect, test } from 'bun:test'

import { createFetchCommand, resolveFetchTarget } from '../../src/commands/fetch'

describe('resolveFetchTarget', () => {
  test('routes a V1 task URL to a task fetch', () => {
    expect(resolveFetchTarget('https://app.asana.com/1/15793206719/task/12058909747493732')).toEqual({
      kind: 'task',
      gid: '12058909747493732',
    })
  })

  test('routes a V1 task-in-project URL to a task fetch (the task, not the project)', () => {
    expect(resolveFetchTarget('https://app.asana.com/1/15793206719/project/1206043162733419/task/12058909747493732')).toEqual({
      kind: 'task',
      gid: '12058909747493732',
    })
  })

  test('routes a project URL to a project fetch', () => {
    expect(resolveFetchTarget('https://app.asana.com/1/15793206719/project/1206043162733419')).toEqual({
      kind: 'project',
      gid: '1206043162733419',
    })
  })

  test('routes a comment URL to the task comment list (no single-comment fetch exists)', () => {
    expect(resolveFetchTarget('https://app.asana.com/1/15793206719/task/12058909747493732/comment/9876543210')).toEqual({
      kind: 'commentsForTask',
      gid: '12058909747493732',
    })
  })

  test('routes a legacy V0 task URL to a task fetch', () => {
    expect(resolveFetchTarget('https://app.asana.com/0/1206043162733419/12058909747493732')).toEqual({
      kind: 'task',
      gid: '12058909747493732',
    })
  })

  test('returns null for a non-Asana URL', () => {
    expect(resolveFetchTarget('https://github.com/owner/repo')).toBeNull()
  })

  test('returns null for a host-spoofing URL', () => {
    expect(resolveFetchTarget('https://app.asana.com.evil.com/0/123/456')).toBeNull()
  })

  test('returns null for the Asana home URL', () => {
    expect(resolveFetchTarget('https://app.asana.com/')).toBeNull()
  })
})

describe('fetch command structure', () => {
  test('creates a command named fetch', () => {
    expect(createFetchCommand().name()).toBe('fetch')
  })

  test('has a description mentioning the Asana URL', () => {
    expect(createFetchCommand().description().toLowerCase()).toContain('url')
  })

  test('takes a required <url> argument', () => {
    const args = createFetchCommand().registeredArguments
    expect(args).toHaveLength(1)
    expect(args[0]?.name()).toBe('url')
    expect(args[0]?.required).toBe(true)
  })
})
