# ADR-002: TOON Output Format for CLI

## Status

Proposed

## Date

2025-10-30

## Context

The Asana CLI currently outputs data in plain text format using direct `console.log()` calls with Chalk for coloring. This approach has several limitations:

1. **No Structured Output**: Output is purely human-readable text, making it difficult for scripts or other tools to parse and consume the CLI output programmatically
2. **Token Inefficiency**: When users share CLI output with LLMs (for debugging, automation, or assistance), the plain text format consumes more tokens than necessary
3. **Limited Flexibility**: There's no way to switch output formats based on use case (human vs. machine consumption)
4. **No Format Abstraction**: Output logic is tightly coupled with command implementations, making it hard to maintain consistent formatting across commands

### Use Cases Requiring Better Output Format

1. **LLM Interactions**: Users frequently share CLI output with LLMs for assistance. Token-efficient formats reduce costs and improve context usage.
2. **Script Integration**: Automation scripts need structured data (JSON) to parse and process CLI output
3. **Human Readability**: Interactive use still requires readable, well-formatted output
4. **Logging and Monitoring**: Structured formats enable better log aggregation and analysis

### Current Implementation

- All output uses `console.log()` with Chalk for colors
- No output format abstraction layer
- Commands directly render output in their handlers
- No support for `--format` flags
- Files affected: `src/commands/task.ts`, `src/commands/auth.ts`

## Decision Drivers

- **Token Efficiency**: Reduce token consumption when sharing output with LLMs
- **Flexibility**: Support multiple output formats for different use cases
- **Maintainability**: Separate presentation logic from business logic
- **Backward Compatibility**: Maintain similar visual output for existing users
- **Standards Alignment**: Follow project standards (TDD, small changes, clear abstractions)

## Considered Options

### Option 1: JSON Only

**Pros:**
- Universal standard, widely supported
- Easy to parse programmatically
- Simple implementation

**Cons:**
- Token-inefficient for LLM interactions (verbose, repetitive keys)
- Less human-readable in terminal
- No improvement for current users

### Option 2: YAML

**Pros:**
- More readable than JSON
- Indentation-based structure
- Supports comments

**Cons:**
- Still token-inefficient (repeating keys in arrays)
- Parsing more complex than JSON
- Not specifically designed for LLMs

### Option 3: TOON (Token-Oriented Object Notation)

**Pros:**
- **30-60% fewer tokens than JSON** (designed for LLM efficiency)
- Tabular format for arrays (declare fields once, stream rows)
- Maintains readability with indentation-based structure
- Bidirectional conversion (TOON ↔ JSON)
- Explicit length markers help LLMs track structure
- Active development and maintenance

**Cons:**
- Less familiar format (newer standard)
- Smaller ecosystem than JSON
- Requires dependency (`@byjohann/toon`)

### Option 4: TOON as Primary + JSON Support (Selected)

**Pros:**
- Best token efficiency (TOON default)
- Flexibility via `--format` flag for different use cases
- Maintains programmatic access (JSON option)
- Similar visual appearance to current plain text output
- Clear migration path

**Cons:**
- More implementation complexity (multiple formatters)
- Need to maintain both formats
- Users need to learn TOON format (optional)

## Decision

We will implement **Option 4: TOON as Primary + JSON Support** with the following design:

### Architecture

```typescript
// src/utils/formatter.ts
export type OutputFormat = 'toon' | 'json' | 'plain'

export interface FormatterOptions {
  format: OutputFormat
  colors: boolean  // Enable/disable colors (auto-detect TTY)
}

export function formatOutput(data: any, options: FormatterOptions): string {
  switch (options.format) {
    case 'toon':
      return encode(data, { indent: 2, delimiter: ',' })
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'plain':
      return formatPlainText(data, options.colors)
  }
}
```

### CLI Integration

```bash
# Global --format flag (all commands)
asana task list --format toon    # Default
asana task list --format json    # For scripting
asana task list --format plain   # Legacy output

# Short flag alias
asana task list -f json
```

### Output Examples

**Task List (TOON format - default):**
```
tasks[3]{gid,name,completed}:
  1234567890,Setup authentication,true
  1234567891,Add task commands,false
  1234567892,Write documentation,false
```

