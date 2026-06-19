import { afterEach, describe, expect, mock, test } from 'bun:test'

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
