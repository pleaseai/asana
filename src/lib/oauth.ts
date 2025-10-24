import { createServer } from 'node:http'
import chalk from 'chalk'
import open from 'open'

// OAuth Configuration
// Users need to create an OAuth app at https://app.asana.com/0/my-apps
const OAUTH_CONFIG = {
  authUrl: 'https://app.asana.com/-/oauth_authorize',
  tokenUrl: 'https://app.asana.com/-/oauth_token',
  redirectUri: 'http://localhost:8080/callback',
  scopes: 'default', // or specific scopes like 'tasks:read tasks:write'
}

export interface OAuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

/**
 * Start OAuth flow by opening browser and waiting for callback
 * Requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET environment variables
 */
export async function startOAuthFlow(): Promise<OAuthTokenResponse> {
  const clientId = process.env.ASANA_CLIENT_ID
  const clientSecret = process.env.ASANA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'OAuth requires ASANA_CLIENT_ID and ASANA_CLIENT_SECRET environment variables.\n'
      + 'Create an OAuth app at: https://app.asana.com/0/my-apps\n'
      + 'Then set the environment variables or use PAT authentication instead.',
    )
  }

  // Generate state for security
  const state = Math.random().toString(36).substring(2, 15)

  // Build authorization URL
  const authUrl = new URL(OAUTH_CONFIG.authUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes)

  console.log(chalk.blue('Opening browser for authentication...'))
  console.log(chalk.gray(`If the browser doesn't open, visit: ${authUrl.toString()}`))

  // Create local server to handle callback
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:8080`)

      if (url.pathname === '/callback') {
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
          // Exchange code for token
          const token = await exchangeCodeForToken(code, clientId, clientSecret)

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

    server.listen(8080, () => {
      console.log(chalk.gray('Waiting for authentication...'))
      open(authUrl.toString())
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start local server: ${err.message}`))
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
): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    code,
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
