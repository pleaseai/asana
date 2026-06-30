import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { createFeedbackCommand } from '../../src/commands/feedback'
import * as axiOutput from '../../src/lib/axi-output'
import * as github from '../../src/lib/github'

const ORIGINAL_GITHUB_TOKEN = process.env.GITHUB_TOKEN
const ORIGINAL_GH_TOKEN = process.env.GH_TOKEN
const ORIGINAL_FETCH = global.fetch

let openSpy: ReturnType<typeof spyOn>
let emitErrorSpy: ReturnType<typeof spyOn>

async function runFeedback(args: string[]): Promise<void> {
  const feedback = createFeedbackCommand()
  await feedback.parseAsync(args, { from: 'user' })
}

describe('feedback command', () => {
  beforeEach(() => {
    // Stub the browser side effect so tests never launch a real browser.
    openSpy = spyOn(github, 'openIssueUrl').mockResolvedValue(undefined)
    // emitError writes structured output straight to fd 1 (stdout) for toon/json,
    // which bypasses console spies; stub it so error-path tests don't leak to CI.
    emitErrorSpy = spyOn(axiOutput, 'emitError').mockImplementation(() => {})
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
  })

  afterEach(() => {
    openSpy.mockRestore()
    emitErrorSpy.mockRestore()
    global.fetch = ORIGINAL_FETCH
    restoreEnv('GITHUB_TOKEN', ORIGINAL_GITHUB_TOKEN)
    restoreEnv('GH_TOKEN', ORIGINAL_GH_TOKEN)
  })

  describe('command structure', () => {
    test('has correct name and description', () => {
      const feedback = createFeedbackCommand()
      expect(feedback.name()).toBe('feedback')
      expect(feedback.description()).toBe('Submit a bug, feature request, or suggestion as a GitHub issue')
    })

    test('requires --title and exposes the expected options', () => {
      const feedback = createFeedbackCommand()
      const titleOption = feedback.options.find(opt => opt.long === '--title')
      expect(titleOption?.mandatory).toBe(true)
      expect(feedback.options.find(opt => opt.long === '--type')).toBeDefined()
      expect(feedback.options.find(opt => opt.long === '--body')).toBeDefined()
      expect(feedback.options.find(opt => opt.long === '--repo')).toBeDefined()
      expect(feedback.options.find(opt => opt.long === '--no-browser')).toBeDefined()
    })
  })

  describe('submission behavior', () => {
    test('rejects an invalid --type and exits without submitting', async () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
      const logSpy = spyOn(console, 'log').mockImplementation(() => {})

      try {
        await expect(
          runFeedback(['--type', 'nonsense', '--title', 'x']),
        ).rejects.toThrow('process.exit called')
        expect(exitSpy).toHaveBeenCalledWith(1)
        expect(openSpy).not.toHaveBeenCalled()
      }
      finally {
        exitSpy.mockRestore()
        errorSpy.mockRestore()
        logSpy.mockRestore()
      }
    })

    test('rejects an invalid --repo and exits without submitting', async () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {})

      try {
        await expect(
          runFeedback(['--type', 'bug', '--title', 'x', '--repo', 'not-a-valid-repo']),
        ).rejects.toThrow('process.exit called')
        expect(exitSpy).toHaveBeenCalledWith(1)
        expect(openSpy).not.toHaveBeenCalled()
      }
      finally {
        exitSpy.mockRestore()
        errorSpy.mockRestore()
      }
    })

    test('creates an issue via the API when a token is set', async () => {
      process.env.GITHUB_TOKEN = 'secret'
      const fetchCalls: Array<{ url: string, init: RequestInit }> = []
      global.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), init: init ?? {} })
        return new Response(JSON.stringify({ number: 7, html_url: 'https://github.com/pleaseai/asana/issues/7' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch
      const logSpy = spyOn(console, 'log').mockImplementation(() => {})

      try {
        await runFeedback(['--type', 'bug', '--title', 'Crash', '--body', 'details'])

        expect(fetchCalls).toHaveLength(1)
        expect(fetchCalls[0]!.url).toBe('https://api.github.com/repos/pleaseai/asana/issues')
        expect(openSpy).not.toHaveBeenCalled()
        const output = logSpy.mock.calls.map(args => String(args[0])).join('\n')
        expect(output).toContain('https://github.com/pleaseai/asana/issues/7')
      }
      finally {
        logSpy.mockRestore()
      }
    })

    test('opens the browser with a prefilled URL when no token is set', async () => {
      const logSpy = spyOn(console, 'log').mockImplementation(() => {})

      try {
        await runFeedback(['--type', 'feature', '--title', 'Add dark mode'])

        expect(openSpy).toHaveBeenCalledTimes(1)
        const openedUrl = openSpy.mock.calls[0]![0] as string
        expect(openedUrl.startsWith('https://github.com/pleaseai/asana/issues/new?')).toBe(true)
        expect(new URL(openedUrl).searchParams.get('title')).toBe('Add dark mode')
      }
      finally {
        logSpy.mockRestore()
      }
    })

    test('exits with an error when no token is set and --no-browser is passed', async () => {
      const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called')
      }) as never)
      const logSpy = spyOn(console, 'log').mockImplementation(() => {})

      try {
        await expect(
          runFeedback(['--type', 'bug', '--title', 'x', '--no-browser']),
        ).rejects.toThrow('process.exit called')
        expect(exitSpy).toHaveBeenCalledWith(1)
        expect(openSpy).not.toHaveBeenCalled()
      }
      finally {
        exitSpy.mockRestore()
        logSpy.mockRestore()
      }
    })
  })
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  }
  else {
    process.env[key] = value
  }
}
