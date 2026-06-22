import * as realAsana from 'asana'
import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import * as realConfig from '../../src/lib/config'

// Bun's `mock.restore()` does NOT revert `mock.module()` registrations, so the
// module mocks below leak into later test files and make the suite order-
// dependent (e.g. a stubbed `loadConfig` breaks asana-client tests on CI where
// the file order differs). Capture the real modules by value at load time and
// re-install them once this file's tests finish.
const REAL_ASANA = { ...realAsana }
const REAL_CONFIG = { ...realConfig }

/**
 * Regression test for the PAT login path.
 *
 * `asana auth login --token <pat>` used to call the v1 helper
 * `asana.Client.create().useAccessToken()`, which no longer exists in
 * asana@3 and threw "undefined is not an object". This verifies the login
 * action validates the token through the v3 SDK and persists a PAT config —
 * without touching disk or the network (everything is mocked).
 */
describe('auth login --token (PAT)', () => {
  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    mock.module('asana', () => REAL_ASANA)
    mock.module('../../src/lib/config', () => REAL_CONFIG)
  })

  test('validates the token via the v3 SDK and saves a PAT config', async () => {
    let tokenSeenByApi: string | undefined
    const tokenAuth: { accessToken?: string } = {}

    // Stub the asana SDK: capture the token the UsersApi call would use.
    mock.module('asana', () => ({
      default: {
        ApiClient: { instance: { authentications: { token: tokenAuth } } },
        UsersApi: class {
          async getUser() {
            tokenSeenByApi = tokenAuth.accessToken
            return { data: { gid: '1', name: 'Test User', email: 'test@example.com' } }
          }
        },
      },
    }))

    // Capture saveConfig instead of writing to ~/.asana-cli.
    let savedConfig: any = null
    mock.module('../../src/lib/config', () => ({
      loadConfig: () => savedConfig,
      saveConfig: (config: any) => {
        savedConfig = config
      },
    }))

    const { createAuthCommand } = await import('../../src/commands/auth')
    const auth = createAuthCommand()

    await auth.parseAsync(['login', '--token', 'pat-secret-123'], { from: 'user' })

    // The token was validated against the API before being persisted...
    expect(tokenSeenByApi).toBe('pat-secret-123')
    // ...and stored as a PAT credential.
    expect(savedConfig).toMatchObject({
      accessToken: 'pat-secret-123',
      authType: 'pat',
    })
  })
})
