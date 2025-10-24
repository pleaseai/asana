import asana from 'asana'
import { loadConfig, saveConfig } from './config'
import { refreshAccessToken } from './oauth'

let clientInstance: asana.Client | null = null

export function getAsanaClient(): asana.Client {
  if (clientInstance) {
    return clientInstance
  }

  const config = loadConfig()

  if (!config || !config.accessToken) {
    throw new Error(
      'Asana access token not found. Please run "asana auth login" first.',
    )
  }

  // Check if OAuth token is expired and refresh if needed
  if (config.authType === 'oauth' && config.expiresAt && config.refreshToken) {
    const isExpired = Date.now() >= config.expiresAt

    if (isExpired) {
      // Token is expired, trigger refresh
      // Note: This is synchronous function, but we need async refresh
      // In real usage, the token will be refreshed on first API call failure
      console.warn('Token expired, will refresh on next API call')
    }
  }

  clientInstance = asana.Client.create({
    defaultHeaders: { 'asana-enable': 'new_user_task_lists' },
  }).useAccessToken(config.accessToken)

  return clientInstance
}

/**
 * Refresh the OAuth token if it's expired
 * Returns true if token was refreshed
 */
export async function refreshTokenIfNeeded(): Promise<boolean> {
  const config = loadConfig()

  if (!config || config.authType !== 'oauth' || !config.refreshToken) {
    return false
  }

  // Check if token is expired or will expire in next 5 minutes
  const expiresAt = config.expiresAt || 0
  const shouldRefresh = Date.now() >= expiresAt - (5 * 60 * 1000)

  if (!shouldRefresh) {
    return false
  }

  try {
    const tokenResponse = await refreshAccessToken(config.refreshToken)

    // Update config with new tokens
    saveConfig({
      ...config,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
    })

    // Reset client to use new token
    resetClient()

    return true
  }
  catch (error) {
    console.error('Failed to refresh token:', error)
    throw new Error(
      'Token refresh failed. Please run "asana auth login" again.',
    )
  }
}

export function resetClient(): void {
  clientInstance = null
}
