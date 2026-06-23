# ADR-004: AXI Home View and Output-Formatter Boundary

## Status

Accepted

## Date

2026-06-23

## Context

[ADR-003](./003-axi-agent-experience.md) settled the AXI error-output model and
exit-code policy but explicitly deferred two items:

- **D3** — the content scope of the content-first home view (AXI §8), including the
  unauthenticated and offline fallback behavior.
- **D4** — whether to deduplicate the local `src/utils/formatter.ts` against
  `@pleaseai/cli-toolkit`'s `outputData`.

This ADR resolves both.

### Relevant facts

- Auth state is cheaply derivable with **no network call**: `getAccessToken()`
  (`src/lib/config.ts`) reads `~/.asana-cli/config.json` or `ASANA_ACCESS_TOKEN`.
- `AsanaConfig` carries an optional `workspace?` field, so a default workspace
  *may* be configured but is not guaranteed.
- The cli-toolkit `OutputFormat` is `'json' | 'toon'` **only** — it has no `plain`
  format. The local `formatter.ts` is the sole provider of `plain` (human-readable,
  colored) output, which is load-bearing for ADR-003's human-facing error path.
- `formatter.ts` already delegates `toon` to the toolkit's `encodeToon`; the only
  real overlap with the toolkit is trivial `json` stringification.
- The toolkit already ships `parseFields` / `filterFields` (unused in this repo),
  which the AXI §2 `--fields` work (roadmap Phase 3) needs.

## Decision

### D3 — Home view: tiered, "light live"

Running `asana` with no arguments renders a content-first home view (AXI §8/§10):

1. **Always** — `bin` (absolute path, `~`-collapsed) and a one-line `description`
   (AXI §10).
2. **Unauthenticated** (no token) — no network call. Show a structured hint to run
   `asana auth login`. Definitive and fast.
3. **Authenticated** — one cheap live call: **list workspaces**, plus next-step help
   hints. Workspaces are small and stable, keeping the per-session token budget
   minimal (AXI §7/§8).
4. **Offline / call failure** — degrade to the static identity (bin + description)
   plus a hint; never hang or dump a raw network error.

Example (authenticated):

```
bin: ~/.local/bin/asana
description: Manage Asana tasks from the CLI

workspaces[2]{gid,name}:
  12345,Acme
  67890,Personal

help[2]:
  Run `asana task list -w <gid>` to see tasks
  Run `asana project list -w <gid>` for projects
```

Rejected alternatives: a **rich** view (default-workspace incomplete tasks) — more
useful but requires a configured `workspace`, a heavier call, and more fallback
paths; and a **static** view (command groups only) — fastest but fails AXI §8's
"live content" intent. "Light live" is the balance of usefulness, cost, and
robustness.

### D4 — Keep `formatter.ts` as the canonical output boundary

Do **not** replace `formatOutput` with the toolkit's `outputData`. Rationale:
`outputData` cannot render `plain` and writes directly to stdout, bypassing the
format-aware error boundary ADR-003 depends on.

Instead:

- `src/utils/formatter.ts` remains the single, format-aware output boundary and the
  owner of `plain`.
- Underneath it, adopt toolkit **primitives** to eliminate drift and avoid
  reimplementation: `encodeToon` (already used) for `toon`, and `parseFields` /
  `filterFields` for the `--fields` work (Phase 3).
- The shared `axi-output.ts` helper (ADR-003) routes errors and empty states
  through this same boundary.

## Consequences

### Positive

- Home view gives agents actionable live state on the first call (AXI §8) while
  staying cheap and offline-safe.
- No new runtime dependency; the binary stays lean.
- Output stays consistent across success, empty, and error paths because everything
  flows through one boundary.
- `--fields` (Phase 3) reuses battle-tested toolkit primitives instead of bespoke
  filtering.

### Negative

- The home view adds a network-dependent path that needs explicit offline/auth-state
  tests.
- `plain` remains a locally maintained format (the toolkit will not cover it).

### Neutral

- If a configured default workspace becomes common, a richer home view can be
  revisited in a later ADR without changing this boundary.

## References

- [AXI — Agent eXperience Interface](https://agentskills.io)
- ADR-003: AXI Agent eXperience Conventions (`./003-axi-agent-experience.md`)
- ADR-002: TOON Output Format for CLI (`./002-toon-output-format.md`)
- Roadmap: AXI Adoption Plan (`../AXI-ADOPTION.md`)
- Code: `src/lib/config.ts`, `src/utils/formatter.ts`,
  `@pleaseai/cli-toolkit/output` (`outputData`, `parseFields`, `filterFields`)

## Related Issues

- #TBD: AXI §8 — content-first home view
- #TBD: AXI §2 — `--fields` + minimal schemas via toolkit primitives
