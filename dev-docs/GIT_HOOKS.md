# Git Hooks

This repo uses [`hk`](https://hk.jdx.dev) to manage git hooks. The only hook
configured today validates markdown links with
[`markdown-link-check`](https://github.com/tcort/markdown-link-check) before each
commit.

## What runs

- **pre-commit** — runs `markdown-link-check` on staged `*.md` files only and
  blocks the commit if any link is dead. `CHANGELOG.md` (auto-generated) and
  `node_modules/**` are excluded.

Config lives in:

- `hk.pkl` — hook/step definitions
- `.markdown-link-check.json` — link-check behavior (timeouts, 429 retries,
  ignored hosts, User-Agent)

## One-time setup

`markdown-link-check` is provisioned by mise; `hk` must be installed separately
because it ships no `darwin/amd64` (Intel Mac) binary.

```bash
# 1. tools (node, bun, markdown-link-check)
mise trust && mise install

# 2. install hk itself
mise use -g hk      # linux / Apple Silicon
# or, on Intel Mac:
brew install hk

# 3. wire the git hooks into .git/hooks
hk install
```

> The pre-commit hook lives in `.git/hooks/` and is **not** committed, so every
> fresh clone must run `hk install` once.

## Useful commands

```bash
mise run lint:links        # check links in ALL markdown files
hk check --all             # same as above (the underlying command)
hk run pre-commit          # run the pre-commit hook on staged files manually
git commit --no-verify ...  # bypass the hook in an emergency
```
