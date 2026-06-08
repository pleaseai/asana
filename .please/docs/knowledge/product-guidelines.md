# Product Guidelines

> Branding, UX, and style conventions for the Asana CLI. Consulted during implementation
> and review.

## CLI UX Principles

- **Predictable command structure**: `asana <resource> <action> [options]`
  (e.g. `asana task create`, `asana project list`). Resources: `auth`, `task`,
  `project`, `section`, `self-update`.
- **Composable & scriptable**: every command must be usable non-interactively. Avoid
  prompts in scripted paths; accept all required input via flags.
- **Machine-readable by choice**: support `--format toon|json|plain`. Default to
  `toon` (token-efficient, LLM-friendly); allow explicit `json`/`plain` selection for
  scripting and human reading.
- **Fast feedback**: keep startup and execution snappy; defer heavy work until needed.

## Output & Messaging

- Use **chalk** for color, but degrade gracefully when output is not a TTY (no color
  codes in piped/JSON output).
- Success and error messages are concise, actionable, and written in clear English.
- Errors are routed through a central error handler (`src/lib/error-handler.ts`) and
  present a clear user-facing message — never a raw stack trace by default.
- Exit codes are meaningful: `0` on success, non-zero on failure.

## Branding

- Product name: **Asana CLI** (binary: `asana`).
- License: MIT. Maintained under the `pleaseai` GitHub org.
- Documentation is bilingual where it matters (English primary, Korean `README.ko.md`).

## Security & Privacy

- **Never log secrets** (tokens, OAuth codes). Use dotenvx-encrypted `.env.secrets`.
- Validate and normalize all user input (`src/lib/validators.ts`).
- Store credentials in the user's local config, not in the repository.

## Code Style

- Follow **@antfu/eslint-config** (ESLint flat config in `eslint.config.js`).
- TypeScript throughout; prefer explicit, intention-revealing names.
- Keep commands thin — push reusable logic into `src/lib/` and `src/utils/`.
