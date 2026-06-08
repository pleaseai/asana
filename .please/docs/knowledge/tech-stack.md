# Tech Stack

> Authoritative technology choices for the Asana CLI. Changes here must precede
> implementation that deviates from the documented stack.

## Runtime & Language

- **Bun** — primary runtime and toolchain (dev, test, build, package manager).
  The project standardizes on Bun over Node.js.
- **TypeScript** (`^5`) — all source code. ESM (`"type": "module"`).

## Core Dependencies

| Package | Purpose |
|---------|---------|
| `commander` (^14) | CLI argument parsing and command structure |
| `asana` (^3.1) | Official Asana API SDK |
| `@pleaseai/cli-toolkit` (^0.2) | Shared CLI utilities (org toolkit) |
| `chalk` (^5) | Terminal colors |
| `open` (^10) | Open URLs/browser (OAuth flow) |
| `@dotenvx/dotenvx` (^1.51) | Encrypted environment variable / secrets management |

## Tooling

| Tool | Purpose |
|------|---------|
| `bun test` | Test runner (unit in `test/`, e2e in `tests/e2e`) |
| `eslint` (^9) + `@antfu/eslint-config` (^6) | Linting and formatting (flat config) |
| `eslint-plugin-format` | Formatting via ESLint |
| `turbo` (^2.5) | Task orchestration |
| `dotenvx` | `env:encrypt` / `env:decrypt`, secure run wrappers |

## Build & Distribution

- **Build**: `bun build src/index.ts --compile --outfile asana` → single compiled binary.
- **Entry point**: `src/index.ts` (bin: `asana`).
- **Distribution**: Homebrew tap (`pleaseai/tap/asana-cli`), install script
  (`scripts/install.sh`), and from-source builds.

## Source Layout

```
src/
├── index.ts          # CLI entry point
├── commands/         # Command handlers: auth, task, project, section, self-update
├── lib/              # Core logic: asana-client, config, error-handler, oauth, validators
├── utils/            # formatter (TOON/JSON/Plain output)
├── constants/        # Shared constants
└── types/            # Shared TypeScript types
```

## Authentication

- **OAuth 2.0** (`src/lib/oauth.ts`) with automatic token refresh.
- **Personal Access Token** (PAT) as the recommended/simple path.
- Default workspace configuration persisted in local config (`src/lib/config.ts`).

## Output Formats

- **TOON** — token-efficient, optimized for LLM/automation consumption.
- **JSON** — machine-readable.
- **Plain** — human-readable terminal output.
- Implemented in `src/utils/formatter.ts`.
