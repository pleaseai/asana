# E2E Testing Guide

This document provides guidance on running and creating end-to-end tests for the Asana CLI.

## Overview

E2E (End-to-End) tests verify that commands work correctly with the actual Asana API. These tests require valid Asana credentials and are skipped in CI by default.

## Current Test Coverage

### Unit Tests (119 tests)
- ✅ Command structure and options
- ✅ Validation logic
- ✅ Configuration management
- ✅ Output formatting
- ✅ Authentication patterns

**Coverage**: ~54% functions, ~45% lines

### E2E Tests (Manual)
- ⚠️ Require Asana credentials
- ⚠️ Skipped in automated CI
- ✅ Test actual API integration

## Running E2E Tests

### Prerequisites

1. **Asana Access Token**: Get from https://app.asana.com/0/developer-console
2. **Workspace ID**: Find in your Asana workspace URL

### Setup Environment

Create a `.env` file with your credentials:

```bash
ASANA_ACCESS_TOKEN=your_access_token_here
ASANA_WORKSPACE=your_workspace_id_here
```

Or set environment variables:

```bash
export ASANA_ACCESS_TOKEN=your_access_token_here
export ASANA_WORKSPACE=your_workspace_id_here
```

### Run E2E Tests

```bash
# Run all E2E tests
bun test tests/e2e/

# Run specific E2E test file
bun test tests/e2e/asana-api.test.ts
bun test tests/e2e/cli-commands.test.ts
```

## Manual Testing for Phase 1 Commands

### Task Update Command

```bash
# 1. Create a test task
bun run dev task create -n "Test Update Command" -w $ASANA_WORKSPACE
# Note the task GID from output

# 2. Update task name
bun run dev task update TASK_GID --name "Updated Task Name"

# 3. Update task notes
bun run dev task update TASK_GID --notes "Added detailed description"

# 4. Update assignee (use your user GID or "me")
bun run dev task update TASK_GID --assignee USER_GID

# 5. Update due date
bun run dev task update TASK_GID --due-on 2025-12-31

# 6. Update start date
bun run dev task update TASK_GID --start-on 2025-11-01

# 7. Mark as complete
bun run dev task update TASK_GID --completed true

# 8. Mark as incomplete
bun run dev task update TASK_GID --completed false

# 9. Update multiple fields
bun run dev task update TASK_GID \
  --name "Final Update" \
  --notes "All fields updated" \
  --due-on 2025-12-15

# 10. Verify changes
bun run dev task get TASK_GID

# 11. Clean up
bun run dev task delete TASK_GID
```

### Task Move Command

```bash
# Prerequisites: Get PROJECT_ID from your Asana workspace
# You can list projects via the Asana web UI or API

# 1. Create a test task in one project
bun run dev task create \
  -n "Test Move Command" \
  -p PROJECT_1_GID \
  -w $ASANA_WORKSPACE
# Note the task GID

# 2. Move task to different project
bun run dev task move TASK_GID --project PROJECT_2_GID

# 3. Verify move
bun run dev task get TASK_GID
# Check that projects array shows new project

# 4. Move to project and specific section
bun run dev task move TASK_GID \
  --project PROJECT_2_GID \
  --section SECTION_GID

# 5. Verify section placement
bun run dev task get TASK_GID

# 6. Clean up
bun run dev task delete TASK_GID
```

## Test Output Formats

Test all three output formats to ensure consistency:

```bash
# TOON format (default)
bun run dev task get TASK_GID --format toon

# JSON format
bun run dev task get TASK_GID --format json

# Plain format
bun run dev task get TASK_GID --format plain
```

## Expected Behaviors

### Task Update

**Success Criteria**:
- ✅ Command returns updated task details
- ✅ Changes persist when fetching task again
- ✅ Only specified fields are updated
- ✅ Other fields remain unchanged
- ✅ All output formats work correctly

**Error Handling**:
- ❌ Non-existent task GID shows error
- ❌ Invalid date format shows error
- ❌ No fields specified shows error

### Task Move

**Success Criteria**:
- ✅ Task appears in new project
- ✅ Task removed from old project(s)
- ✅ Section placement works when specified
- ✅ Task properties preserved during move
- ✅ All output formats work correctly

**Error Handling**:
- ❌ Non-existent task GID shows error
- ❌ Non-existent project GID shows error
- ❌ Non-existent section GID shows error

## Why Low Test Coverage?

The test coverage shows ~12% for `task.ts` because:

1. **Unit tests focus on structure**: Testing command options, arguments, and configuration
2. **Action functions not executed**: The actual command logic runs only with real Asana API calls
3. **Mock complexity**: Mocking Commander.js + Asana client + async actions is complex
4. **E2E tests preferred**: Real API integration tests provide better confidence

This is **intentional and acceptable** because:
- Structure tests catch configuration errors
- E2E tests verify actual behavior
- Code follows established patterns (consistent with existing commands)
- Manual testing validates functionality

## Improving Test Coverage (Future)

To increase coverage without E2E tests:

### Option 1: Mock-based Integration Tests
- Create comprehensive mocks for Asana client
- Test command action functions directly
- **Trade-off**: Complex mocks may not reflect real behavior

### Option 2: Contract Testing
- Use recorded API responses (VCR pattern)
- Replay responses in tests
- **Trade-off**: Requires maintaining fixtures

### Option 3: Expanded E2E Tests
- Run E2E tests in CI with test workspace
- Use GitHub Secrets for credentials
- **Trade-off**: Slower CI, API rate limits

## Current Recommendation

For Phase 1, the current approach is sufficient:

1. ✅ **Unit tests**: Validate command structure (119 tests)
2. ✅ **Manual testing**: Verify actual behavior with real API
3. ✅ **Code review**: Ensure patterns match existing code
4. ⏳ **E2E automation**: Consider for future phases

## Related Documentation

- [TESTING.md](TESTING.md) - Testing philosophy and best practices
- [TDD.md](TDD.md) - Test-Driven Development workflow
- [STANDARDS.md](STANDARDS.md) - Code quality standards
