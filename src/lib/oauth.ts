import { createServer } from 'node:http'
import { createInterface } from 'node:readline'
import chalk from 'chalk'
import open from 'open'

// OAuth Configuration
// Users need to create an OAuth app at https://app.asana.com/0/my-apps
const OAUTH_CONFIG = {
  authUrl: 'https://app.asana.com/-/oauth_authorize',
  tokenUrl: 'https://app.asana.com/-/oauth_token',
  defaultRedirectPort: 8080,
  redirectPath: '/callback',
  defaultScopes: 'default',
}

const OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'

/**
 * Resolve the loopback redirect port for the browser flow:
 * explicit option → `ASANA_OAUTH_REDIRECT_PORT` env → default 8080. Pure.
 *
 * The resulting redirect URL must be registered on the Asana OAuth app.
 */
export function resolveRedirectPort(port?: number): number {
  if (port !== undefined && Number.isInteger(port) && port > 0 && port <= 65535) {
    return port
  }
  const envPort = Number(process.env.ASANA_OAUTH_REDIRECT_PORT)
  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    return envPort
  }
  return OAUTH_CONFIG.defaultRedirectPort
}

/**
 * Build the loopback redirect URI (e.g. http://localhost:8080/callback). Pure.
 */
export function buildLoopbackRedirectUri(port: number): string {
  return `http://localhost:${port}${OAUTH_CONFIG.redirectPath}`
}

/**
 * Build the Asana authorize URL with PKCE (S256). Pure.
 */
export function buildAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  scope: string
  state: string
  codeChallenge: string
}): string {
  const authUrl = new URL(OAUTH_CONFIG.authUrl)
  authUrl.searchParams.set('client_id', params.clientId)
  authUrl.searchParams.set('redirect_uri', params.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', params.state)
  authUrl.searchParams.set('scope', params.scope)
  authUrl.searchParams.set('code_challenge', params.codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  return authUrl.toString()
}

export interface OAuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface OAuthFlowOptions {
  scopes?: string[]
  oob?: boolean
  /** Local port for the browser-flow redirect (default 8080, or env). */
  redirectPort?: number
}

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate a cryptographically secure random state string for CSRF protection
 */
export function generateSecureState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64urlEncode(bytes)
}

/**
 * Generate PKCE code_verifier and code_challenge (S256 method)
 * RFC 7636: code_verifier is 43-128 URL-safe chars; code_challenge = BASE64URL(SHA256(verifier))
 */
export async function generatePKCE(): Promise<{ codeVerifier: string, codeChallenge: string }> {
  const bytes = new Uint8Array(32) // 32 bytes → 43 base64url chars (no padding)
  crypto.getRandomValues(bytes)
  const codeVerifier = base64urlEncode(bytes)

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const codeChallenge = base64urlEncode(new Uint8Array(digest))

  return { codeVerifier, codeChallenge }
}

/**
 * Start OAuth flow by opening browser and waiting for callback.
 * Uses PKCE (S256) and cryptographically secure state.
 * Requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET environment variables.
 *
 * @param options - Flow options
 */
export async function startOAuthFlow(options: OAuthFlowOptions = {}): Promise<OAuthTokenResponse> {
  const clientId = process.env.ASANA_CLIENT_ID
  const clientSecret = process.env.ASANA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET environment variables.\n'
      + 'Create an OAuth app at: https://app.asana.com/0/my-apps\n'
      + 'Then set the environment variables or use PAT authentication instead.',
    )
  }

  const state = generateSecureState()
  const { codeVerifier, codeChallenge } = await generatePKCE()
  const scopeStr = options.scopes?.join(' ') || OAUTH_CONFIG.defaultScopes
  const port = resolveRedirectPort(options.redirectPort)
  const redirectUri = options.oob ? OOB_REDIRECT_URI : buildLoopbackRedirectUri(port)

  const authUrl = new URL(buildAuthorizeUrl({ clientId, redirectUri, scope: scopeStr, state, codeChallenge }))

  if (options.oob) {
    return startOobFlow(authUrl, codeVerifier, clientId, clientSecret)
  }

  console.log(chalk.blue('Opening browser for authentication...'))
  console.log(chalk.gray(`If the browser doesn't open, visit: ${authUrl.toString()}`))
  console.log(chalk.gray('  If your Asana app is a "command-line app", re-run with --no-browser.'))

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`)

      if (url.pathname === OAUTH_CONFIG.redirectPath) {
        const code = url.searchParams.get('code') || ''
        const returnedState = url.searchParams.get('state') || ''
        const error = url.searchParams.get('error') || ''

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication Failed</h1><p>You can close this window.</p>')
          server.close()
          reject(new Error(`OAuth error: ${error}`))
          return
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Invalid Request</h1><p>You can close this window.</p>')
          server.close()
          reject(new Error('Invalid OAuth callback'))
          return
        }

        try {
          const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri, codeVerifier)

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<h1>Authentication Successful!</h1><p>You can close this window and return to the terminal.</p>')

          server.close()
          resolve(token)
        }
        catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end('<h1>Token Exchange Failed</h1><p>You can close this window.</p>')
          server.close()
          reject(err)
        }
      }
    })

    // Bind to loopback only — the OAuth callback listener must not be
    // reachable beyond localhost.
    server.listen(port, 'localhost', () => {
      console.log(chalk.gray('Waiting for authentication...'))
      // open() rejects if no browser can be launched (e.g. headless host);
      // fall back to printing the URL instead of an unhandled rejection.
      open(authUrl.toString()).catch(() => {
        console.log(chalk.yellow('Could not open a browser automatically. Open this URL to authorize:'))
        console.log(chalk.cyan(authUrl.toString()))
      })
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start local server on port ${port}: ${err.message}. Try a different port with --redirect-port.`))
    })
  })
}

/**
 * OOB (out-of-band) flow: prints auth URL and prompts user to paste the code.
 * Used when --no-browser is specified (headless/CI environments).
 */
async function startOobFlow(
  authUrl: URL,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthTokenResponse> {
  console.log(chalk.blue('\nOpen this URL in your browser to authorize:'))
  console.log(chalk.cyan(authUrl.toString()))
  console.log(chalk.gray('\nAfter authorizing, copy the code shown in the browser.'))

  const code = await promptForCode()

  if (!code) {
    throw new Error('No authorization code provided')
  }

  return exchangeCodeForToken(code, clientId, clientSecret, OOB_REDIRECT_URI, codeVerifier)
}

function promptForCode(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(chalk.yellow('Paste the authorization code: '), (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  })

  if (codeVerifier) {
    params.set('code_verifier', codeVerifier)
  }

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  return response.json()
}

/**
 * Refresh OAuth access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
  const clientId = process.env.ASANA_CLIENT_ID
  const clientSecret = process.env.ASANA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not found in environment variables')
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  })

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token refresh failed: ${errorText}`)
  }

  return response.json()
}
