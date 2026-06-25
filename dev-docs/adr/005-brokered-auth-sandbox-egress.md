# ADR-005: Brokered Authentication for Sandbox Egress

## Status

Proposed

## Date

2026-06-25

## Context

Agent sandboxes increasingly run CLIs under an **egress credential-brokering**
model so that an untrusted workload can authenticate to an external service
*without ever holding the secret*. Two representative implementations:

- **Vercel Sandbox — credentials brokering**
  ([docs](https://vercel.com/docs/sandbox/concepts/firewall#credentials-brokering)):
  the firewall matches egress by SNI, **terminates TLS** with a per-sandbox CA
  (auto-trusted via standard env vars), and injects credentials into matching
  requests. The secret never enters the sandbox scope.
- **Cloudflare Sandbox — outbound handlers**
  ([docs](https://developers.cloudflare.com/sandbox/guides/outbound-traffic/)):
  a TPROXY sidecar transparently routes egress to an outbound handler running
  *outside* the sandbox, which does `headers.set(...)` to attach the credential
  before forwarding upstream. An ephemeral CA is auto-trusted.

Despite different surface APIs, both are the **same pattern**: transparent
network interception + TLS termination with an auto-trusted CA; the workload
sends an *unauthenticated (or placeholder)* request to the **real upstream host**,
and a broker living outside the sandbox injects the `Authorization` header. This
is **not** an `HTTP_PROXY` forward-proxy model.

### Relevant facts about the current CLI

- `initializeApiClient()` (`src/lib/asana-client.ts:18-45`) **throws** when
  `config.accessToken` is missing, and **always** sets
  `token.accessToken = config.accessToken`, emitting `Authorization: Bearer <token>`.
- It reads `loadConfig()` directly and **ignores** `ASANA_ACCESS_TOKEN`. The
  env fallback in `getAccessToken()` (`src/lib/config.ts:35-38`,
  `config?.accessToken || process.env.ASANA_ACCESS_TOKEN`) is **dead code** on the
  client-init path.
- The Asana SDK targets `https://app.asana.com/api/1.0` by default
  (`node_modules/asana/src/ApiClient.js:36`), so brokers can already match by
  host/SNI with no base-URL change.
- OAuth refresh (`refreshTokenIfNeeded`, `src/lib/asana-client.ts:391-428`) only
  runs for `authType === 'oauth'` **and** a present `refreshToken`; a PAT-style or
  env placeholder token naturally skips refresh.
- The SDK's HTTP layer is **superagent**, which does **not** honor
  `HTTP_PROXY`/`HTTPS_PROXY` env vars — relevant only to a forward-proxy model,
  which neither target system uses.

The CLI is one small change away from being "broker-ready"; the gap is the hard
requirement that a *real* token be present in local config.

## Decision

Make the CLI usable under brokered egress by **allowing it to run with a
placeholder token sourced from the environment**, and document the broker
contract. Concretely:

### D1 — Source the access token through `getAccessToken()` (env fallback)

`initializeApiClient()` resolves the token via `getAccessToken()` instead of
reading `config.accessToken` directly. This activates the existing
`ASANA_ACCESS_TOKEN` fallback so a sandbox can run:

```sh
ASANA_ACCESS_TOKEN=brokered asana task list -w <gid>
```

with **no `~/.asana-cli/config.json`**. The CLI emits `Authorization: Bearer brokered`,
and the broker rule **overwrites** that header with the real secret.

We send a placeholder Bearer rather than *no* header because Asana accepts only
Bearer auth, and header **replacement** is the natural primitive in both targets
(Cloudflare `headers.set`, Vercel header transform). A request with a present
header is also unambiguous to match on.

### D2 — Keep the real upstream host; no base-URL change required

The CLI continues to target `app.asana.com`. Brokers match by host/SNI. We do
**not** introduce client-side proxy configuration for the brokered path.

### D3 — Brokered mode skips token refresh by construction

No new "mode" flag. An env/PAT placeholder has no `refreshToken` and is not
`authType === 'oauth'`, so `refreshTokenIfNeeded()` already returns `false`. The
broker owns credential lifecycle; the CLI must never attempt to refresh a token
it does not hold.

### D4 — CA trust is the operator's responsibility, not the CLI's

The CLI must **not** bundle a private CA or disable certificate validation. It
relies on the sandbox auto-trusting its CA via standard env vars
(`NODE_EXTRA_CA_CERTS` / `SSL_CERT_FILE`), which Bun honors and superagent
inherits through `node:https`. This keeps TLS verification intact.

### Out of scope (deferred)

- An explicit `ASANA_BASE_URL` override (SDK supports `apiClient.basePath`) for
  Vercel *requests-proxying* / self-hosted / test brokers.
- Forward-proxy (`HTTPS_PROXY`) support, which would require injecting a proxy
  agent into the SDK's `requestAgent`/`agent` override
  (`node_modules/asana/src/ApiClient.js:438`).
- An explicit `ASANA_AUTH_MODE=brokered` flag.

These are additive and can land in a follow-up ADR if a forward-proxy or
non-default-host deployment appears.

## Consequences

### Positive

- The CLI runs under Vercel/Cloudflare credential brokering with a one-line
  change; the real token never enters the sandbox.
- Revives an already-documented env fallback (`ASANA_ACCESS_TOKEN`), making
  local/CI usage (`ASANA_ACCESS_TOKEN=… asana …`) work without writing a config
  file — a usability win beyond sandboxes.
- No new dependency, no new flag, no change to the human-auth (`auth login`) path.

### Negative

- A placeholder token "works" only when a broker is actually configured to
  overwrite the header; run outside a broker, `Bearer brokered` fails at Asana
  with a 401. This is the intended failure mode but must be documented.
- CA trust correctness depends on the runtime honoring `NODE_EXTRA_CA_CERTS`
  under Bun + superagent; this is assumed and should be verified in a real
  sandbox, not just unit tests.

### Neutral

- Precedence is config-file token first, then `ASANA_ACCESS_TOKEN`. Brokered
  sandboxes simply ship no config file, so the env placeholder wins.
- Forward-proxy and custom-host support remain open; this ADR deliberately scopes
  to the transparent-interception model the two target systems use.

## Alternatives Considered

- **Send no `Authorization` header in brokered mode** — rejected: Asana is
  Bearer-only, and "inject when absent" is a weaker, less portable broker
  primitive than "replace when present"; a present header is also easier to match.
- **New `ASANA_AUTH_MODE=brokered` flag** — rejected for now: adds surface area
  for no behavior the env placeholder doesn't already give. Reconsider only if we
  need to suppress the token-required check entirely.
- **Client-side `HTTPS_PROXY` / proxy agent** — rejected for the target systems:
  both use transparent interception, not forward proxying, and superagent ignores
  proxy env vars anyway. Deferred to a follow-up if needed.

## References

- Vercel Sandbox firewall — credentials brokering:
  <https://vercel.com/docs/sandbox/concepts/firewall#credentials-brokering>
- Cloudflare Sandbox — outbound traffic:
  <https://developers.cloudflare.com/sandbox/guides/outbound-traffic/>
- ADR-003: AXI Agent eXperience Conventions (`./003-axi-agent-experience.md`)
- Code: `src/lib/asana-client.ts` (`initializeApiClient`),
  `src/lib/config.ts` (`getAccessToken`),
  `node_modules/asana/src/ApiClient.js` (`basePath`, `requestAgent`)

## Related Issues

- #TBD: Brokered auth — source access token via `ASANA_ACCESS_TOKEN` env fallback
