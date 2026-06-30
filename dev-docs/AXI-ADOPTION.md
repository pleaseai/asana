# AXI Adoption Plan

This document tracks the adoption of the
[AXI standard](https://agentskills.io) (Agent eXperience Interface) — ergonomic
conventions for CLI tools consumed by autonomous agents — in the Asana CLI.

The error-output model and exit-code policy are formalized in
[ADR-003](./adr/003-axi-agent-experience.md). This document is the broader,
living roadmap.

## Why

The Asana CLI is invoked by agents (Claude Code, Codex, OpenCode) over shell and
its stdout is parsed as data. ADR-002 already made data output token-efficient
(TOON by default). The remaining work makes the *rest* of the surface — errors,
empty states, counts, schemas, the home view, and session integration —
agent-shaped as well. The roadmap is measured against two complementary standards:
**AXI** (output/presentation) and the **Agent DX CLI Scale** (input/safety/
introspection); see the scorecard below.

## Gap matrix (AXI §1–§10 vs current)

| § | AXI requirement | Current state | Verdict | Effort |
|---|---|---|---|---|
| 1 | Token-efficient TOON output | `encodeToon` is the default (`formatter.ts`) | ✅ Met | — |
| 2 | Minimal schemas + `--fields` | Full objects emitted; no `--fields` | ⚠️ Partial | M |
| 3 | Content truncation + `--full` | No truncation of long fields | ❌ Missing | M |
| 4 | Pre-computed aggregates (total count) | Lists omit total count | ❌ Missing | S–M |
| 5 | Definitive empty states | `chalk.yellow('No tasks found')` | ❌ Violates | S |
| 6 | **Structured errors → stdout, exit codes, idempotency, no prompts** | stderr + Chalk, `exit(1)`, idempotency unclear | ❌ **Core violation** | M–L |
| 7 | Ambient session integration (SessionStart dashboard) | None | ❌ Missing | M |
| 8 | Content-first home view | No-arg → commander help (stderr) | ❌ Violates | M |
| 9 | Contextual disclosure (next-step hints) | None | ❌ Missing | M |
| 10 | bin path, description, `--help` | Only `--version`; no home identity | ⚠️ Partial | S |

## Agent DX scorecard

AXI covers output and presentation. The complementary
**Agent DX CLI Scale** (0–21, from
"You Need to Rewrite Your CLI for AI Agents") scores the **input, safety, and
introspection** surfaces AXI does not. We track it here so the roadmap is measured
against both.

| Axis | Now | Target | Basis |
|------|-----|--------|-------|
| 1. Machine-readable output | 1 | 3 | Success output consistent (TOON/JSON, all cmds); errors still stderr+Chalk → fixed by Phase 1 |
| 2. Raw payload input | 2 | 3 | `asana api` (ADR-006) reaches any endpoint with raw body/stdin (`gh api`-style); reaches 3 when typed single mutations also accept `--json`/stdin → Phase 6 |
| 3. Schema introspection | 0 | 2 | Only commander `--help` text; no machine schema → Phase 7 |
| 4. Context window discipline | 0 | 2 | No `--fields` mask / pagination control (TOON is orthogonal) → Phase 3 |
| 5. Input hardening | 2 | 3 | Strict numeric GID (`^\d+$`) blocks traversal/encoding in IDs; gaps: no CWD path sandbox on `--file`, coverage unaudited |
| 6. Safety rails | 0 | 2 | No `--dry-run`, no response sanitization → Phase 8 |
| 7. Agent knowledge packaging | 1 | 3 | CLAUDE.md exists; no CLI-usage skill library/guardrails → Phase 5 |
| **Total** | **6 / 21** | **~18 / 21** | Now: *Human-only* (top edge). After roadmap: *Agent-first* |

**Multi-surface (bonus, unscored):** MCP ❌ (not in this binary) · extension/plugin ❌
(Homebrew distribution is not agent-native) · headless auth ✅ (`ASANA_ACCESS_TOKEN`,
PAT). MCP is tracked as D9 below.

> The roadmap's AXI phases (1–5) alone lift the total to ~11–12 (*Agent-ready*).
> Reaching *Agent-first* requires the input/safety axes in Phases 6–8 + the MCP
> surface (D9).

## Decisions

| ID | Topic | Status |
|----|-------|--------|
| D1 | Dual-mode error output (toon/json → stdout structured; plain → stderr human) | ✅ Decided — ADR-003 |
| D2 | Backward compatibility: freeze `plain`, ship as semver **minor** | ✅ Decided — ADR-003 |
| D5 | Exit codes: 0 success/no-op, 1 error, 2 usage | ✅ Decided — ADR-003 |
| D3 | Home view: tiered "light live" (workspaces + hints; offline/auth fallback) (§8) | ✅ Decided — ADR-004 |
| D4 | Keep `formatter.ts` as canonical boundary; adopt toolkit `parseFields`/`filterFields` underneath | ✅ Decided — ADR-004 |
| D6 | Raw JSON payload input — generic `asana api` escape hatch ✅ (ADR-006); `--json`/stdin on typed single mutations still open (Agent DX axis 2) | 🟡 Partial — ADR-006 |
| D7 | Machine-readable schema introspection (`--help --json` or `describe`) (axis 3) | ⏳ Open — future ADR |
| D8 | `--dry-run` on all mutating commands (axis 6) | ⏳ Open — future ADR |
| D9 | MCP (stdio JSON-RPC) surface from the same binary (multi-surface) | ⏳ Open — separate ADR (large) |

## Phased plan

All phases follow the repo's TDD discipline (Red → Green → Refactor), separate
structural from behavioral commits, and use conventional commits. Documentation
and code are in English (repos/ convention).

### Phase 0 — Foundation (structural)

- Author ADR-003 (done) for D1 / D2 / D5.
- New shared helper `src/lib/axi-output.ts`: `emitError({ code, message, help, context })`,
  `emitEmpty(collection)`, `withCount(list, total)`, `helpHints([...])`. Reuses
  `encodeToon` from `@pleaseai/cli-toolkit`. Tests first.

### Phase 1 — §6 Structured errors (highest ROI)

- Make `error-handler.ts` and the `ValidationError` path format-aware (D1).
- Narrow `ValidationError.errorId` from `string` to `ErrorId`.
- Introduce exit code `2` for usage errors (D5); validate required flags before any
  API call.
- Idempotent mutations: `task complete` / `delete` on an already-final task →
  acknowledge, exit 0.
- Regression + output-snapshot tests per change.

### Phase 2 — §5 empty states + §4 counts

- `No tasks found` → structured `tasks: 0 ... found`.
- Add `count: N of M total` to list output. Start with high-traffic commands
  (task, project, search), then roll out across the remaining lists.

### Phase 3 — §2 / §3 minimal schemas + `--fields` + truncation

- Global `--fields` option using toolkit `parseFields` / `filterFields` (already
  available, currently unused), wired underneath `formatter.ts` per D4 (ADR-004).
- Reduce default list schemas to ~3–4 fields; full detail in detail views.
- Truncate long fields (e.g. description) with a `--full` escape hatch and a total
  size hint.

### Phase 4 — §8 / §9 / §10 home view + disclosure + help

- Content-first no-arg home view: bin path + one-line description + live content +
  help hints. Tiered "light live" per D3 (ADR-004): unauthenticated → `auth login`
  hint (no network); authenticated → one cheap workspaces call + hints; offline →
  degrade to static identity + hint.
- Contextual next-step hints on list and mutation responses.
- Per-subcommand `--help` reference (flags, defaults, 2–3 examples).

### Phase 5 — §7 ambient session integration (optional, last)

- `asana hook install`-style command to register SessionStart context for Claude
  Code / Codex / OpenCode with a token-minimal dashboard.
- Secondary: ship an installable SKILL.md generated from the home-view content.

## Agent DX phases (input / safety / introspection)

These extend the roadmap beyond AXI to reach *Agent-first*. They are independent of
Phases 1–5 and can be sequenced by ROI — **Phase 8 (`--dry-run`) is high-value and
low-risk and may be pulled forward right after Phase 1.**

### Phase 6 — Raw payload input (axis 2, D6)

- ✅ **Done:** `asana api <endpoint>` — a `gh api`-style escape hatch reaching any
  Asana REST endpoint with an arbitrary method, raw body (`--input`/stdin), and
  headers (ADR-006). Raw passthrough — no `data` envelope wrapping; no
  `--paginate` in v1.
- **Remaining:** accept a raw JSON payload on the typed single mutating commands
  via `--json '<obj>'` or stdin, mapping directly to the Asana API schema (the
  `batch-update --file` passthrough in `toTaskData` is the existing precedent).
  Convenience flags remain; raw payload is additive (no translation loss).

### Phase 7 — Schema introspection (axis 3, D7)

- Expose a machine-readable schema: `asana <cmd> --help --json` or an
  `asana describe` command emitting params, types, required fields, enums as JSON.
- Lets agents discover the surface at runtime instead of relying on pre-stuffed docs.

### Phase 8 — Safety rails: dry-run (axis 6, D8)

- `--dry-run` on every mutating command: validate and echo the resolved request
  without side effects, exit 0. High ROI, low risk.
- Consider response sanitization against prompt injection in API data (axis 6 → 3)
  as a later, separate step.

### Out of roadmap — MCP surface (D9)

- An MCP (stdio JSON-RPC) server exposing the same operations as typed tools is the
  largest multi-surface win but a significant architectural decision → its own ADR,
  not folded into these phases.

## Risks & safety net

- **Broad touch surface** (17 of 18 commands) → regression risk. Mitigated by the
  existing 31 unit + 6 e2e tests plus new output snapshots.
- **stdout error transition is potentially breaking** → mitigated by freezing the
  `plain` path (D2); release-please manages the semver-minor bump.
- **Home-view network calls** (Phase 4) → require unauthenticated/offline fallback
  (D3) and a token budget.

## References

- [AXI — Agent eXperience Interface](https://agentskills.io)
- Agent DX CLI Scale — local skill `agent-dx-cli-scale` (from "You Need to Rewrite Your CLI for AI Agents")
- [TOON specification](https://toonformat.dev/reference/spec.html)
- [ADR-002: TOON Output Format](./adr/002-toon-output-format.md)
- [ADR-003: AXI Agent eXperience Conventions](./adr/003-axi-agent-experience.md)
- [ADR-004: AXI Home View and Output-Formatter Boundary](./adr/004-axi-home-view-and-formatter.md)
