import { encodeToon } from '@pleaseai/cli-toolkit/output'
import { beforeEach, describe, expect, test } from 'bun:test'
import { ERROR_IDS } from '../../src/constants/errorIds'
import { useTaskCliHarness } from './helpers/task-cli-harness'

const EXIT_FAILURE = 1
const EXIT_USAGE = 2
const STORY_GID = '555'
const STORY = {
  gid: STORY_GID,
  text: 'Looks good',
  created_at: '2026-10-01T00:00:00.000Z',
  created_by: { name: 'Ada' },
  resource_subtype: 'comment_added',
}
const COMMENT_VIEW = {
  gid: STORY_GID,
  created_at: '2026-10-01T00:00:00.000Z',
  created_by: 'Ada',
  text: 'Looks good',
}
const NOT_FOUND = { status: 404 }

interface StoryCall { method: string, args: any[] }

/** `task comment get|update|delete <story-gid>` (issue #108). */
describe('task comment get/update/delete', () => {
  let calls: StoryCall[]
  const harness = useTaskCliHarness()

  beforeEach(() => {
    calls = []
  })

  /** Run `task comment <args>`; `failWith` makes every story call throw it. */
  async function runComment(args: string[], opts: { failWith?: any, format?: string } = {}): Promise<string> {
    const record = (method: string, result: any) => async (...callArgs: any[]) => {
      calls.push({ method, args: callArgs })
      if (opts.failWith) {
        throw opts.failWith
      }
      return result
    }
    harness.mockModules(
      {
        getAsanaClient: () => ({
          stories: {
            findById: record('findById', STORY),
            update: record('update', { ...STORY, text: 'Edited' }),
            delete: record('delete', {}),
          },
        }),
      },
      { loadConfig: () => ({ workspace: '123' }) },
    )

    return harness.runTask(['comment', ...args], opts.format)
  }

  describe('get', () => {
    test('fetches the story with comment fields and emits the comment view', async () => {
      const out = await runComment(['get', STORY_GID])

      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe('findById')
      expect(calls[0]?.args[0]).toBe(STORY_GID)
      expect(calls[0]?.args[1]?.opt_fields).toContain('created_by.name')
      expect(JSON.parse(out)).toEqual({ comment: COMMENT_VIEW })
    })

    test('emits TOON identical to the encoded payload', async () => {
      const out = await runComment(['get', STORY_GID], { format: 'toon' })

      expect(out).toBe(encodeToon({ comment: COMMENT_VIEW }))
    })

    test('an invalid story GID fails before any API call', async () => {
      await expect(runComment(['get', 'abc'])).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(harness.stdoutError().code).toBe(ERROR_IDS.INVALID_TASK_GID)
      expect(calls).toHaveLength(0)
    })

    test('a missing story is a structured not-found error', async () => {
      await expect(runComment(['get', STORY_GID], { failWith: NOT_FOUND })).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(harness.stdoutError().error).toBe('Resource not found')
    })
  })

  describe('update', () => {
    test('sends the new text and emits the updated comment', async () => {
      const out = await runComment(['update', STORY_GID, '--text', 'Edited'])

      expect(calls).toEqual([{ method: 'update', args: [STORY_GID, { text: 'Edited' }] }])
      expect(JSON.parse(out)).toEqual({ comment: { status: 'success', gid: STORY_GID, text: 'Edited' } })
    })

    test('plain output confirms the update', async () => {
      const out = await runComment(['update', STORY_GID, '--text', 'Edited'], { format: 'plain' })

      expect(out).toContain(`Comment ${STORY_GID} updated`)
    })

    test.each([
      ['a missing --text', []],
      ['an empty --text', ['--text', '']],
      ['a whitespace-only --text', ['--text', '   ']],
    ])('%s is a usage error before any API call', async (_label, textArgs) => {
      await expect(runComment(['update', STORY_GID, ...textArgs])).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_USAGE)
      const payload = harness.stdoutError()
      expect(payload.code).toBe(ERROR_IDS.MISSING_REQUIRED_OPTION)
      expect(payload.context.option).toBe('--text')
      expect(calls).toHaveLength(0)
    })

    test('an invalid story GID fails before any API call', async () => {
      await expect(runComment(['update', 'abc', '--text', 'Edited'])).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(calls).toHaveLength(0)
    })

    test('a missing story is a structured not-found error', async () => {
      await expect(runComment(['update', STORY_GID, '--text', 'Edited'], { failWith: NOT_FOUND }))
        .rejects
        .toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(harness.stdoutError().error).toBe('Resource not found')
    })
  })

  describe('delete', () => {
    test('deletes the story and reports success', async () => {
      const out = await runComment(['delete', STORY_GID])

      expect(calls).toEqual([{ method: 'delete', args: [STORY_GID] }])
      expect(JSON.parse(out)).toEqual({ comment: { status: 'success', gid: STORY_GID, deleted: true } })
    })

    test('an already-deleted story is a no-op success (exit 0)', async () => {
      const out = await runComment(['delete', STORY_GID], { failWith: NOT_FOUND })

      expect(harness.exitSpy).not.toHaveBeenCalled()
      expect(JSON.parse(out)).toEqual({ comment: { status: 'already_deleted', gid: STORY_GID } })
    })

    test('plain output names the no-op', async () => {
      const out = await runComment(['delete', STORY_GID], { failWith: NOT_FOUND, format: 'plain' })

      expect(out).toContain(`Comment ${STORY_GID} already deleted (no-op)`)
    })

    test('other API errors still fail', async () => {
      await expect(runComment(['delete', STORY_GID], { failWith: { status: 403 } })).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(harness.stdoutError().code).toBe(ERROR_IDS.PERMISSION_DENIED)
    })

    test('an invalid story GID fails before any API call', async () => {
      await expect(runComment(['delete', 'abc'])).rejects.toThrow('__exit__')

      expect(harness.exitSpy).toHaveBeenCalledWith(EXIT_FAILURE)
      expect(calls).toHaveLength(0)
    })
  })
})
