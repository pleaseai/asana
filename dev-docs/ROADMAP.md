# Asana CLI Feature Roadmap

This document outlines the comprehensive feature enhancement plan for the Asana CLI, organized into six phases over a 12-week timeline.

## Current Status

The Asana CLI currently supports basic task operations:
- ✅ Task creation
- ✅ Task listing (by assignee, workspace, project)
- ✅ Task details retrieval
- ✅ Task completion
- ✅ Task deletion
- ✅ OAuth & Personal Access Token authentication
- ✅ Multi-format output (TOON, JSON, Plain)

## Implementation Phases

### Phase 1: Task Update Operations (Week 1-2)
**Status**: 🟡 Planned
**Priority**: High

Complete the core task management CRUD operations with comprehensive update capabilities.

**Features**:
- Update task properties (name, notes, assignee, due date, start date)
- Move tasks between projects and sections
- Support for all task field updates via Asana API

**Commands**:
```bash
asana task update <task-id> --name "New name" --notes "Updated description"
asana task update <task-id> --assignee <user-id> --due-on 2025-12-31
asana task move <task-id> --project <project-id> --section <section-id>
```

**Deliverables**:
- [ ] Implement `task update` command
- [ ] Implement `task move` command
- [ ] Unit tests for all update operations
- [ ] E2E tests for task updates
- [ ] Documentation with usage examples

---

### Phase 2: Project Management (Week 3-4)
**Status**: 🟡 Planned
**Priority**: High

Enable comprehensive project and section management for team workflows.

**Features**:
- Full project CRUD operations
- Section management within projects
- Project member and task assignment
- Project status and progress tracking

**Commands**:
```bash
asana project list --workspace <workspace-id>
asana project create --name "Q1 Goals" --team <team-id>
asana project get <project-id>
asana project update <project-id> --name "Updated Name"
asana project delete <project-id>

asana section list <project-id>
asana section create <project-id> --name "In Progress"
```

**Deliverables**:
- [ ] Create `src/commands/project.ts`
- [ ] Implement all project commands
- [ ] Implement section commands
- [ ] Unit and E2E tests
- [ ] Documentation for project workflows

---

### Phase 3: Subtasks & Dependencies (Week 5-6)
**Status**: 🟡 Planned
**Priority**: High

Support task hierarchies and dependency relationships for complex workflows.

**Features**:
- Create and manage subtasks
- Set task dependencies (blocked by / blocking)
- Convert tasks to subtasks
- Visualize task relationships

**Commands**:
```bash
asana task subtask list <parent-id>
asana task subtask create <parent-id> --name "Subtask"
asana task subtask add <task-id> <parent-id>

asana task dependency add <task-id> <depends-on-id>
asana task dependency remove <task-id> <depends-on-id>
asana task dependency list <task-id>
```

**Deliverables**:
- [ ] Implement subtask commands
- [ ] Implement dependency commands
- [ ] Handle API limitations (max 30 dependencies)
- [ ] Unit and E2E tests
- [ ] Documentation with workflow examples

---

### Phase 4: Collaboration Features (Week 7-8)
**Status**: 🟡 Planned
**Priority**: High

Enable team collaboration through comments, followers, and tags.

**Features**:
- Task comments (Stories API)
- Follower management
- Tag creation and assignment
- Rich text comment support

**Commands**:
```bash
asana task comment add <task-id> "This is a comment"
asana task comment list <task-id>

asana task follower add <task-id> <user-id>
asana task follower remove <task-id> <user-id>
asana task follower list <task-id>

asana tag list --workspace <workspace-id>
asana tag create --name "urgent" --color "red"
asana task tag add <task-id> <tag-id>
asana task tag remove <task-id> <tag-id>
```

**Deliverables**:
- [ ] Create `src/commands/tag.ts`
- [ ] Implement comment commands
- [ ] Implement follower commands
- [ ] Implement tag commands
- [ ] Unit and E2E tests
- [ ] Documentation for collaboration workflows

---

### Phase 5: Team & Workspace Management (Week 9-10)
**Status**: 🟡 Planned
**Priority**: Medium

Complete team workflow support with enhanced workspace and user management.

**Features**:
- Team listing and details
- Team member management
- Enhanced workspace operations
- User search and lookup
- Workspace user directory

**Commands**:
```bash
asana team list --workspace <workspace-id>
asana team get <team-id>
asana team members <team-id>

asana workspace list
asana workspace get <workspace-id>
asana workspace users <workspace-id>

asana user me
asana user get <user-id>
asana user search "john@example.com"
```

