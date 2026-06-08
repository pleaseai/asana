# Architecture

> Agent-first ARCHITECTURE.md for the **Asana CLI** — optimized for AI agent
> consumption (Claude Code, etc.). Describes structure and intent, not line-by-line
> implementation. Keep this in sync when modules, entry points, or invariants change.

## System Overview

**Purpose**: A fast, scriptable command-line interface for managing Asana tasks,
projects, and sections directly from the terminal, with machine-readable output for
automation and LLM workflows.

**Primary users**: Developers and power users working in the shell, automation/CI
scripts, and AI agents that consume the token-efficient TOON output.

**Core workflow**:

1. The user runs `asana <resource> <action> [options]` (e.g. `asana task create -n "..."`).
2. Commander parses the command; the command's action handler loads credentials,
   calls the Asana API through the `getAsanaClient()` wrapper, and validates input.
3. The result is rendered via `formatOutput()` in the globally-selected format
   (TOON by default, or JSON / Plain) and printed; failures exit non-zero through
   the centralized error handler.

**Key constraints**:

- Ships as a single compiled binary via Bun; startup must stay fast (no heavy
  eager initialization).
- Depends on the official Asana API and is subject to its rate limits and availability.
- Secrets (access/refresh tokens) must never be logged or committed; they live only
  in the user's local config (`~/.asana-cli/config.json`) or environment.

## Dependency Layers

Dependencies flow downward only. Lower layers must not import upper layers.

```
┌─────────────────────────────────────────────────────────┐
│  Interface Layer                                         │
│  src/index.ts, src/commands/*                            │  Commander commands, flags
├─────────────────────────────────────────────────────────┤
│  Application Layer                                       │
│  command .action() handlers                              │  Orchestration per command
├─────────────────────────────────────────────────────────┤
│  Domain / Core Layer                                     │
│  src/lib/* (asana-client wrapper, validators, oauth),   │  Auth, validation, API access
│  src/utils/formatter.ts, src/constants, src/types       │
├─────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                   │
│  asana SDK, filesystem (~/.asana-cli), OAuth HTTP        │  External services & I/O
│  callback server, @pleaseai/cli-toolkit (TOON)           │
└─────────────────────────────────────────────────────────┘
```

**Invariant**: Command handlers reach the Asana API only through the
`getAsanaClient()` wrapper in `src/lib/asana-client.ts` — they never instantiate
`asana` SDK API classes directly. This keeps token handling, lazy initialization,
and the legacy-style API surface in one place.

## Entry Points

For understanding **how the CLI boots and dispatches**:

- `src/index.ts` — Root entry point. Builds the top-level `commander` program,
  declares the global `-f, --format <toon|json|plain>` option (default `toon`), and
  registers every subcommand. Start here to see the full command surface.

For understanding **a typical command's shape**:

- `src/commands/task.ts` — Representative command module. Shows the standard pattern:
  define subcommands with options, validate input, call `getAsanaClient()`, then
  render with `formatOutput()`. The global `--format` is read from the root program
  via `command.parent?.parent?.opts().format`.

For understanding **Asana API access & token lifecycle**:

- `src/lib/asana-client.ts` — Lazily initializes the Asana SDK with the stored token,
  exposes a stable legacy-style wrapper (`tasks`, `projects`, `sections`, `users`,
  `workspaces`), and handles OAuth refresh (`refreshTokenIfNeeded`) and client reset.

For understanding **authentication**:

- `src/commands/auth.ts` + `src/lib/oauth.ts` — PAT and OAuth 2.0 login. `oauth.ts`
  opens the browser and runs a localhost HTTP callback server to capture the code,
  exchanges it for tokens, and persists them via `config.ts`.

For understanding **output rendering**:

- `src/utils/formatter.ts` — `formatOutput()` switches between TOON (token-efficient,
  via `@pleaseai/cli-toolkit`), JSON, and human-readable Plain text.

## Module Reference

| Module           | Purpose                                                                        | Key Files                                                                       | Depends On                                        | Depended By                       |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `src/` (root)    | CLI bootstrap & command registration                                           | `index.ts`                                                                      | `commands/*`                                      | (binary entry)                    |
| `src/commands/`  | One module per resource; defines subcommands, flags, and orchestration         | `auth.ts`, `task.ts`, `project.ts`, `section.ts`, `self-update.ts`              | `lib/*`, `utils/formatter`, `types`               | `index.ts`                        |
| `src/lib/`       | Core domain: API wrapper, auth, config persistence, validation, error handling | `asana-client.ts`, `oauth.ts`, `config.ts`, `validators.ts`, `error-handler.ts` | `asana` SDK, `node:fs/http`, `constants`, `types` | `commands/*`                      |
| `src/utils/`     | Output formatting across TOON / JSON / Plain                                   | `formatter.ts`                                                                  | `@pleaseai/cli-toolkit`, `chalk`                  | `commands/*`                      |
| `src/constants/` | Stable identifiers (structured error IDs)                                      | `errorIds.ts`                                                                   | —                                                 | `lib/error-handler`, `commands/*` |
| `src/types/`     | Shared TypeScript types (config shape, command option types)                   | `index.ts`                                                                      | —                                                 | `commands/*`, `lib/*`             |

## Architecture Invariants