**Task List (JSON format - for scripting):**
```json
{
  "tasks": [
    { "gid": "1234567890", "name": "Setup authentication", "completed": true },
    { "gid": "1234567891", "name": "Add task commands", "completed": false },
    { "gid": "1234567892", "name": "Write documentation", "completed": false }
  ]
}
```

**Task List (Plain format - legacy):**
```
Tasks (3):

✓ 1234567890 - Setup authentication
○ 1234567891 - Add task commands
○ 1234567892 - Write documentation
```

### TOON Configuration

- **Indent**: 2 spaces (consistent with project style)
- **Delimiter**: Comma (`,`) - most readable, standard
- **Length Markers**: Enabled (`[N]`) - helps LLMs track structure
- **Encoding**: UTF-8

### Implementation Phases

**Phase 1: Foundation (Week 1)**
1. Add `@byjohann/toon` dependency
2. Create `src/utils/formatter.ts` with format abstraction
3. Add global `--format` flag to CLI
4. Write comprehensive tests for formatter

**Phase 2: Command Migration (Week 2)**
1. Refactor `task list` command (highest impact)
2. Refactor `task get` command
3. Refactor `auth whoami` command
4. Refactor `task create` command

**Phase 3: Polish (Week 3)**
1. Update documentation and README
2. Add format detection (TTY vs pipe)
3. Performance optimization
4. User feedback integration

## Consequences

### Positive

- **Token Efficiency**: 30-60% reduction in tokens when sharing output with LLMs
- **Flexibility**: Users can choose format based on use case
- **Better Architecture**: Clean separation of data and presentation
- **Script Support**: JSON format enables automation and integration
- **Maintainability**: Centralized formatting logic easier to test and modify
- **Future-Proof**: Easy to add more formats if needed

### Negative

- **Learning Curve**: Users need to understand TOON format (though it's intuitive)
- **Dependency**: Adds `@byjohann/toon` package (~50KB)
- **Migration Effort**: Need to refactor all command output logic
- **Testing Overhead**: Need to test multiple output formats
- **Documentation**: More options to document

### Neutral

- **Breaking Changes**: None - plain format maintains current output
- **Performance**: Minimal impact (formatting is fast)
- **Bundle Size**: +50KB for TOON library (acceptable for CLI)

## Implementation Guidelines

### Following Project Standards

**TDD Approach (dev-docs/TDD.md):**
1. Write formatter tests first (Red)
2. Implement formatter (Green)
3. Refactor command to use formatter (Refactor)
4. Commit after each command migration

**Code Standards (dev-docs/STANDARDS.md):**
- Keep formatter.ts under 300 LOC
- Functions under 50 LOC
- No more than 5 parameters
- Separate structural and behavioral changes

**Testing Standards (dev-docs/TESTING.md):**
- Test all three formats (TOON, JSON, plain)
- Test edge cases: empty arrays, null values, nested objects
- Use AAA pattern (Arrange-Act-Assert)
- Mock external dependencies

### Code Quality Checklist

- [ ] Formatter utility is pure function (no side effects)
- [ ] Each format tested independently
- [ ] Colors only in plain format (TOON/JSON must be parseable)
- [ ] Error messages go to stderr consistently
- [ ] TTY detection for automatic format selection
- [ ] Documentation updated with format examples
- [ ] Migration guide for users

## References

- [TOON Repository](https://github.com/johannschopplich/toon) - Token-Oriented Object Notation
- [TOON npm Package](https://www.npmjs.com/package/@byjohann/toon) - Official implementation
- [Project Standards](../STANDARDS.md) - Coding and testing standards
- [TDD Guidelines](../TDD.md) - Test-driven development approach
- [Testing Best Practices](../TESTING.md) - Testing methodology

## Related Issues

- #TBD: Implement TOON Output Format

## Notes

- Consider adding YAML format if user demand increases
- Monitor token savings metrics after deployment
- Collect user feedback on TOON format readability
- TOON format may become more widely adopted in LLM tooling ecosystem
- Keep `plain` format as permanent option for backward compatibility
