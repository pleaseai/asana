# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@dev-docs/STANDARDS.md
@dev-docs/commit-convention.md
@dev-docs/TESTING.md
@dev-docs/TDD.md

## Documentation Structure

- **docs/**: Documentation app files (user-facing documentation)
- **dev-docs/**: Development documentation (technical documentation for developers)

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { expect, test } from 'bun:test'

test('hello world', () => {
  expect(1).toBe(1)
})
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from './index.html'

Bun.serve({
  routes: {
    '/': index,
    '/api/users/:id': {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }))
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send('Hello, world!')
    },
    message: (ws, message) => {
      ws.send(message)
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from 'react'

import { createRoot } from 'react-dom/client'

// import .css files directly and it works
import './index.css'

const root = createRoot(document.body)

export default function Frontend() {
  return <h1>Hello, world!</h1>
}

root.render(<Frontend />)
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## CLI Command Pattern Design

This project uses a **subcommand pattern** for organizing CLI commands, optimized for Claude Code's allowed tools system.

### Command Pattern Philosophy

Use **scope-based subcommands** instead of flat command names:

```bash
# ✅ RECOMMENDED: Subcommand pattern
asana task list
asana task create
asana task complete
asana auth login
asana auth logout

# ❌ AVOID: Flat pattern
asana getTasks
asana createTask
asana completeTask
asana loginAuth
asana logoutAuth
```

### Why Subcommands Work Better with Claude Code

Claude Code's allowed tools use wildcard patterns that map perfectly to subcommands:

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Bash(asana task:*)",     // Allows all task subcommands
      "Bash(asana auth:*)",     // Allows all auth subcommands
      "Bash(asana project:*)"   // Allows all project subcommands
    ]
  }
}
```

**Benefits:**

1. **Scope-based permission control**: Grant access to entire domains (`task`, `auth`) without listing individual commands
2. **Automatic extension support**: New subcommands work immediately without updating permissions
3. **Maintainability**: Add `asana task archive` without modifying `.claude/settings.json`
4. **Standard practice**: Follows conventions used by git, docker, kubectl, gh

### Wildcard Pattern Reference

- `*` (single asterisk): Matches anything at that level
  - `Bash(asana task:*)` → matches `task list`, `task create`, `task delete`
  - `Bash(bun test:*)` → matches `test --watch`, `test --coverage`, etc.

- `**` (double asterisk): Matches multiple directory levels (for file paths)
  - `Read(/path/**)` → matches all files under `/path/` recursively

### Implementation Pattern

```typescript
// src/index.ts
import { Command } from 'commander'
import { createTaskCommand } from './commands/task'
import { createAuthCommand } from './commands/auth'

const program = new Command()
  .name('asana')
  .description('Asana CLI')
  .version('1.0.0')

// Register subcommand groups
program.addCommand(createTaskCommand())    // task list, task create, etc.
program.addCommand(createAuthCommand())    // auth login, auth logout, etc.

program.parse(process.argv)
```

```typescript
// src/commands/task.ts
export function createTaskCommand(): Command {
  const task = new Command('task')
    .description('Manage Asana tasks')

  task
    .command('list')
    .description('List tasks')
    .action(async () => { /* ... */ })

  task
    .command('create')
    .description('Create a new task')
    .action(async () => { /* ... */ })

  return task
}
```

### Best Practices for Adding New Commands

1. **Group by domain**: Create command groups that represent logical scopes
2. **Use descriptive subcommands**: `task complete` is clearer than `task c`
3. **Update permissions sparingly**: When adding a new scope, add one wildcard pattern
4. **Follow naming conventions**: Use kebab-case for multi-word commands (`self-update`, not `selfUpdate`)

### Example: Adding a New Command Scope

```typescript
// src/commands/project.ts
export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Manage Asana projects')

  project
    .command('list')
    .description('List projects')
    .action(async () => { /* ... */ })

  project
    .command('create')
    .description('Create a new project')
    .action(async () => { /* ... */ })

  return project
}
```

Add to `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(asana project:*)"  // One pattern for all project commands
    ]
  }
}
```
