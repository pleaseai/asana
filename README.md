# Asana CLI

[![CI](https://github.com/pleaseai/asana/actions/workflows/ci.yml/badge.svg)](https://github.com/pleaseai/asana/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/pleaseai/asana/branch/main/graph/badge.svg)](https://codecov.io/gh/pleaseai/asana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Manage your Asana tasks efficiently from the command line.

## Features

- ✅ OAuth 2.0 and Personal Access Token authentication
- ✅ Create, list, complete, and delete tasks
- ✅ Automatic token refresh (OAuth)
- ✅ Default workspace configuration
- ✅ Fast execution powered by Bun

## Quick Installation

### Homebrew (macOS/Linux - Recommended)

```bash
brew install pleaseai/tap/asana-cli
```

### Install Script (All Platforms)

```bash
curl -fsSL https://raw.githubusercontent.com/pleaseai/asana/main/scripts/install.sh | sh
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
- **Styling**: [Chalk](https://github.com/chalk/chalk)

## License

MIT

## Author

Minsu Lee ([@amondnet](https://github.com/amondnet))