These constraints must always hold. Violating them breaks layering, leaks secrets,
or fragments output/error behavior.

**Single API gateway**: All Asana API calls go through `getAsanaClient()`
(`src/lib/asana-client.ts`). Do NOT import or instantiate `asana` SDK API classes
(`TasksApi`, `ProjectsApi`, …) inside `src/commands/*`. Centralizing access keeps
lazy initialization, token injection, and OAuth refresh consistent.

**All output flows through the formatter**: Command results must be rendered with
`formatOutput()` honoring the global `--format`. Do NOT hand-roll `JSON.stringify`
or ad-hoc `console.log` of structured data in command handlers — this would bypass
TOON and break scripted/LLM consumers. The format is resolved from the root program
options (`command.parent?.parent?.opts().format`), defaulting to `toon`.

**Secrets never leak**: Do NOT log, print, or commit access tokens, refresh tokens,
OAuth client secrets, or `~/.asana-cli/config.json` contents. Credentials live only
in local config or environment variables (`ASANA_ACCESS_TOKEN`, `ASANA_CLIENT_ID`,
`ASANA_CLIENT_SECRET`). Structured `logError` must not include token fields.

**Centralized failure path**: User-facing errors terminate through
`handleAsanaError()` / `handleHttpError()` in `src/lib/error-handler.ts`, which map
Asana/HTTP/network errors to clear messages and `process.exit(1)`. Do NOT print raw
stack traces by default — full details are gated behind `DEBUG`.

**Input is validated at the boundary**: GIDs, dates, and update payloads pass through
`src/lib/validators.ts` (`validateGid`, `validateDateFormat`, `validateUpdateFields`)
before reaching the API. Validation failures raise `ValidationError`, not raw SDK errors.

**Dependencies flow downward**: `src/lib/*` and `src/utils/*` must not import from
`src/commands/*`. Core/domain code stays decoupled from the CLI interface so it
remains unit-testable in isolation.

## Cross-Cutting Concerns

**Error handling**: Centralized in `src/lib/error-handler.ts`. Asana SDK structured
errors, HTTP status codes (401/403/404/429/5xx), and network errors each get a
tailored message plus contextual key/values, then exit `1`. `logError()` emits
JSON-structured records to stderr when `NODE_ENV=production` (for downstream
monitoring). Verbose diagnostics are opt-in via the `DEBUG` env var.

**Logging / output**: User-facing messages use `chalk` for color but degrade for
non-TTY output. Structured results are rendered by `src/utils/formatter.ts`. TOON is
the default machine format (≈58.9% token savings vs JSON); `--format json` and
`--format plain` are alternatives.

**Testing**: `bun test`. Unit tests under `test/` mirror the source tree
(`test/commands`, `test/lib`, `test/utils`, `test/helpers`); end-to-end tests live
under `tests/e2e` (run via `bun run test:e2e`, with `test:e2e:secure` using
dotenvx-decrypted secrets). Target >80% coverage for new code (`bun run test:coverage`).
Mock external dependencies (Asana SDK, OAuth, filesystem).

**Configuration**: Persistent credentials/workspace live in
`~/.asana-cli/config.json`, read/written by `src/lib/config.ts`. Token resolution
order in `getAccessToken()`: stored config, then `ASANA_ACCESS_TOKEN`. OAuth apps are
configured via `ASANA_CLIENT_ID` / `ASANA_CLIENT_SECRET`. Secrets in the repo for
development are managed with dotenvx (`env:encrypt` / `env:decrypt`,
`dev:secure` / `test:e2e:secure`).

**Build & distribution**: `bun build src/index.ts --compile` produces the `asana`
binary. Distributed via a Homebrew tap (`pleaseai/tap/asana-cli`), an install script
(`scripts/install.sh`), and from-source builds. Releases are automated with
release-please (`release-please-config.json`, `CHANGELOG.md`).

## Quality Notes

**Well-tested**: `src/lib/*` and `src/utils/formatter.ts` have mirrored unit tests
(`test/lib`, `test/utils`) and clear, isolated responsibilities — generally safe to
refactor behind their existing interfaces. E2E coverage for the Asana API was
recently expanded (`tests/e2e`).

**Fragile / needs care**:

- `src/lib/asana-client.ts` uses module-level singletons and `any`-typed wrapper
  methods for backward compatibility. The lazy-init + `resetClient()` interplay with
  OAuth refresh is stateful — change deliberately and re-run auth/refresh tests.
- `formatPlain()` in `src/utils/formatter.ts` is a generic best-effort renderer; per
  command, plain output may need shaping for the specific data structure.
- OAuth flow (`src/lib/oauth.ts`) spins up a localhost HTTP callback server and opens
  a browser — inherently harder to test and environment-sensitive.

**Technical debt**: Pervasive `any` typing in the `getAsanaClient()` wrapper weakens
type safety between commands and the SDK; tightening these types is a tracked
improvement. The root `index.ts` at the repository root is a leftover Bun starter
stub (`console.log('Hello via Bun!')`) and is not the CLI entry point — the real
entry is `src/index.ts`.

---

_Last updated: 2026-06-08_

_Key ADRs: none yet — record future architectural decisions under
`.please/docs/decisions/` (use `/standards:adr`)._
