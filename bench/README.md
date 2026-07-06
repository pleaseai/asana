# Asana agent-interface benchmark

Measures cost, latency, and success rate when an agent performs the **same Asana
tasks** with the **same model and prompts**, changing only the tool interface:

| condition        | interface                                                                         | tool surface                             |
| ---------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| `cli`            | this repo's `asana` CLI (AXI-style, TOON default output)                          | `Bash(asana:*)`                          |
| `mcp`            | official Asana MCP (`mcp.asana.com/v2/mcp`) + tool search (deferred schemas)      | `mcp__asana`, `ENABLE_TOOL_SEARCH=auto`  |
| `mcp-eager`\*    | same MCP with all schemas loaded upfront (tool search off)                        | `mcp__asana`, `ENABLE_TOOL_SEARCH=false` |
| `executor`       | [executor.sh](https://executor.sh/docs/mcp-proxy) hosted MCP proxy (code-mode)    | `mcp__executor`                          |
| `executor-cli`\* | the same proxy driven through its CLI (`executor tools search` / `executor call`) | `Bash(executor:*)`                       |

`*` variant conditions, excluded from the default run — include them explicitly
via `--conditions`.

Methodology follows Kun Chen's [GitHub CLI vs MCP vs Tool Search vs Code Mode](https://kunchenguid.medium.com/i-benchmarked-github-cli-vs-mcp-vs-tool-search-vs-code-mode-turns-out-the-best-solution-is-none-93528d5039e4)
benchmark, ported to Asana. Controlled variables:

- **Identical prompts** — the only per-condition difference is a single
  system-prompt sentence stating that the interface exists.
- **Isolated runs** — every run gets a fresh empty temp cwd,
  `--setting-sources project`, and `--strict-mcp-config`, so user hooks,
  memory, global CLAUDE.md, and unrelated MCP servers cannot contaminate the
  measurement.
- **Separate ground truth** — fixture setup and verification call the Asana
  REST API directly (`bench/src/asana.ts`), never the interface under test.
- **State-based success** — verified against actual Asana state, not the
  agent's claim of success.

## Tasks

| id             | shape                                                       | verification                      |
| -------------- | ----------------------------------------------------------- | --------------------------------- |
| `read_lookup`  | single read — find a task by name, report its due date      | seeded date appears in the answer |
| `write_create` | single write — create a task with name, due date, notes     | field match via REST              |
| `multi_step`   | chained — complete one of three tasks, add a comment        | completed flag + story exist      |
| `aggregate`    | scan — count incomplete tasks by assignment, answer as JSON | JSON matches expected counts      |

Each run seeds tasks under a unique prefix (`BM-xxxxx`) and deletes every
prefixed task (including agent-created ones) on completion.

## Prerequisites

1. **asana CLI** — `brew install pleaseai/tap/asana-cli`, then
   `asana auth login --token <PAT>`. The ground-truth client reuses the token
   from `~/.asana-cli/config.json` (or `ASANA_ACCESS_TOKEN`).
2. **Asana MCP OAuth** — authenticate interactively once so headless runs can
   reuse the token: `claude mcp add --transport http asana https://mcp.asana.com/v2/mcp`,
   then log in via `/mcp` inside a `claude` session.
3. **executor** — `claude mcp add --transport http executor https://executor.sh/<your-org>/mcp`
   (or `npx add-mcp`), then authenticate once via `/mcp`. Connect and
   authenticate the Asana source in the executor.sh console beforehand.
   Set the mutation policy to "always allow" — an approval gate pauses
   headless runs (see caveats). Only the `executor-cli` variant needs the
   local `executor` CLI installed.
4. A logged-in `claude` CLI.

## Running

```bash
# default: cli, mcp, executor × 4 tasks × 3 runs
bun bench/src/run.ts

# pick conditions/tasks/repetitions/model
bun bench/src/run.ts --conditions cli,mcp,mcp-eager,executor \
  --tasks read_lookup,aggregate --runs 5 --model claude-sonnet-5

# reuse the project created by the first run; preview without spending
bun bench/src/run.ts --project 12345 --dry-run
```

Options: `--workspace <gid>` (default: first workspace), `--project <gid>`
(default: create a new bench project), `--max-turns` (40), `--timeout-min`
(10), `--keep-tasks` (skip cleanup), `--session <tag>`.

Per-run records land in `bench/results/<session>.jsonl`; a report prints when
the run finishes. Regenerate reports any time:

```bash
bun bench/src/report.ts                       # all of results/
bun bench/src/report.ts bench/results/x.jsonl # one session
```

## Metrics

Extracted from the `claude -p --output-format stream-json` transcript:
success rate (ground-truth verified), `total_cost_usd`,
`duration_ms`/`duration_api_ms`, `num_turns`, tool-call counts by name, and
token breakdown (input / output / cache read / cache creation). Reports show
per-condition × per-task medians.

## Example results (2026-07-06, sonnet, 48 runs)

| condition   | success | cost (med) | time (med) | turns | tool calls |
| ----------- | ------- | ---------- | ---------- | ----- | ---------- |
| `mcp-eager` | 100%    | **$0.151** | **16.4s**  | **4** | 3          |
| `cli`       | 100%    | $0.185     | 44.9s      | 11.5  | 10.5       |
| `mcp`       | 100%    | $0.217     | 19.7s      | 5     | 4          |
| `executor`  | 83%¹    | $0.416     | 52.2s      | 12.5  | 11.5       |

¹ failures were executor's approval policy pausing mutations in a headless
session (in one run the agent approved itself via `resume`).

The CLI was cheapest-or-close on simple read/write tasks but degraded on the
scan-style `aggregate` task ($0.350, 80.5s, 21 turns vs mcp-eager's $0.152,
16.7s, 4 turns) because `task list` output lacks field expansion and
aggregation — see [#88](https://github.com/pleaseai/asana/issues/88).

## Known caveats

- `ENABLE_TOOL_SEARCH` behavior can vary across Claude Code versions. If `mcp`
  and `mcp-eager` results do not diverge, first verify the toggle applies on
  your version.
- Bash-based conditions (`cli`, `executor-cli`) include Claude Code's bash
  command-inspection overhead. That is harness tax, but identical to real
  usage, so it is measured as-is (same observation as Mario Zechner's
  benchmark).
- Runs execute sequentially, so time-of-day API latency drift can mix in.
  Repetitions (`--runs`) sit on the outermost loop to spread it.
- `aggregate` is judged by parsing the answer text; if the model ignores the
  JSON format instruction the run counts as a failure even when the counts are
  right.
- executor's approval policies interact badly with headless sessions: the
  agent either stalls asking for confirmation, or bypasses the gate itself by
  calling `resume`. Set benchmark-scoped tools to "always allow".
