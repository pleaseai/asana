# ADR-003: AXI (Agent eXperience Interface) Conventions

## Status

Accepted

## Date

2026-06-23

## Context

The Asana CLI is increasingly consumed by autonomous agents (Claude Code, Codex,
OpenCode) that invoke it through shell execution and parse its stdout. ADR-002
already moved data output to a token-efficient **TOON** default, which satisfies
the first AXI principle. However, an audit against the full
[AXI standard](https://agentskills.io) (Agent eXperience Interface) revealed that
the rest of the CLI's surface is still shaped for humans, not agents.

The most significant gap is **error handling**: `src/lib/error-handler.ts` and the
`ValidationError` path (`src/lib/validators.ts`) write Chalk-colored, human-oriented
text to **stderr** and call `process.exit(1)`. Agents do not read stderr, so they
cannot observe *why* a command failed — they only see a non-zero exit code. This
directly violates AXI §6 ("structured errors on stdout in the same structured
format as normal output").

Secondary gaps (definitive empty states §5, total-count aggregates §4, minimal
schemas + `--fields` §2, content truncation §3, content-first home view §8,
contextual disclosure §9, ambient session integration §7) are tracked in the
roadmap (`dev-docs/AXI-ADOPTION.md`) and out of scope for this ADR. This ADR fixes
the **error output model and exit-code policy** only, because that is the
highest-value, agent-blocking gap and it establishes the output-boundary pattern
the other phases reuse.

The project already owns the building blocks: stable error codes in
`src/constants/errorIds.ts` (`ERROR_IDS` / `ErrorId`), `ValidationError` carrying
`errorId` + `context`, and `encodeToon` from `@pleaseai/cli-toolkit/output`. No new
runtime dependency (e.g. a structured-diagnostics library) is required to satisfy
AXI — the gap is a wiring problem at the output boundary, not a missing library.

## Decision Drivers

- **Agent-readability**: failures must be machine-parseable on stdout, not stderr.
- **Backward compatibility**: existing human/script users of `plain` output must
  not break.
- **Reuse over dependency**: leverage existing `ERROR_IDS` + `encodeToon` rather
  than introduce a new error/diagnostics dependency.
- **Consistency**: error output should mirror the success output's format selection
  (`--format toon|json|plain`).

## Considered Options

### Option 1: Keep stderr + Chalk for all errors

**Pros:** zero work; familiar to human users.
**Cons:** agents cannot read failures (AXI §6 violation). Rejected.

### Option 2: Always emit structured errors to stdout (all formats)

**Pros:** simplest mental model; fully AXI-compliant.
**Cons:** breaking change for `plain` users and scripts that read stderr; would
force a semver **major**. Rejected for now (see D2).

### Option 3: Format-aware dual-mode error output (Selected)

When `--format` is `toon` or `json`, emit a **structured error to stdout**
(`error`, `code`, `help`, optional `context`) using the same encoder as success
output. When `--format` is `plain`, retain the existing **stderr + Chalk**
human-oriented behavior.

**Pros:** AXI-compliant for agents; fully backward-compatible for humans/scripts;
semver **minor**; reuses existing infrastructure.
**Cons:** two code paths to maintain and test.

## Decision

Adopt **Option 3 (format-aware dual-mode error output)** with the following rules.

### D1 — Dual-mode error output

- `--format toon|json` → structured error written to **stdout** via the shared
  output encoder. Shape:

  ```
  error: <translated, actionable message>
  code: <ERROR_IDS value>
  help: <specific next-step command, not "see --help">
  context: <optional key/values>
  ```

- `--format plain` → existing **stderr + Chalk** human-readable behavior is
  preserved unchanged. (`--format` defaults to `toon` regardless of TTY; `plain`
  is opt-in.)
- Errors are **translated** at the boundary: extract actionable meaning, never leak
  raw Asana SDK payloads or stack traces (DEBUG mode may still dump full detail to
  stderr).

### D2 — Backward compatibility: minor release

The `plain` path is frozen for backward compatibility. Only `toon`/`json` gain the
new stdout behavior. This is a **non-breaking, semver-minor** change managed via
release-please.

### D5 — Exit-code policy

- `0` — success, **including idempotent no-ops** (e.g. completing an already-complete
  task acknowledges and exits 0).
- `1` — error (the agent's intent genuinely cannot be satisfied).
- `2` — usage error (missing/invalid required flags), validated **before** any API
  call. No interactive prompts — a missing required value fails immediately with a
  structured usage error.

### Implementation note

A shared helper module (e.g. `src/lib/axi-output.ts`) will own `emitError(...)` so
both `handleAsanaError` and the `ValidationError` path route through one
format-aware boundary. `ValidationError.errorId` will be narrowed from `string` to
`ErrorId` as part of this work.

## Consequences

### Positive

- Agents can read and act on failures (AXI §6 satisfied for `toon`/`json`).
- No new runtime dependency; binary size unaffected.
- Establishes the output-boundary pattern reused by roadmap phases 2–4.
- `ErrorId` type tightening removes an existing loose-typing weakness.

### Negative

- Two error-rendering code paths to maintain and snapshot-test.
- Broad touch surface: 17 of 18 command files invoke the error/output path.

### Neutral

- Open items deferred to follow-up ADRs: **D3** (home-view content scope and
  unauthenticated/offline fallback, AXI §8) and **D4** (deduplicating local
  `src/utils/formatter.ts` against `@pleaseai/cli-toolkit` `outputData`).

## References

- [AXI — Agent eXperience Interface](https://agentskills.io)
- [TOON specification](https://toonformat.dev/reference/spec.html)
- ADR-002: TOON Output Format for CLI (`./002-toon-output-format.md`)
- Roadmap: AXI Adoption Plan (`../AXI-ADOPTION.md`)
- Code: `src/lib/error-handler.ts`, `src/lib/validators.ts`,
  `src/constants/errorIds.ts`, `src/utils/formatter.ts`

## Related Issues

- #TBD: AXI §6 — structured errors on stdout + exit-code policy
