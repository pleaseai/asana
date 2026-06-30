# ADR-006: Raw API Passthrough Command (`asana api`)

## Status

Accepted

## Date

2026-06-30

## Context

The Asana CLI wraps the Asana REST API behind ~18 typed commands
(`task`, `project`, `team`, …). Any endpoint the official `asana` SDK does not
expose, or that has not yet been wrapped in a typed command, is unreachable from
the CLI. Agents and power users need an **escape hatch** equivalent to
`gh api` — a way to call any Asana REST endpoint directly with an arbitrary
method, body, and headers.

This is the concrete delivery of roadmap item **D6 / Phase 6 (Raw payload
input, Agent DX axis 2)** in [AXI-ADOPTION.md](../AXI-ADOPTION.md). Before this
change, the only raw-payload surface was `task batch-update --file` (the
`toTaskData` passthrough), which scored axis 2 at 1/3.

The command must reuse the existing AXI boundary established by
[ADR-003](./003-axi-agent-experience.md): TOON-by-default output via
`formatOutput`, structured errors via `handleAsanaError`/`emitError`, and the
0/1/2 exit-code policy.

## Decision Drivers

- **Coverage**: reach endpoints the typed commands do not.
- **Predictability**: a thin client an agent can reason about, with no hidden
  request rewriting (STANDARDS: "no hidden magic").
- **Reuse over new infrastructure**: auth, error translation, and output
  formatting already exist; the command is wiring, not new subsystems.
- **`gh api` familiarity**: agents already know the `gh api` shape.

## Considered Options

### Body construction for `-f`/`-F` fields

**Option A — Raw passthrough (selected).** Fields map to a flat JSON body
(`{ "name": "Foo" }`) for write methods and to query parameters for GET. The
caller supplies Asana's `{ "data": { … } }` envelope themselves via `--input`
when an endpoint requires it.
*Pros:* identical to `gh api`; fully predictable; no per-endpoint envelope
heuristics. *Cons:* the caller must know Asana wraps writes in `data`.

**Option B — Auto-wrap in `{ data: … }` for write methods.** *Pros:* more
convenient for the common case. *Cons:* hidden rewriting that diverges from
`gh api` and surprises callers sending non-`data` bodies (e.g. batch). Rejected.

**Option C — Default raw + opt-in `--data-wrap` flag.** Middle ground. Rejected
for v1 to keep the surface minimal; can be added later without breaking A.

### Pagination

**Selected — no `--paginate` in v1.** The response (including `next_page.offset`)
is passed through verbatim, so an agent can follow pagination with a second
call. Auto-following `next_page` and merging `data` arrays is deferred to a
follow-up. *Rejected for v1:* the extra implementation/test surface is not
justified for the initial escape hatch.

### Field flag naming

The global `-f` short flag is already bound to `--format` (ADR-002). A
subcommand `-f` collides with it and is silently captured by the global option.
Therefore the string-field flag is the long-only `--raw-field`; typed values use
`-F`/`--field` (no collision). This is a deliberate, documented deviation from
`gh api`'s `-f`.

## Decision

Add `asana api <endpoint>` with a `gh api`-faithful surface:

- `<endpoint>`: relative path (`/tasks/123` or `tasks/123`) joined onto the API
  base, or a full `https` URL passed through.
- `-X, --method`: defaults to GET, or POST when a body is present.
- `--raw-field <key=value>`: string field (long-only; see naming above).
- `-F, --field <key=value>`: typed field (`true`/`false`/`null`/number parsed).
- `--input <file|->`: raw request body from a file or stdin; **raw passthrough,
  no `data` wrapping**; takes precedence over fields.
- `-H, --header <key:value>`: extra headers (the bearer `Authorization` is set
  automatically and may be overridden).
- `-i, --include`: include the HTTP status and headers in the output.

Routing follows `gh`: GET/HEAD put fields on the query string; other methods
send the JSON body. Auth reuses `getAccessToken()` (config → `ASANA_ACCESS_TOKEN`)
and the existing `preAction` OAuth refresh. Transport is native `fetch()` (the
same approach `oauth.ts` already uses) against
`ASANA_API_BASE_URL` (default `https://app.asana.com/api/1.0`, overridable for
tests and brokered-egress sandboxes per [ADR-005](./005-brokered-auth-sandbox-egress.md)).
Output goes through `formatOutput`; HTTP ≥ 400 and network errors route through
`handleAsanaError` (exit 1); malformed flags are validated before any request
(exit 2).

## Consequences

### Positive

- Every Asana REST endpoint is reachable; Agent DX axis 2 rises from 1/3.
- Behavior mirrors `gh api`, so the surface is familiar and predictable.
- No new runtime dependency; reuses the ADR-003 output/error boundary.

### Negative

- Callers must supply the `{ data: … }` envelope for writes themselves (the cost
  of raw passthrough).
- A documented deviation from `gh api` (`--raw-field` instead of `-f`) due to the
  pre-existing global `-f/--format` flag.

### Neutral

- `--paginate`, response sanitization (axis 6), and an optional `--data-wrap`
  convenience remain available as future, additive work.

## References

- [AXI Adoption Plan — D6 / Phase 6](../AXI-ADOPTION.md)
- [ADR-002: TOON Output Format](./002-toon-output-format.md)
- [ADR-003: AXI Agent eXperience Conventions](./003-axi-agent-experience.md)
- [ADR-005: Brokered Authentication for Sandbox Egress](./005-brokered-auth-sandbox-egress.md)
- Code: `src/commands/api.ts`, `src/constants/api.ts`
- [`gh api` reference](https://cli.github.com/manual/gh_api)
