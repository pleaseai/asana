/**
 * Asana REST API constants.
 */

/**
 * Default base URL for the Asana REST API (v1.0), matching the official `asana`
 * SDK. Overridable via `ASANA_API_BASE_URL` for tests and brokered-egress
 * sandboxes (ADR-005). The trailing slash is intentionally omitted; callers
 * join paths explicitly.
 */
export function getApiBaseUrl(): string {
  return process.env.ASANA_API_BASE_URL || 'https://app.asana.com/api/1.0'
}
