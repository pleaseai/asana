---
name: run-asana
description: Build, run, and drive the asana CLI. Use when asked to run asana, start it, build the binary, smoke-test it, exercise task/workspace/project commands, or verify a change works against a (mocked) Asana API without real credentials.
---

The asana CLI (`@pleaseai/asana`) is a Bun/TypeScript command-line tool for
Asana. Entry point is `src/index.ts` (commander). Every real command needs an
Asana access token and talks to `app.asana.com` — which you don't have in a
headless container. So the agent path drives the CLI against an **in-process
mock Asana API**: `.claude/skills/run-asana/mock-asana.mjs` stands up a fake API,
`launch.ts` points the CLI's SDK at it, and `smoke.mjs` runs the whole battery.

All paths below are relative to the repo root (`<unit>/`).

## Prerequisites

Bun only — this is a pure Bun/TS CLI with no native or GUI dependencies, so no
`apt-get` packages are required. This container has Bun 1.3.14:

```bash
bun --version   # → 1.3.14
```

On a clean machine without Bun: `curl -fsSL https://bun.sh/install | bash`.

## Setup

```bash
bun install
```

## Build

Optional — only when you need the standalone compiled binary (npm ships this
prebuilt). Produces a ~67M self-contained executable:

```bash
bun run build      # → bun build src/index.ts --compile --outfile asana
./asana --version  # → 0.11.0
```

For iteration you don't need this; run `src/index.ts` directly (see below).

## Run (agent path)

**One-shot smoke test** — start the mock, drive the core task lifecycle
(create → list → get → complete → delete) plus workspace/user/api reads, assert,
tear down. Exit 0 = all good:

```bash
bun .claude/skills/run-asana/smoke.mjs
# → ✓ PASS — 9 passed, 0 failed
```

**Drive commands by hand** — start the mock in the background, then point the
launcher at it. `launch.ts` overrides the Asana SDK's hardcoded base URL so
*every* command (SDK-backed and raw-fetch) hits the mock:

```bash
bun .claude/skills/run-asana/mock-asana.mjs > /tmp/mockurl.txt &
until [ -s /tmp/mockurl.txt ]; do sleep 0.1; done
URL=$(cat /tmp/mockurl.txt)

ASANA_API_BASE_URL="$URL" ASANA_ACCESS_TOKEN=fake \
  bun .claude/skills/run-asana/launch.ts -f json task create -n "Buy milk" -w 111
# → { "task": { "status": "success", "gid": "1001", "name": "Buy milk" } }
```

The mock is stateful within one run: a task you create shows up in `task list`.
It backs the endpoints the documented commands touch (tasks CRUD, `/users/me`,
`/workspaces`, `/projects`) and returns `{ data: [] }` for anything else, so a
command never crashes on an unmocked endpoint — extend `mock-asana.mjs` if you
need richer responses.

| file | role |
|---|---|
| `smoke.mjs` | orchestrator: starts mock, runs the assertion battery, exits 0/1 |
| `launch.ts` | CLI entry that redirects the SDK to `ASANA_API_BASE_URL` (pass-through if unset) |
| `mock-asana.mjs` | stateful in-memory Asana API; run standalone to print its base URL |

### Direct invocation (no mock)

`launch.ts` with `ASANA_API_BASE_URL` unset is a transparent pass-through, so it
also works as a plain entry against real Asana (or just use `bun run dev`):

```bash
bun .claude/skills/run-asana/launch.ts --version   # → 0.11.0
```

## Run (human path)

With a real Personal Access Token, against the live API:

```bash
export ASANA_ACCESS_TOKEN=<your-pat>
bun run dev workspace list         # bun run src/index.ts …
```

## Test

```bash
bun test test/          # unit tests → 557 pass, 0 fail (~0.7s)
```

E2E tests hit the **real** Asana API and self-skip without credentials; run them
only with a real token: `bun run test:e2e:secure` (needs `.env` with
`ASANA_ACCESS_TOKEN` + `ASANA_WORKSPACE`).

## Gotchas

- **The SDK base URL is not env-overridable — that's why `launch.ts` exists.**
  The `api`/`fetch` commands read `ASANA_API_BASE_URL` (see
  `src/constants/api.ts`), but SDK-backed commands (task/workspace/project/…) use
  the `asana` npm package's singleton `Asana.ApiClient.instance`, whose
  `basePath` is hardcoded to `app.asana.com` with no env hook. `launch.ts`
  overrides that singleton before importing the CLI.
- **`launch.ts` must stay inside the project tree.** Its `import 'asana'` has to
  resolve to the *same* `node_modules` copy the CLI loads. A copy in `/tmp`
  resolves `asana` to a different module instance, Bun gives you two singletons,
  and the basePath override silently does nothing (you get `Authentication
  failed` instead of mock data). A Bun `--preload` module has the same split-
  instance problem — don't use preload for this.
- **`api` command host allowlist.** The `api` command refuses to send
  credentials to a non-Asana host; when `ASANA_API_BASE_URL` points at your mock,
  that mock's host becomes the allowed one, so `api /users/me` works against it.
- **Default output is TOON, not JSON.** Commands print TOON (token-efficient)
  unless you pass `-f json` or `-f plain`. Assert on `-f json` output when you
  need to parse.
- **`global.fetch` mock leakage in tests.** Bun's `mock.restore()` does not undo
  a direct `global.fetch = mock(...)` assignment; capture and restore the
  original in `afterEach`, or a leaked 404 mock breaks later files in the suite.

## Troubleshooting

- **`✗ Authentication failed` / `AUTH_FAILED` when driving via a mock**: the SDK
  basePath wasn't redirected — the request went to real `app.asana.com` and got
  401. Make sure you invoked `launch.ts` (not `src/index.ts`) and that
  `ASANA_API_BASE_URL` is exported. If you copied `launch.ts` elsewhere, move it
  back under the project so `asana` resolves to the project's `node_modules`.
- **`file exists` on `>` redirects (zsh)**: this shell has `noclobber`; use
  `>|` or `rm -f` the target first (the driver scripts avoid `>` for this reason).
