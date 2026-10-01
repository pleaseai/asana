# ADR-007: Cloudflare Forge Evaluation — Borrow Patterns, Do Not Adopt

## Status

Accepted

## Date

2026-10-01

## Context

Cloudflare open-sourced [Forge](https://github.com/cloudflare/forge)
(2026-09-28), a schema-first OpenAPI code-generation framework whose first
output is the `cf` CLI ([blog](https://blog.cloudflare.com/forge-open-source-generation-pipeline)).
Asana publishes an OpenAPI 3.0 spec
([`Asana/openapi` `defs/asana_oas.yaml`](https://github.com/Asana/openapi)) with
**251 operations over 177 paths**, every operation carrying an `operationId` and
a tag. This CLI hand-writes ~14 commander command modules and reaches the
remaining endpoints only through `asana api` ([ADR-006](./006-raw-api-passthrough-command.md)).

The question: should the CLI adopt Forge to generate commands from the Asana
spec, and if not, what should it take from it?

Findings (forge @ `056b13e`, cf @ `f258c29`, both 2026-09-29/10-01):

- **Not on npm.** `@cloudflare/forge` returns 404; `cf` vendors it as a tarball
  (`vendor/cloudflare-forge-0.1.0.tgz`). forge#6 says publishing is deferred.
- **No CLI generator in Forge.** The CLI generator lives in `cloudflare/cf`
  (`packages/cli/generator/`, `packages/cli/generate.ts`); maintainers say parts
  will move back into Forge later, with no date.
- **Stack mismatch.** Generated commands are yargs `CommandModule`s; the
  toolchain is Node ≥ 22 + pnpm. This CLI is commander + Bun compiled binary.
- **No standalone runtime.** Generated code imports `#lib/*` (auth, output,
  dry-run, telemetry) and a Fern-generated SDK from inside the cf repo.
- **Cloudflare-specific assumptions** are hard-coded in "generic" code
  (`--account-id`/`--zone` globals, `CF_HIDE_COMMANDS`, `{result}` envelope
  stripping, zone-name argument classification).
- **Limited overlays.** Overlay 1.0 shape, but targets are restricted to `$` or
  `$.paths.*[?@.operationId=="..."]`; `remove` is rejected. Command naming relies
  on Fern annotations (`x-fern-sdk-group-name` / `x-fern-sdk-method-name`).
- **Immature.** Three commits in Forge; `cf` had 40+ open issues within days of
  its beta launch.

## Decision Drivers

- Preserve the architecture invariants in `ARCHITECTURE.md`: single API gateway
  (`getAsanaClient()`), all output through `formatOutput()` (TOON default),
  centralized failure path, exit codes 0/1/2 ([ADR-003](./003-axi-agent-experience.md)).
- Keep the Bun single-binary distribution ([ADR-001](./001-distribution-strategy.md)).
- Advance the open Agent DX items D6–D9 in [AXI-ADOPTION.md](../AXI-ADOPTION.md)
  at the lowest cost.

## Considered Options

### Option A — Adopt Forge + the cf generator now

*Pros:* broad typed coverage of all 251 operations. *Cons:* unpublished, vendored
tarball; would require rewriting the CLI on yargs/Node, reimplementing the cf
runtime (`#lib/*`), stripping Cloudflare assumptions, and annotating the spec with
Fern extensions; discards TOON, the formatter/error boundaries, and the client
gateway. **Rejected.**

### Option B — Build an in-house Asana-spec → commander generator now

*Pros:* keeps the stack and invariants; names derive from tag + `operationId`
without Fern annotations. *Cons:* `asana api` already covers the long tail;
benefit is small until schema metadata (D7) exists. **Deferred** (see
Consequences / Revisit).

### Option C — Borrow Forge/cf design patterns into the existing roadmap (selected)

*Pros:* no new dependency; each pattern lands in an already-planned phase; cf's
open bugs serve as a checklist of pitfalls. *Cons:* no generated coverage gain.

## Decision

Do **not** adopt Forge or the cf generator. Borrow these patterns into the
existing AXI / Agent DX phases:

| Pattern (source) | Roadmap item |
|---|---|
| `--dry-run` echoing the resolved request (`cf/src/lib/dry-run.ts`); per-operation "require confirmation" metadata (`x-forge-require-confirmation`) | D8 / Phase 8 |
| Per-operation JSON schema sidecar (`_meta/schemas.json`) + `cf schema <cmd>`; derive ours from the Asana spec | D7 / Phase 7 |
| `--body '<json>'` / `--body @path` and `--file` on typed mutations (`forge/shared/generated-cli-options.ts`) | D6 / Phase 6 remainder |
| MCP tool definitions from the same metadata (`cf tools`) | D9 |
| Natural-language command search (`cf cli search`, MiniSearch) | Phase 4 (optional) |

Known cf defects to avoid explicitly:

- cf#103 — `--dry-run` prints secret values → dry-run output must redact tokens.
- cf#104 — hand-written mutating commands lack `--dry-run` → apply to **every**
  mutating command, not a subset.
- cf#94 — non-interactive confirmation abort exits 0 → abort must exit non-zero.
- cf#100 — `<unknown> --help` exits 0 → unknown command is a usage error (exit 2, D5).
- cf#105 — empty stdout with exit 0 → definitive empty states (Phase 2).
- cf#156 — `FORCE_COLOR` wraps JSON in ANSI → machine formats must never emit
  colour codes, regardless of colour env vars.

## Consequences

### Positive

- No new runtime/build dependency; Bun binary and all invariants unchanged.
- Phases 6–8 and D9 gain concrete, field-tested reference designs.
- cf's early bug reports become regression-test ideas for our phases.

### Negative

- No generated typed coverage; the long tail stays behind `asana api`.

### Neutral

- Once D7 ships schema metadata derived from the Asana spec, Option B becomes
  cheap: the same metadata can drive a generator using Forge's ideas (Overlay 1.0
  file for naming/hiding, an intermediate representation, a hand-written override
  registry like `cf/src/commands/hand-written.ts`) without depending on Forge.

### Revisit when

All of: `@cloudflare/forge` is published to npm, the CLI generator lives in Forge,
and at least one non-Cloudflare spec example exists.

## References

- [Forge repository](https://github.com/cloudflare/forge) ·
  [cf repository](https://github.com/cloudflare/cf)
- [Forge: open-source generation pipeline (blog)](https://blog.cloudflare.com/forge-open-source-generation-pipeline)
- [cf CLI launch (blog)](https://blog.cloudflare.com/cloudflare-cf-cli-launch)
- [Asana OpenAPI spec](https://github.com/Asana/openapi)
- [AXI Adoption Plan](../AXI-ADOPTION.md)
- [ADR-003](./003-axi-agent-experience.md) · [ADR-006](./006-raw-api-passthrough-command.md)