**Deliverables**:
- [ ] Create `src/commands/team.ts`
- [ ] Enhance workspace commands
- [ ] Implement user commands
- [ ] Add workspace caching for performance
- [ ] Unit and E2E tests
- [ ] Documentation for team workflows

---

### Phase 6: Advanced Features (Week 11-12)
**Status**: 🟡 Planned
**Priority**: Low (Nice-to-have)

Power user features including attachments, custom fields, batch operations, and search.

**Features**:
- File attachments (upload/download)
- Basic custom field support
- Batch operations from JSON/CSV
- Full-text search across workspace

**Commands**:
```bash
asana task attach <task-id> ./document.pdf
asana task attachment list <task-id>
asana task attachment download <attachment-id>

asana task custom-field set <task-id> <field-id> "value"
asana task custom-field list <task-id>

asana task batch-update --file tasks.json
asana task batch-create --file tasks.csv

asana search tasks "quarterly goals" --workspace <workspace-id>
```

**Deliverables**:
- [ ] Implement attachment commands
- [ ] Implement custom field commands
- [ ] Implement batch operations
- [ ] Implement search command
- [ ] Unit and E2E tests
- [ ] Documentation for advanced features

---

## Cross-Cutting Improvements

### Testing Strategy
- **TDD Approach**: Red-Green-Refactor cycle for all new features
- **Coverage Target**: >80% code coverage
- **Unit Tests**: Mock Asana API responses for deterministic tests
- **E2E Tests**: Test against real (or sandbox) Asana workspace
- **Test Doubles**: Use fakes, stubs, and mocks appropriately

### Documentation
- **User Docs**: Update docs site (`docs/`) for each new command
- **Dev Docs**: Maintain development documentation in `dev-docs/`
- **Examples**: Include real-world usage examples
- **ADRs**: Document architectural decisions
- **API Coverage**: Document which Asana APIs are used

### Error Handling
- **Clear Messages**: User-friendly error messages with actionable guidance
- **Rate Limiting**: Handle API rate limits gracefully
- **Input Validation**: Validate before making API calls
- **Helpful Suggestions**: Provide suggestions for common mistakes

### Performance
- **Response Caching**: Cache workspace/team/user data appropriately
- **Pagination**: Support large result sets with pagination
- **Lazy Loading**: Lazy-load API clients to reduce startup time
- **Limits**: Add `--limit` flags for list commands

### Output Formatting
- **TOON Format**: Leverage @pleaseai/cli-toolkit for LLM-friendly output
- **JSON Format**: Support scripting and automation
- **Plain Format**: Traditional human-readable CLI output
- **Rich Formatting**: Color-coding for status, priorities, dates
- **Table Views**: Structured output for list commands

### Configuration
- **Project Config**: Support `.asana-cli.json` in project directories
- **Environment Variables**: Allow env var overrides
- **Defaults**: Default workspace/project settings
- **Preferences**: User output format preferences

---

## Success Metrics

### Completion Criteria
- ✅ All Phase 1-4 features implemented and tested (core priorities)
- ✅ Comprehensive test coverage (>80%)
- ✅ Complete documentation for user-facing features
- ✅ Zero regression in existing functionality
- ✅ Performance: all commands complete <2s for typical operations

### Quality Gates
- All tests passing (unit + E2E)
- No linting errors
- TypeScript strict mode compliance
- Conventional commit messages
- Code review approval
- Documentation updated

---

## Future Considerations

Features beyond Phase 6 to consider based on user feedback:

- **Webhooks**: Real-time event subscriptions
- **Advanced Automation**: Rules and triggers
- **Portfolio Management**: Portfolio CRUD operations
- **Goals & OKRs**: Goal tracking and management
- **Time Tracking**: Time tracking entries
- **Interactive TUI**: Terminal UI mode with keyboard navigation
- **Shell Completions**: bash/zsh/fish autocompletion
- **Plugin System**: Extensibility for custom commands
- **Export/Import**: Backup and restore Asana data
- **Templates**: Task and project templates
- **Reporting**: Generate reports on task completion, team velocity
- **Offline Mode**: Local caching for offline operation

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to this roadmap.

## Related Documentation

- [STANDARDS.md](./STANDARDS.md) - Coding standards
- [TESTING.md](./TESTING.md) - Testing guidelines
- [TDD.md](./TDD.md) - TDD methodology
- [ASANA_NODE_CLIENT.md](./ASANA_NODE_CLIENT.md) - Asana API reference
