# Asana CLI

[![CI](https://github.com/pleaseai/asana/actions/workflows/ci.yml/badge.svg)](https://github.com/pleaseai/asana/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/pleaseai/asana/branch/main/graph/badge.svg)](https://codecov.io/gh/pleaseai/asana)
[![npm version](https://img.shields.io/npm/v/@pleaseai/asana)](https://www.npmjs.com/package/@pleaseai/asana)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@pleaseai/asana)](https://socket.dev/npm/package/@pleaseai/asana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=pleaseai_asana&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=pleaseai_asana)

Manage your Asana tasks efficiently from the command line.

> **English** | [한국어](./README.ko.md)

## Features

- ✅ OAuth 2.0 and Personal Access Token authentication
- ✅ Create, list, complete, and delete tasks
- ✅ Automatic token refresh (OAuth)
- ✅ Default workspace configuration
- ✅ File attachments (upload, list, download)
- ✅ Custom fields (text, number, enum)
- ✅ Batch operations from JSON/CSV files
- ✅ Workspace-wide task and project search
- ✅ Fast execution powered by Bun
- ✨ **Multiple output formats** (TOON, JSON, Plain) for different use cases

## Quick Installation

### Homebrew (macOS/Linux - Recommended)

```bash
brew install pleaseai/tap/asana-cli
```

### npm (Node.js)

```bash
npm install -g @pleaseai/asana
# or run without installing
npx @pleaseai/asana --help
```

npm installs the prebuilt binary matching your platform (macOS/Linux, x64/arm64); no Bun runtime is required.

### Install Script (All Platforms)

```bash
curl -fsSL https://raw.githubusercontent.com/pleaseai/asana/main/scripts/install.sh | bash
```

**Note:** Add `~/.local/bin` to your PATH if needed.

### From Source

```bash
git clone https://github.com/pleaseai/asana.git
cd asana
bun install
bun run dev --help
```

## Quick Start

### Authenticate

```bash
# Using Personal Access Token (recommended)
asana auth login --token YOUR_TOKEN

# Using OAuth 2.0
asana auth login
```

### Manage Tasks

```bash
# Create a task
asana task create -n "New task" -w WORKSPACE_ID

# List your tasks
asana task list -a me -w WORKSPACE_ID

# Complete a task
asana task complete TASK_ID
```

### Direct API Access

Call any Asana REST endpoint directly, like `gh api` — an escape hatch for
endpoints not covered by the typed commands. Responses use the same
`--format` (TOON/JSON/plain) as every other command.

```bash
# GET the authenticated user
asana api /users/me

# GET with query parameters (added to the query string for GET/HEAD)
asana api /tasks/TASK_ID -F opt_fields=name,completed

# Create a task (a body switches the default method to POST)
# Asana wraps writes in a `data` envelope — supply it via --input (raw passthrough).
echo '{"data":{"name":"New task","workspace":"WORKSPACE_ID"}}' \
  | asana api /tasks --input -

# Update a task (PUT/PATCH bodies need the data envelope too)
echo '{"data":{"name":"Renamed","completed":true}}' \
  | asana api /tasks/TASK_ID -X PUT --input -

# Include the HTTP status and headers in the output
asana api /users/me -i
```

Flags: `-X/--method` (default GET, or POST when a body is present),
`--raw-field key=value` (string), `-F/--field key=value`
(typed — `true`/`false`/`null`/number parsed), `--input <file|->` (raw body,
no envelope wrapping), `-H/--header key:value`, `-i/--include`.
Fields (`--raw-field`/`-F`) become query parameters for GET/HEAD and a flat JSON
body otherwise; because writes are raw passthrough (no `data` wrapping), send
write bodies via `--input`. The string-field flag is the long `--raw-field`
because the global `-f` is `--format`.

### Output Formats

Choose output format based on your needs:

```bash
# TOON format (default) - 30-60% more token-efficient for LLMs
asana task list -a me

# JSON format - for scripts and automation
asana task list -a me --format json

# Plain format - traditional human-readable output
asana task list -a me --format plain
```

**Format Comparison:**

| Format    | Use Case                          | Token Efficiency | Machine Readable |
| --------- | --------------------------------- | ---------------- | ---------------- |
| **TOON**  | LLM interactions, sharing outputs | ⭐⭐⭐⭐⭐       | ✅               |
| **JSON**  | Scripts, automation, parsing      | ⭐⭐⭐           | ✅               |
| **Plain** | Terminal viewing, traditional CLI | ⭐⭐             | ❌               |

<details>
<summary>📊 Example Outputs</summary>

**TOON Format** (default):

```
tasks[3]{gid,name,completed}:
  "1234567890",Setup authentication,true
  "1234567891",Add task commands,false
  "1234567892",Write documentation,false
```

**JSON Format**:

```json
{
  "tasks": [
    { "gid": "1234567890", "name": "Setup authentication", "completed": true },
    { "gid": "1234567891", "name": "Add task commands", "completed": false },
    { "gid": "1234567892", "name": "Write documentation", "completed": false }
  ]
}
```

**Plain Format**:

```
Tasks (3):

✓ 1234567890 - Setup authentication
○ 1234567891 - Add task commands
○ 1234567892 - Write documentation
```

</details>

## Documentation

**[📖 Full Documentation](https://asana.pleaseai.dev/)**

- [Getting Started](https://asana.pleaseai.dev/en/guide/getting-started) - Installation and setup
- [Quick Start](https://asana.pleaseai.dev/en/guide/quick-start) - Basic commands and workflows
- [Authentication](https://asana.pleaseai.dev/en/features/authentication) - OAuth and PAT setup
- [Task Management](https://asana.pleaseai.dev/en/features/task-management) - Full task operations
- [Configuration](https://asana.pleaseai.dev/en/features/configuration) - Advanced settings

## Updating

### Homebrew

```bash
brew upgrade asana-cli
```

### Install Script

```bash
asana self-update
```

## Development

```bash
# Clone and install
git clone https://github.com/pleaseai/asana.git
cd asana
bun install

# Run in development mode
bun run dev auth login --token YOUR_TOKEN

# Run tests
bun test

# Build executable
bun run build
```

For detailed development guides, see [dev-docs/](./dev-docs/).

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **SDK**: [Asana Node.js SDK](https://github.com/Asana/node-asana)
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **Output Format**: [TOON](https://github.com/johannschopplich/toon) - Token-efficient format for LLMs
- **Styling**: [Chalk](https://github.com/chalk/chalk)

## License

MIT

## Author

Minsu Lee ([@amondnet](https://github.com/amondnet))
