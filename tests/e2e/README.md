# E2E Tests for Asana CLI

This directory contains end-to-end tests that interact with the real Asana API.

## Prerequisites

1. **Asana Personal Access Token (PAT)**
   - Get your PAT from: https://app.asana.com/0/my-apps

2. **Asana Workspace GID**
   - You need a workspace where you can create and delete test tasks
   - Find your workspace GID by running: `bun run src/index.ts workspace list`

## Setup

1. **Create `.env` file:**

   ```bash
   cp .env.example .env
   ```

2. **Add your credentials to `.env`:**

   ```env
   ASANA_ACCESS_TOKEN=your_token_here
   ASANA_WORKSPACE=your_workspace_gid
   ```

3. **Optional: Encrypt your environment (recommended):**
   ```bash
   bun run env:encrypt
   ```

## Running Tests

### Run all E2E tests:

```bash
bun test:e2e
```

### Run with encrypted environment:

```bash
bun test:e2e:secure
```

### Run specific test file:

```bash
bun test tests/e2e/asana-api.test.ts
bun test tests/e2e/cli-commands.test.ts
```

### Run with verbose output:

```bash
bun test tests/e2e --verbose
```

## Test Structure

### `asana-api.test.ts`

Tests direct API integration through the Asana client:

- Task creation (basic, with due date, with assignee)
- Task retrieval (get by GID, list tasks)
- Task updates (name, completion status, notes)
- Task deletion
- Workspace operations (get user, list workspaces)
- Error handling (invalid GIDs)

### `cli-commands.test.ts`

Tests CLI command functionality:

- `task create` command
- `task list` command
- `task get` command
- `task complete` command
- `task delete` command
- Environment variable support

### `helpers.ts`

Shared test utilities:

- Environment setup
- Test task creation/cleanup
- Client configuration

## Important Notes

1. **Real API Calls**: These tests make real API calls to Asana
2. **Test Data**: Tests create tasks prefixed with `[E2E Test]` for easy identification
3. **Cleanup**: Tests automatically clean up created tasks in `afterAll` hooks
4. **Rate Limits**: Be mindful of Asana API rate limits when running tests frequently
5. **Workspace**: Use a test workspace to avoid polluting production data

## CI/CD Integration

For CI/CD environments:

1. Set `DOTENV_KEY` as a secret:

   ```yaml
   - name: Run E2E tests
     env:
       DOTENV_KEY: ${{ secrets.DOTENV_KEY }}
     run: bun test:e2e:secure
   ```

2. Or set individual environment variables:
   ```yaml
   - name: Run E2E tests
     env:
       ASANA_ACCESS_TOKEN: ${{ secrets.ASANA_ACCESS_TOKEN }}
       ASANA_WORKSPACE: ${{ secrets.ASANA_WORKSPACE }}
     run: bun test:e2e
   ```

## Troubleshooting

### "ASANA_ACCESS_TOKEN is required"

- Ensure `.env` file exists with valid `ASANA_ACCESS_TOKEN`
- Check that you're running tests from the project root

### "ASANA_WORKSPACE is required"

- Add `ASANA_WORKSPACE` to your `.env` file
- Get workspace GID from Asana or use `workspace list` command

### API Rate Limit Errors

- Wait a few minutes before running tests again
- Consider reducing the number of test iterations

### Tests failing due to permissions

- Ensure your PAT has sufficient permissions in the workspace
- Verify you have permission to create/delete tasks in the workspace
