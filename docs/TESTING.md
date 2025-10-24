# Testing Documentation

This document provides information about the test suite for the Asana CLI project.

## Running Tests

### Run all tests

```bash
bun test
```

### Run tests in watch mode

```bash
bun test --watch
```

### Run tests with npm script

```bash
bun run test
```

## Test Structure

The test suite is organized in a separate `test/` directory that mirrors the source code structure:

```
src/
├── lib/
│   ├── config.ts
│   └── oauth.ts
├── commands/
│   ├── auth.ts
│   └── task.ts
└── types/
    └── index.ts

test/
├── lib/
│   ├── config.test.ts      # Tests for config module
│   └── oauth.test.ts       # Tests for OAuth module
└── commands/
    └── (future command tests)
```

## Test Coverage

### Config Module (`test/lib/config.test.ts`)

Tests the configuration management functionality:

- **ensureConfigDir**: Directory creation and existence checks
- **saveConfig**: Saving PAT and OAuth configurations
- **loadConfig**: Loading configurations and error handling
- **getAccessToken**: Token retrieval from config and environment variables

**Test cases (12 tests)**:
- Directory creation when it doesn't exist
- Handling existing directories
- Saving different configuration types (PAT, OAuth)
- Overwriting existing configurations
- Loading valid and invalid configurations
- Token prioritization (config vs environment)
- Fallback behavior when no token is available

### OAuth Module (`test/lib/oauth.test.ts`)

Tests the OAuth authentication flow:

- **refreshAccessToken**: Token refresh functionality
- **startOAuthFlow**: OAuth flow initialization

**Test cases (12 tests)**:
- Successful token refresh
- Handling missing credentials
- Error handling for failed refreshes
- Network error handling
- Request parameter validation
- Header validation
- OAuth flow error cases

## Test Utilities

### Temporary Test Data

Tests use temporary directories to avoid affecting real configuration:

```typescript
const TEST_CONFIG_DIR = join(tmpdir(), `asana-cli-test-${process.pid}`)
```

### Cleanup

All tests include proper cleanup in `beforeEach` and `afterEach` hooks:
- Removes temporary directories
- Clears environment variables
- Resets mocked functions

## Writing New Tests

When adding new tests, follow these guidelines:

### 1. File Naming

Test files should be named `*.test.ts` and placed in the `test/` directory mirroring the source structure:

```
src/lib/feature.ts
test/lib/feature.test.ts
```

### 2. Test Structure

Use the `describe` and `test` pattern from Bun's test framework:

```typescript
import { describe, expect, test } from 'bun:test'

describe('feature module', () => {
  describe('function name', () => {
    test('describes what it should do', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = myFunction(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### 3. Setup and Teardown

Use `beforeEach` and `afterEach` for setup and cleanup:

```typescript
import { afterEach, beforeEach, describe, test } from 'bun:test'

describe('feature', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  test('test case', () => {
    // Test implementation
  })
})
```

### 4. Mocking

When mocking is necessary, use Bun's built-in `mock` function:

```typescript
import { mock, test } from 'bun:test'

test('mocking example', () => {
  const mockFn = mock(() => 'mocked result')

  expect(mockFn()).toBe('mocked result')
  expect(mockFn).toHaveBeenCalled()
})
```

### 5. Async Tests

For async operations, use `async/await`:

```typescript
test('async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

### 6. Error Handling

Test both success and error cases:

```typescript
test('handles errors gracefully', async () => {
  await expect(functionThatThrows()).rejects.toThrow('Expected error message')
})
```

## Test Coverage Goals

- **Unit Tests**: Test individual functions and modules in isolation
- **Integration Tests**: Test how modules work together (future)
- **Edge Cases**: Test boundary conditions and error scenarios
- **Happy Path**: Test normal operation flows

## Continuous Integration

Tests are run automatically in CI/CD pipelines. Ensure all tests pass before submitting pull requests.

## Debugging Tests

### Run specific test file

```bash
bun test test/lib/config.test.ts
```

### Enable verbose output

```bash
bun test --verbose
```

### Debug with console output

Add `console.log` statements in tests for debugging:

```typescript
test('debug example', () => {
  const value = someFunction()
  console.log('Debug value:', value)
  expect(value).toBe('expected')
})
```

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use descriptive names**: Test names should clearly state what is being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up resources**: Always clean up in `afterEach` hooks
5. **Avoid test interdependence**: Tests should be able to run in any order
6. **Test edge cases**: Include tests for error conditions and boundary values
7. **Mock external dependencies**: Use mocks for external APIs and file system operations
8. **Keep tests fast**: Tests should run quickly to encourage frequent testing

## Future Improvements

- Add integration tests for command execution
- Increase code coverage to 80%+
- Add E2E tests for CLI commands
- Set up code coverage reporting
- Add performance benchmarks
